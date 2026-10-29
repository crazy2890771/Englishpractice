import { z } from "zod";
import { asUser, schema } from "@/db";
import { readJson, route, HttpError } from "@/server/http";

const body = z.object({
  path: z.string().max(200),
  languageId: z.enum(["en", "zh"]),
  mimeType: z.string().max(60),
  durationMs: z.number().int().min(0).max(600000).optional(),
  transcript: z.string().max(5000).optional(),
  exerciseId: z.string().max(120).optional(),
  prompt: z.string().max(600).optional(),
});

/** Registers a recording the browser uploaded to the private bucket (only with consent). */
export const POST = route(async (req, learner) => {
  if (!learner.profile.saveRecordings) throw new HttpError(403, "no_consent");
  const b = await readJson(req, body);
  if (!b.path.startsWith(`${learner.id}/`)) throw new HttpError(403, "invalid_input");
  const expiresAt = new Date(Date.now() + learner.profile.recordingRetentionDays * 86_400_000);
  await asUser(learner.id, (tx) => tx.insert(schema.recordings).values({ userId: learner.id, languageId: b.languageId, storagePath: b.path, mimeType: b.mimeType, durationMs: b.durationMs ?? null, transcript: b.transcript ?? null, exerciseId: b.exerciseId ?? null, prompt: b.prompt ?? null, expiresAt }));
  return { ok: true };
});
