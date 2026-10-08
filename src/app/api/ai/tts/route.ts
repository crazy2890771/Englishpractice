import { createHash } from "crypto";
import { z } from "zod";
import { ApiError, parseBody, withUser } from "@/lib/api";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { resolveProviders } from "@/lib/ai/config";
import { openaiSpeak } from "@/lib/ai/providers/openai";
import { ProviderError } from "@/lib/ai/providers/types";
import { assertAiAllowed, recordUsage } from "@/lib/usage";

const schema = z.object({
  text: z.string().trim().min(1).max(1500),
  voice: z.enum(["female", "male", "neutral"]).default("neutral"),
  speed: z.number().min(0.5).max(1.5).default(1),
});

/** Server-side text-to-speech with a shared cache (identical lesson audio is generated once). */
export const POST = withUser(async (req, user) => {
  const providers = resolveProviders(user.settings);
  if (providers.tts !== "openai") throw new ApiError(501, "Server text-to-speech is not configured.", "tts_unavailable");
  const body = await parseBody(req, schema);
  const speed = Math.round(body.speed * 20) / 20;
  const key = createHash("sha256").update(`openai|${env.openaiTtsModel}|${body.voice}|${speed}|${body.text}`).digest("hex");
  const cached = await db.ttsCache.findUnique({ where: { key } });
  if (cached) return audioResponse(cached.data, cached.mimeType, true);

  await assertAiAllowed(user, "tts");
  try {
    const audio = await openaiSpeak(body.text, body.voice, speed, req.signal);
    await recordUsage(user.id, "tts", "openai", body.text.length, (body.text.length / 1000) * env.ttsCentsPer1kChars);
    await db.ttsCache.upsert({ where: { key }, create: { key, mimeType: "audio/mpeg", data: audio }, update: {} });
    return audioResponse(audio, "audio/mpeg", false);
  } catch (err) {
    if (err instanceof ProviderError) throw new ApiError(502, err.message, "tts_failed");
    throw err;
  }
});

function audioResponse(data: Uint8Array, mime: string, cached: boolean) {
  return new Response(Buffer.from(data), {
    headers: { "content-type": mime, "cache-control": "private, max-age=86400", "x-tts-cache": cached ? "hit" : "miss" },
  });
}
