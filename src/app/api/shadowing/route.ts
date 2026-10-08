import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, withUser } from "@/lib/api";
import { compareWords } from "@/lib/text";
import { findShadowingSentence } from "@/content/shadowing-index";
import { saveMistakes } from "@/lib/mistakes";

const schema = z.object({
  exerciseId: z.string().max(60),
  day: z.number().int().min(1).max(30).optional(),
  transcript: z.string().trim().max(1000),
  durationMs: z.number().int().min(0).max(120000).optional(),
  referenceDurationMs: z.number().int().min(0).max(120000).optional(),
  recordingId: z.string().max(40).optional(),
});

/** Compares what the learner said (STT transcript) with the reference sentence. */
export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, schema);
  const ref = findShadowingSentence(body.exerciseId);
  if (!ref) throw new ApiError(404, "Sentence not found.");
  if (!body.transcript) throw new ApiError(400, "No speech was recognised. Try again a little louder, or type what you said.");
  const cmp = compareWords(ref.text, body.transcript);
  // Pace estimate only when both durations are known (not a phoneme-level assessment).
  let paceRatio: number | null = null;
  if (body.durationMs && body.referenceDurationMs) paceRatio = Math.round((body.durationMs / body.referenceDurationMs) * 100) / 100;

  await db.exerciseAttempt.create({
    data: {
      userId: user.id,
      day: body.day ?? null,
      mode: "SHADOWING",
      exerciseId: body.exerciseId,
      score: cmp.accuracy,
      maxScore: 100,
      durationSec: Math.round((body.durationMs ?? 0) / 1000),
      data: { transcript: body.transcript, tokens: cmp.tokens, paceRatio, recordingId: body.recordingId ?? null },
    },
  });
  const missed = cmp.tokens.filter((t) => t.kind === "missed" || t.kind === "wrong");
  if (cmp.accuracy < 70 && missed.length > 0) {
    await saveMistakes(user.id, "SHADOWING", [
      {
        original: body.transcript.slice(0, 400),
        corrected: ref.text,
        natural: "",
        category: "pronunciation",
        explanation: `Missed or unclear words: ${missed.map((t) => t.ref).filter(Boolean).slice(0, 6).join(", ")}. Focus: ${ref.focus}`,
      },
    ]);
  }
  return NextResponse.json({ ...cmp, paceRatio });
});
