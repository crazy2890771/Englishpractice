import "server-only";
import type { z } from "zod";
import { AiError, complete, type ChatMessage, type ProviderId } from "./providers";

/** Extracts the first JSON object from model output (tolerates code fences / prose). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Calls the model and validates its JSON against a schema. One automatic repair attempt
 * on invalid output; then fails loudly (callers show an error / fall back to labelled demo mode).
 */
export async function generateJson<T>(
  provider: ProviderId,
  schema: z.ZodType<T>,
  system: string,
  messages: ChatMessage[],
  opts: { maxTokens: number; signal?: AbortSignal; validate?: (v: T) => string | null; onUsage?: (tokensIn: number, tokensOut: number) => void },
): Promise<T> {
  let convo = messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await complete(provider, system, convo, opts.maxTokens, opts.signal);
    opts.onUsage?.(res.inputTokens, res.outputTokens);
    let problem: string;
    try {
      const parsed = schema.safeParse(extractJson(res.text));
      if (parsed.success) {
        const extra = opts.validate?.(parsed.data) ?? null;
        if (!extra) return parsed.data;
        problem = extra;
      } else {
        const issue = parsed.error.issues[0];
        problem = `${issue?.path.join(".")}: ${issue?.message}`;
      }
    } catch {
      problem = "the reply was not valid JSON";
    }
    convo = [...messages, { role: "assistant", content: res.text }, { role: "user", content: `Your previous reply was invalid (${problem}). Reply again with ONLY the corrected JSON object.` }];
  }
  throw new AiError("The AI returned an invalid response.", true);
}
