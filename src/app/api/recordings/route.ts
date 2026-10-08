import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, withUser } from "@/lib/api";
import { env } from "@/lib/env";

const modeSchema = z.enum(["SPEAKING", "SHADOWING", "ROLEPLAY", "ASSESSMENT"]);

async function purgeExpired(userId: string) {
  await db.recording.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
}

/** Stores a recording — only when the learner has given consent in Settings. */
export const POST = withUser(async (req, user) => {
  if (!user.settings?.saveRecordings) throw new ApiError(403, "Saving recordings is turned off. Enable it in Settings.", "no_consent");
  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob) || file.size === 0) throw new ApiError(400, "No audio received.");
  if (file.size > env.maxAudioBytes) throw new ApiError(413, "Recording is too large.");
  if (!file.type.startsWith("audio/")) throw new ApiError(415, "Only audio files can be saved.");
  const mode = modeSchema.safeParse(form?.get("mode"));
  if (!mode.success) throw new ApiError(400, "Invalid mode.");
  const durationMs = Number(form?.get("durationMs")) || null;
  const label = String(form?.get("label") ?? "").slice(0, 200) || null;
  await purgeExpired(user.id);
  const rec = await db.recording.create({
    data: {
      userId: user.id,
      mode: mode.data,
      mimeType: file.type.split(";")[0]!,
      data: Buffer.from(await file.arrayBuffer()),
      sizeBytes: file.size,
      durationMs,
      label,
      expiresAt: new Date(Date.now() + (user.settings.recordingRetentionDays ?? 30) * 86400_000),
    },
    select: { id: true },
  });
  return NextResponse.json({ id: rec.id });
});

export const GET = withUser(async (_req, user) => {
  await purgeExpired(user.id);
  const list = await db.recording.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, mode: true, sizeBytes: true, durationMs: true, label: true, transcript: true, createdAt: true, expiresAt: true },
  });
  return NextResponse.json({ recordings: list });
});

export const DELETE = withUser(async (_req, user) => {
  const { count } = await db.recording.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ deleted: count });
});
