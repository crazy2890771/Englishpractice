import "server-only";
import { env } from "@/lib/env";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export class AiError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}

export type ProviderId = "anthropic" | "openai";

export function availableProviders(): ProviderId[] {
  const out: ProviderId[] = [];
  if (env.anthropicKey) out.push("anthropic");
  if (env.openaiKey) out.push("openai");
  return out;
}

/** Picks the LLM provider: user preference → server preference → first configured. null = demo mode. */
export function resolveProvider(preference?: string | null): ProviderId | null {
  const available = availableProviders();
  if (env.aiProvider === "none" || preference === "none") return null;
  for (const p of [preference, env.aiProvider]) if (p && available.includes(p as ProviderId)) return p as ProviderId;
  return available[0] ?? null;
}

async function request(url: string, init: RequestInit, signal?: AbortSignal, attempt = 0): Promise<Response> {
  const timeout = AbortSignal.timeout(env.aiTimeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch {
    if (signal?.aborted) throw new AiError("Cancelled.", false);
    if (attempt === 0) return request(url, init, signal, 1);
    throw new AiError(timeout.aborted ? "The AI service timed out." : "Could not reach the AI service.", true);
  }
  if (res.ok) return res;
  if ((res.status === 429 || res.status >= 500) && attempt === 0) {
    await new Promise((r) => setTimeout(r, 800));
    return request(url, init, signal, 1);
  }
  throw new AiError(res.status === 401 || res.status === 403 ? "The AI provider rejected the API key." : `The AI provider returned an error (${res.status}).`, res.status >= 500 || res.status === 429);
}

export async function complete(provider: ProviderId, system: string, messages: ChatMessage[], maxTokens: number, signal?: AbortSignal): Promise<CompletionResult> {
  if (provider === "anthropic") {
    const res = await request(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": env.anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: env.anthropicModel, max_tokens: maxTokens, system, messages }),
      },
      signal,
    );
    const data = (await res.json()) as { content: { type: string; text?: string }[]; usage?: { input_tokens: number; output_tokens: number } };
    return { text: data.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join(""), inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
  }
  const res = await request(
    `${env.openaiBaseUrl}/chat/completions`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.openaiKey}` },
      body: JSON.stringify({ model: env.openaiChatModel, max_tokens: maxTokens, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, ...messages] }),
    },
    signal,
  );
  const data = (await res.json()) as { choices: { message: { content: string } }[]; usage?: { prompt_tokens: number; completion_tokens: number } };
  return { text: data.choices[0]?.message.content ?? "", inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 };
}

/* ───────────────────────── Speech (OpenAI-compatible) ───────────────────────── */

export function serverSpeechAvailable() {
  return !!env.openaiKey;
}

export async function transcribe(audio: Blob, filename: string, language: "en" | "zh", signal?: AbortSignal) {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", env.openaiSttModel);
  form.append("language", language);
  form.append("response_format", "verbose_json");
  const res = await request(`${env.openaiBaseUrl}/audio/transcriptions`, { method: "POST", headers: { authorization: `Bearer ${env.openaiKey}` }, body: form }, signal);
  const data = (await res.json()) as { text?: string; duration?: number };
  return { text: (data.text ?? "").trim(), durationSec: data.duration ?? null };
}

export async function synthesize(text: string, voice: "female" | "male", speed: number, signal?: AbortSignal) {
  const res = await request(
    `${env.openaiBaseUrl}/audio/speech`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.openaiKey}` },
      body: JSON.stringify({ model: env.openaiTtsModel, voice: voice === "female" ? "nova" : "onyx", input: text, speed, response_format: "mp3" }),
    },
    signal,
  );
  return Buffer.from(await res.arrayBuffer());
}
