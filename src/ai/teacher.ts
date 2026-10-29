import "server-only";
import { z } from "zod";
import type { Exercise, LanguageId, Skill } from "@/content/types";
import { WEAKNESS_CATEGORIES } from "@/content/tags";
import { exerciseProblems, exerciseSchema } from "@/content/validate";
import { lang } from "@/languages";
import { RUBRIC, RUBRIC_KEYS, demoEvaluate, scoreFromCriteria, type OpenEvaluation, type OpenKind } from "@/engine/open-eval";
import { generateJson } from "./structured";
import type { ChatMessage, ProviderId } from "./providers";

/** Shared tutor persona (spec §13). */
function persona(language: LanguageId, level: string, explanationLanguage: "th" | "en") {
  const m = lang(language);
  return `You are a patient, encouraging, direct and professional ${m.nameEn} teacher for an adult Thai learner at ${m.framework} level ${level}.
Explain mistakes simply and briefly, encourage the learner to retry, and do not overpraise. Prefer short practice turns over long explanations.
Write all explanations and comments in ${explanationLanguage === "th" ? "Thai" : "English"}. ${m.tutorNotes}`;
}

function rubricText(kind: OpenKind) {
  return RUBRIC_KEYS[kind].map((k) => `- ${k}: 1 = ${RUBRIC[k]!.bands[1].en}; 3 = ${RUBRIC[k]!.bands[3].en}; 5 = ${RUBRIC[k]!.bands[5].en}`).join("\n");
}

function tagList(language: LanguageId) {
  return WEAKNESS_CATEGORIES.filter((c) => c.language === language).map((c) => `${c.id} (${c.nameEn})`).join(", ");
}

const mistakeSchema = z.object({
  original: z.string().min(1).max(300),
  corrected: z.string().min(1).max(300),
  explanation: z.string().min(1).max(400),
  tag: z.string(),
});

function evaluationSchema(kind: OpenKind) {
  const criteria = Object.fromEntries(RUBRIC_KEYS[kind].map((k) => [k, z.number().int().min(1).max(5)])) as Record<string, z.ZodNumber>;
  return z.object({
    criteria: z.object(criteria),
    mistakes: z.array(mistakeSchema).max(8),
    correctedVersion: z.string().max(3000),
    comment: z.string().min(1).max(600),
    retryPrompt: z.string().min(1).max(400),
  });
}

function evalInstructions(kind: OpenKind, language: LanguageId) {
  return `Evaluate the learner's ${kind === "writing" ? "written answer" : "spoken answer (speech-recognition transcript — ignore punctuation, capitalisation and obvious recognition artefacts)"}.
Rules:
- Only report genuine errors (max 8, most important first). Do not over-correct acceptable variants or style.
- Each mistake: the exact wrong fragment, its fix, a one-sentence explanation, and a category tag from: ${tagList(language)}.
- correctedVersion: the learner's answer with ONLY the errors fixed (do not rewrite it into your own text).
- retryPrompt: one short instruction asking the learner to try again, targeting the most important mistake.
- Score each criterion with an integer band 1–5 using exactly this rubric:
${rubricText(kind)}
${kind === "speaking" ? "- Pronunciation and tones CANNOT be judged from a transcript. Do not mention or score them.\n" : ""}${lang(language).rubricNotes}
Reply with ONLY JSON: {"criteria": {${RUBRIC_KEYS[kind].map((k) => `"${k}": 1-5`).join(", ")}}, "mistakes": [{"original","corrected","explanation","tag"}], "correctedVersion": string, "comment": string (2 short sentences: one strength, one priority), "retryPrompt": string}`;
}

export interface EvaluateInput {
  language: LanguageId;
  level: string;
  kind: OpenKind;
  task: string;
  requirements: string[];
  minLength: number;
  text: string;
  durationSec?: number;
  targetWords?: string[];
  explanationLanguage: "th" | "en";
  provider: ProviderId | null;
  signal?: AbortSignal;
  onUsage?: (tokensIn: number, tokensOut: number) => void;
}

