import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, withUser } from "@/lib/api";
import { findListeningExercise } from "@/content/listening-index";
import { gradeListening } from "@/lib/listening";

const schema = z.object({
  exerciseId: z.string().max(60),
  day: z.number().int().min(1).max(30).optional(),
  answers: z.record(z.union([z.string().max(200), z.number().int(), z.null()])),
  playbackRate: z.number().min(0.5).max(2).optional(),
  replays: z.number().int().min(0).max(100).optional(),
  durationSec: z.number().int().min(0).max(7200).optional(),
});

export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, schema);
  const ex = findListeningExercise(body.exerciseId);
  if (!ex) throw new ApiError(404, "Exercise not found.");
  const graded = gradeListening(ex, body.answers);
  const attempt = await db.exerciseAttempt.create({
    data: {
      userId: user.id,
      day: body.day ?? null,
      mode: "LISTENING",
      exerciseId: ex.id,
      score: graded.score,
      maxScore: graded.max,
      durationSec: body.durationSec ?? 0,
      data: { answers: body.answers, level: ex.level, accent: ex.accent, playbackRate: body.playbackRate ?? 1, replays: body.replays ?? 0 },
    },
  });
  return NextResponse.json({ attemptId: attempt.id, ...graded });
});
