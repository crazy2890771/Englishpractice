import "server-only";
import { env } from "../env";

export type LlmChoice = "anthropic" | "openai" | "mock";
export type SpeechChoice = "openai" | "browser";

export function availableLlms(): LlmChoice[] {
  const out: LlmChoice[] = [];
  if (env.anthropicKey) out.push("anthropic");
  if (env.openaiKey) out.push("openai");
  out.push("mock");
  return out;
}

export function availableSpeech(): SpeechChoice[] {
  return env.openaiKey ? ["openai", "browser"] : ["browser"];
}

function pick<T extends string>(pref: string | undefined, serverPref: string, available: T[], fallback: T): T {
  for (const p of [pref, serverPref]) {
    if (p && p !== "auto" && (available as string[]).includes(p)) return p as T;
  }
  return available[0] ?? fallback;
}

export interface ResolvedProviders {
  llm: LlmChoice;
  stt: SpeechChoice;
  tts: SpeechChoice;
  /** demo = no live LLM; feedback is rule-based. */
  mode: "live" | "demo";
}

/** Resolve providers from user preferences, server preferences, and configured keys. */
export function resolveProviders(settings?: { llmProvider: string; sttProvider: string; ttsProvider: string } | null): ResolvedProviders {
  const llm = pick(settings?.llmProvider, env.llmProvider, availableLlms(), "mock");
  const stt = pick(settings?.sttProvider, env.sttProvider, availableSpeech(), "browser");
  const tts = pick(settings?.ttsProvider, env.ttsProvider, availableSpeech(), "browser");
  return { llm, stt, tts, mode: llm === "mock" ? "demo" : "live" };
}
