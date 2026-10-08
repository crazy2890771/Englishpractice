import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, withUser } from "@/lib/api";
import { review } from "@/lib/srs";
import { answersMatch } from "@/lib/text";

const schema = z.object({
  /** Typed correction (correction exercise). If omitted, `quality` from a flashcard self-rating is used. */
  answer: z.string().max(400).optional(),
  quality: z.number().int().min(0).max(5).optional(),
  day: z.number().int().min(1).max(30).optional(),
});

export const POST = withUser<{ id: string }>(async (req, user, { params }) => {
  const { id } = await params;
  const body = await parseBody(req, schema);
  const m = await db.mistake.findFirst({ where: { id, userId: user.id } });
  if (!m) throw new ApiError(404, "Mistake not found.");

  let correct: boolean;
  let quality: number;
  if (body.answer !== undefined) {
    correct = answersMatch(body.answer, m.corrected, m.natural ? [m.natural] : []);
    quality = correct ? 4 : 1;
  } else {
    quality = body.quality ?? 0;
    correct = quality >= 3;
  }
  const next = review(m, quality);
  const updated = await db.mistake.update({
    where: { id: m.id },
    data: { ...next, lastReviewedAt: new Date(), reviews: { create: { correct, quality, answer: body.answer } } },
  });
  await db.exerciseAttempt.create({
    data: { userId: user.id, day: body.day ?? null, mode: "REVIEW", exerciseId: `mistake:${m.id}`, score: correct ? 1 : 0, maxScore: 1 },
  });
  return NextResponse.json({ correct, expected: m.corrected, mistake: updated });
});