/** AI rubric evaluation, or the labelled demo evaluator when no provider is configured. */
export async function evaluateOpen(input: EvaluateInput): Promise<OpenEvaluation> {
  const demo = demoEvaluate({ ...input });
  if (!input.provider) return demo;
  const schema = evaluationSchema(input.kind);
  const tags = new Set(WEAKNESS_CATEGORIES.filter((c) => c.language === input.language).map((c) => c.id));
  const out = await generateJson(
    input.provider,
    schema,
    `${persona(input.language, input.level, input.explanationLanguage)}\n\n${evalInstructions(input.kind, input.language)}`,
    [{ role: "user", content: `TASK: ${input.task}\nREQUIREMENTS: ${input.requirements.join("; ")}\nMINIMUM LENGTH: ${input.minLength} ${lang(input.language).lengthUnit}\n\nLEARNER ANSWER:\n${input.text}` }],
    { maxTokens: 1800, signal: input.signal, onUsage: input.onUsage },
  );
  const criteria = out.criteria as Record<string, number>;
  return {
    evaluator: "ai",
    provider: input.provider,
    kind: input.kind,
    criteria,
    score: scoreFromCriteria(criteria, RUBRIC_KEYS[input.kind]),
    mistakes: out.mistakes.map((m) => ({ ...m, tag: tags.has(m.tag) ? m.tag : `${input.language}.word_order` })),
    correctedVersion: out.correctedVersion || input.text,
    comment: out.comment,
    retryPrompt: out.retryPrompt,
    pronunciation: null,
    limitations: input.kind === "speaking" ? ["no_pronunciation_assessment", "ai_estimate"] : ["ai_estimate"],
    meetsLength: demo.meetsLength,
  };
}

/* ───────────────────────── Conversation tutor ───────────────────────── */

export type CorrectionMode = "immediate" | "after_each" | "end";

export interface TutorTurn {
  reply: string;
  feedback: OpenEvaluation;
  /** Immediate-correction mode: ask the learner to repeat the corrected sentence before moving on. */
  askRetry: boolean;
}

export async function tutorTurn(input: {
  language: LanguageId;
  level: string;
  topic: string;
  questions: string[];
  correctionMode: CorrectionMode;
  explanationLanguage: "th" | "en";
  history: ChatMessage[];
  text: string;
  durationSec?: number;
  provider: ProviderId | null;
  signal?: AbortSignal;
  onUsage?: (a: number, b: number) => void;
}): Promise<TutorTurn> {
  const learnerTurns = input.history.filter((m) => m.role === "user").length;
  const lastTutor = [...input.history].reverse().find((m) => m.role === "assistant")?.content ?? input.questions[0] ?? "";
  const feedback = await evaluateOpen({
    language: input.language,
    level: input.level,
    kind: "speaking",
    task: lastTutor,
    requirements: ["answer the question"],
    minLength: input.language === "zh" ? 8 : 8,
    text: input.text,
    durationSec: input.durationSec,
    explanationLanguage: input.explanationLanguage,
    provider: input.provider,
    signal: input.signal,
    onUsage: input.onUsage,
  });
  const askRetry = input.correctionMode === "immediate" && feedback.mistakes.length > 0;

  if (!input.provider) {
    // Demo tutor: follows a question script for the topic (clearly labelled in the UI).
    const lastWasRetry = /^(ลองพูดใหม่|Try saying it again)/.test(lastTutor);
    const answered = input.history.filter((m) => m.role === "assistant" && !/^(ลองพูดใหม่|Try saying it again)/.test(m.content)).length;
    if (askRetry && !lastWasRetry) {
      const fix = feedback.mistakes[0]!;
      return { reply: input.explanationLanguage === "th" ? `ลองพูดใหม่อีกครั้ง โดยใช้ “${fix.corrected}”` : `Try saying it again with “${fix.corrected}”.`, feedback, askRetry };
    }
    const next = input.questions[answered % Math.max(1, input.questions.length)] ?? input.questions[0]!;
    const ack = input.language === "zh" ? ["好的。", "明白了。", "谢谢你的回答。", "很好。"][learnerTurns % 4] : ["Thanks.", "I see.", "Good.", "Okay."][learnerTurns % 4];
    return { reply: `${ack} ${next}`, feedback, askRetry };
  }

  const schema = z.object({ reply: z.string().min(1).max(600) });
  const system = `${persona(input.language, input.level, input.explanationLanguage)}
You are having a spoken conversation practice in ${lang(input.language).nameEn} about "${input.topic}".
- Reply in ${lang(input.language).nameEn} at the learner's level, 1–2 short sentences, then ask exactly ONE question. ${input.language === "zh" ? "Use simplified characters." : ""}
- Build on what the learner said; gradually increase difficulty when answers are accurate.
- Do NOT correct the learner in the reply (corrections are shown separately).
${askRetry ? `- The learner made a mistake (${feedback.mistakes[0]!.original} → ${feedback.mistakes[0]!.corrected}). Briefly invite them to say their sentence again correctly instead of asking a new question.` : ""}
Suggested questions for this topic: ${input.questions.slice(0, 8).join(" | ")}
Reply with ONLY JSON: {"reply": string}`;
  const out = await generateJson(input.provider, schema, system, [...input.history.slice(-12), { role: "user", content: input.text }], {
    maxTokens: 400,
    signal: input.signal,
    onUsage: input.onUsage,
  });
  return { reply: out.reply, feedback, askRetry };
}

