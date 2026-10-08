import { NextResponse } from "next/server";
import { ApiError, withUser } from "@/lib/api";
import { env } from "@/lib/env";
import { resolveProviders } from "@/lib/ai/config";
import { openaiTranscribe } from "@/lib/ai/providers/openai";
import { ProviderError } from "@/lib/ai/providers/types";
import { assertAiAllowed, recordUsage } from "@/lib/usage";

const ALLOWED = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|m4a|x-m4a|aac)/;

/** Server-side speech-to-text. Clients fall back to browser recognition or typing when unavailable. */
export const POST = withUser(async (req, user) => {
  const providers = resolveProviders(user.settings);
  if (providers.stt !== "openai") throw new ApiError(501, "Server speech recognition is not configured.", "stt_unavailable");
  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob)) throw new ApiError(400, "No audio received.");
  if (file.size === 0) throw new ApiError(400, "The recording is empty.");
  if (file.size > env.maxAudioBytes) throw new ApiError(413, "Recording is too long. Keep answers under about 2 minutes.");
  const type = file.type.split(";")[0] ?? "";
  if (!ALLOWED.test(type)) throw new ApiError(415, `Unsupported audio format (${type || "unknown"}).`);
  await assertAiAllowed(user, "stt");
  const ext = type.includes("mp4") || type.includes("m4a") || type.includes("aac") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : type.includes("mpeg") || type.includes("mp3") ? "mp3" : "webm";
  try {
    const out = await openaiTranscribe(file, `speech.${ext}`, req.signal);
    const minutes = (out.durationSec ?? file.size / 16000) / 60;
    await recordUsage(user.id, "stt", "openai", Math.ceil(minutes * 60), minutes * env.sttCentsPerMinute);
    return NextResponse.json({ text: out.text, durationSec: out.durationSec ?? null });
  } catch (err) {
    if (err instanceof ProviderError) throw new ApiError(502, err.message, "stt_failed");
    throw err;
  }
});
