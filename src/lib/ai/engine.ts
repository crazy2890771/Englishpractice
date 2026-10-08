import "server-only";
import type { ZodType, ZodTypeDef } from "zod";
import { env } from "../env";
import { recordUsage } from "../usage";
import { ApiError } from "../api";
import { heuristicTurnFeedback, heuristicWritingFeedback } from "../feedback/heuristics";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";
import { ProviderError, type LlmMessage, type LlmProvider } from "./providers/types";
import type { LlmChoice } from "./config";
import {
  chatTurnSchema,
  roleplaySummarySchema,
  writingFeedbackSchema,
  type ChatTurn,
  type RoleplaySummary,
  type WritingFeedback,
} from "./schemas";
import { roleplaySummaryPrompt, roleplaySystemPrompt, speakingSystemPrompt, writingSystemPrompt } from "./prompts";
import type { RoleplayScenario } from "@/content/types";
import { wordCount } from "../text";

function providerFor(choice: LlmChoice): LlmProvider | null {
  if (choice === "anthropic") return anthropicProvider;
  if (choice === "openai") return openaiProvider;
  return null;
}

/** Extract the first JSON object from model text (tolerates code fences). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Calls the LLM and validates the JSON output against a schema.
 * On invalid output it asks the model once to repair it.
 */
async function generateStructured<T>(
  userId: string,
  provider: LlmProvider,
  schema: ZodType<T, ZodTypeDef, unknown>,
  system: string,
  messages: LlmMessage[],
  maxTokens: number,
  signal?: AbortSignal,
): Promise<T> {
  let convo = messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await provider.complete({ system, messages: convo, maxTokens, signal });
    } catch (err) {
      if (err instanceof ProviderError) throw new ApiError(502, err.message, err.retryable ? "provider_retryable" : "provider_error");
      throw err;
    }
    const cost = (res.inputTokens / 1000) * env.llmInputCentsPer1k + (res.outputTokens / 1000) * env.llmOutputCentsPer1k;
    await recordUsage(userId, "llm", provider.name, res.inputTokens + res.outputTokens, cost);
    try {
      const parsed = schema.safeParse(extractJson(res.text));
      if (parsed.success) return parsed.data;
      convo = [
        ...messages,
        { role: "assistant", content: res.text },
        { role: "user", content: `Your JSON did not match the schema (${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}). Reply again with ONLY the corrected JSON object.` },
      ];
    } catch {
      convo = [...messages, { role: "assistant", content: res.text }, { role: "user", content: "Reply again with ONLY a valid JSON object." }];
    }
  }
  throw new ApiError(502, "The AI returned an invalid response. Please try again.", "invalid_ai_output");
}

/* ───────────────────────── Speaking & roleplay ───────────────────────── */

export interface SpeakingContext {
  kind: "speaking";
  topic: string;
  goal?: string;
  questions: string[];
  targetWords: string[];
  level: string;
}

export interface RoleplayContext {
  kind: "roleplay";
  scenario: RoleplayScenario;
  level: string;
}

export interface TurnInput {
  userId: string;
  llm: LlmChoice;
  ctx: SpeakingContext | RoleplayContext;
  /** Previous messages, oldest first, not including the new learner message. */
  history: LlmMessage[];
  userText: string;
  durationSec?: number;
  signal?: AbortSignal;
}

const ROLEPLAY_TURNS = 7;

export async function conversationTurn(input: TurnInput): Promise<ChatTurn & { live: boolean }> {
  const provider = providerFor(input.llm);
  if (!provider) return { ...mockTurn(input), live: false };

  const system =
    input.ctx.kind === "speaking"
      ? speakingSystemPrompt(input.ctx)
      : roleplaySystemPrompt({ ...input.ctx.scenario, level: input.ctx.level, maxTurns: ROLEPLAY_TURNS });
  const messages: LlmMessage[] = [...input.history.slice(-16), { role: "user", content: input.userText }];
  const out = await generateStructured(input.userId, provider, chatTurnSchema, system, messages, 1200, input.signal);
  // The model must evaluate exactly what the learner said.
  out.feedback.original = input.userText;
  return { ...out, live: true };
}