/* ───────────────────────── AI exercise generation ───────────────────────── */

const GENERATABLE = ["mcq", "true_false", "fill_blank", "word_recall", "sentence_order", "sentence_correction"] as const;

/**
 * Generates extra practice exercises with AI and validates each one (shape + answer rules).
 * Invalid items are dropped; callers fall back to the deterministic bank.
 */
export async function generateExercises(input: {
  language: LanguageId;
  level: string;
  skill: Skill;
  objective: string;
  tags: string[];
  count: number;
  idPrefix: string;
  provider: ProviderId;
  signal?: AbortSignal;
  onUsage?: (a: number, b: number) => void;
}): Promise<Exercise[]> {
  const m = lang(input.language);
  const schema = z.object({ exercises: z.array(z.unknown()).min(1).max(10) });
  const system = `You create ${m.nameEn} practice exercises for an adult Thai learner at ${m.framework} ${input.level}.
Skill: ${input.skill}. Learning objective: ${input.objective}. Focus categories: ${input.tags.join(", ")}.
Create ${input.count} varied exercises. Allowed types: ${GENERATABLE.join(", ")}. Each exercise JSON:
{"id": "<any>", "type": one of the allowed types, "skill": "${input.skill}", "objective": "${input.objective}", "tags": [category ids from: ${tagList(input.language)}],
 "prompt": string (target language; use "___" for blanks), ${input.language === "zh" ? '"promptPinyin": string (tone marks), "promptTh": string,' : '"promptTh": string (optional),'}
 "explanationTh": string (Thai, why the answer is right), "explanationEn": string,
 type-specific: mcq {"options": [4 strings], "answer": index}, true_false {"answer": boolean}, fill_blank/word_recall/sentence_correction {"answers": [all accepted answers]}, sentence_order {"tokens": [tokens in the CORRECT order]}}
Exactly one defensible answer per item. Level-appropriate, natural language${input.language === "zh" ? ", simplified characters" : ""}.
Reply with ONLY JSON: {"exercises": [...]}`;
  const out = await generateJson(input.provider, schema, system, [{ role: "user", content: "Generate the exercises now." }], {
    maxTokens: 3000,
    signal: input.signal,
    onUsage: input.onUsage,
  });
  const valid: Exercise[] = [];
  for (const [i, raw] of out.exercises.entries()) {
    const parsed = exerciseSchema.safeParse({ ...(raw as object), id: `${input.idPrefix}-${i + 1}`, skill: input.skill, objective: input.objective });
    if (!parsed.success) continue;
    const ex = parsed.data as Exercise;
    if (!(GENERATABLE as readonly string[]).includes(ex.type)) continue;
    if (exerciseProblems(ex, input.language).length) continue;
    valid.push(ex);
  }
  return valid;
}
