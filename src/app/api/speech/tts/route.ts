import { z } from "zod";
import { asUser, schema } from "@/db";
import { readJson, route, HttpError } from "@/server/http";
import { serverSpeechAvailable, synthesize } from "@/ai/providers";
import { rateLimit } from "@/server/ai-usage";

const body = z.object({ text: z.string().trim().min(1).max(800), voice: z.enum(["female", "male"]).default("female"), speed: z.number().min(0.5).max(1.5).default(1) });

// Small per-instance cache: lesson audio is the same for every learner.
const cache = new Map<string, Buffer>();

export const POST = route(async (req, learner) => {
  if (!serverSpeechAvailable()) throw new HttpError(501, "tts_unavailable");
  const b = await readJson(req, body);
  const key = `${b.voice}|${b.speed}|${b.text}`;
  let audio = cache.get(key);
  if (!audio) {
    if (!rateLimit(`tts:${learner.id}`, 60)) throw new HttpError(429, "rate_limited");
    audio = await synthesize(b.text, b.voice, b.speed, req.signal);
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    cache.set(key, audio);
    await asUser(learner.id, (tx) => tx.insert(schema.aiUsage).values({ userId: learner.id, kind: "tts", provider: "openai", units: b.text.length }));
  }
  return new Response(new Uint8Array(audio), { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" } });
});