/** Demo mode: scripted conversation + rule-based feedback. Clearly labelled in the UI. */
export function mockTurn(input: Pick<TurnInput, "ctx" | "history" | "userText" | "durationSec">): ChatTurn {
  const learnerTurns = input.history.filter((m) => m.role === "user").length; // before this one
  const lastAssistant = [...input.history].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const question = lastAssistant || (input.ctx.kind === "speaking" ? input.ctx.topic : "");
  const targetWords = input.ctx.kind === "speaking" ? input.ctx.targetWords : input.ctx.scenario.usefulPhrases;
  const feedback = heuristicTurnFeedback(input.userText, { question, targetWords, durationSec: input.durationSec });

  const n = wordCount(input.userText);
  const askedToElaborate = lastAssistant.includes("tell me a little more");
  const asksQuestion = /\?\s*$/.test(input.userText.trim());

  if (input.ctx.kind === "roleplay") {
    const sc = input.ctx.scenario;
    const idx = learnerTurns; // demoTurns[0] answers the learner's first message
    if (idx >= sc.demoTurns.length) return { reply: sc.closing, feedback, scenarioComplete: true };
    return { reply: sc.demoTurns[idx]!, feedback, scenarioComplete: false };
  }

  const questions = input.ctx.questions;
  // Count questions already asked (elaboration prompts don't advance the script).
  const elaborations = input.history.filter((m) => m.role === "assistant" && m.content.includes("tell me a little more")).length;
  const nextIdx = learnerTurns - elaborations + 1; // questions[0] was the opening question
  if (n < 6 && !askedToElaborate && !asksQuestion) {
    return {
      reply: "Thanks! Could you tell me a little more? For example, why, when, or how?",
      feedback,
      scenarioComplete: false,
    };
  }
  const acks = [
    "That sounds interesting.",
    "Thanks for sharing that.",
    "I see what you mean.",
    "Nice — that's a great example.",
    "Good point.",
    "That makes sense.",
  ];
  const ack = asksQuestion
    ? "Good question! In demo mode I follow the lesson script, so I can't answer freely — but let's keep going."
    : acks[learnerTurns % acks.length]!;
  if (nextIdx >= questions.length) {
    return {
      reply: `${ack} That's the end of today's conversation — great work! Check your feedback, then end the session.`,
      feedback,
      scenarioComplete: true,
    };
  }
  return { reply: `${ack} ${questions[nextIdx]}`, feedback, scenarioComplete: false };
}

/* ───────────────────────── Writing ───────────────────────── */

export interface WritingInput {
  userId: string;
  llm: LlmChoice;
  text: string;
  prompt: string;
  type: string;
  minWords: number;
  maxWords: number;
  level: string;
  targetWords: string[];
  signal?: AbortSignal;
}

export async function writingFeedback(input: WritingInput): Promise<WritingFeedback & { live: boolean }> {
  const provider = providerFor(input.llm);
  if (!provider) {
    return {
      ...heuristicWritingFeedback(input.text, { minWords: input.minWords, maxWords: input.maxWords, type: input.type, targetWords: input.targetWords }),
      live: false,
    };
  }
  const out = await generateStructured(
    input.userId,
    provider,
    writingFeedbackSchema,
    writingSystemPrompt(input),
    [{ role: "user", content: input.text }],
    2500,
    input.signal,
  );
  return { ...out, live: true };
}

/* ───────────────────────── Roleplay summary ───────────────────────── */

export async function roleplaySummary(
  userId: string,
  llm: LlmChoice,
  scenario: RoleplayScenario,
  transcript: LlmMessage[],
  turnScores: { grammar: number; vocabulary: number; fluency: number; taskCompletion: number }[],
  signal?: AbortSignal,
): Promise<RoleplaySummary & { live: boolean }> {
  const provider = providerFor(llm);
  if (!provider) {
    const avg = (k: keyof (typeof turnScores)[number]) =>
      turnScores.length ? Math.round(turnScores.reduce((s, t) => s + t[k], 0) / turnScores.length) : 1;
    const learnerWords = transcript.filter((m) => m.role === "user").reduce((s, m) => s + wordCount(m.content), 0);
    const polite = transcript.some((m) => m.role === "user" && /\b(please|thank|could you|would you|sorry|excuse me|i'd like)\b/i.test(m.content));
    return {
      appropriateness: Math.max(1, Math.min(5, polite ? 4 : 3)),
      clarity: Math.max(1, Math.min(5, Math.round((avg("grammar") + avg("fluency")) / 2))),
      naturalness: Math.max(1, Math.min(5, avg("vocabulary"))),
      // The demo engine cannot judge whether objectives were met; it reports participation only.
      objectivesMet: scenario.objectives.map(() => learnerWords >= 40),
      comments: `Demo summary (rule-based): you spoke ${learnerWords} words across ${turnScores.length} turns${polite ? " and used polite phrases" : ""}. Connect an AI provider for detailed feedback on appropriateness and objectives.`,
      betterPhrases: [],
      live: false,
    };
  }
  const text = transcript.map((m) => `${m.role === "user" ? "LEARNER" : scenario.character.name.toUpperCase()}: ${m.content}`).join("\n");
  const out = await generateStructured(userId, provider, roleplaySummarySchema, roleplaySummaryPrompt(scenario.objectives), [{ role: "user", content: text }], 1000, signal);
  return { ...out, live: true };
}
