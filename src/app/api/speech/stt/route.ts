import { asUser } from "@/db";
import { route, HttpError } from "@/server/http";
import { serverSpeechAvailable, transcribe } from "@/ai/providers";
import { assertAiAllowed } from "@/server/ai-usage";
import { schema } from "@/db";

const ALLOWED = /^audio\/(webm|ogg|mp4|mpeg|wav|x-wav|aac|x-m4a)/;
const MAX = 10 * 1024 * 1024;

/** Server speech-to-text (English or Chinese). Browsers fall back to on-device recognition or typing. */
export const POST = route(async (req, learner) => {
  if (!serverSpeechAvailable()) throw new HttpError(501, "stt_unavailable");
  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  const language = form?.get("language") === "zh" ? "zh" : "en";
  if (!(file instanceof Blob) || file.size === 0) throw new HttpError(400, "empty_answer");
  if (file.size > MAX) throw new HttpError(413, "invalid_input");
  const type = file.type.split(";")[0] ?? "";
  if (!ALLOWED.test(type)) throw new HttpError(415, "invalid_input");
  await asUser(learner.id, (tx) => assertAiAllowed(tx, learner.id));
  const ext = /mp4|m4a|aac/.test(type) ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : type.includes("mpeg") ? "mp3" : "webm";
  const out = await transcribe(file, `speech.${ext}`, language, req.signal);
  await asUser(learner.id, (tx) => tx.insert(schema.aiUsage).values({ userId: learner.id, kind: "stt", provider: "openai", units: Math.ceil(out.durationSec ?? 0) }));
  return { text: out.text, durationSec: out.durationSec };
});
