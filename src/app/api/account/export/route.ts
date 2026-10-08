import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUser } from "@/lib/api";

/** Exports all learner data (excluding audio bytes) as JSON. */
export const GET = withUser(async (_req, user) => {
  const userId = user.id;
  const [lessons, conversations, writings, attempts, mistakes, vocabulary, assessments, studyDays, recordings] = await Promise.all([
    db.lessonProgress.findMany({ where: { userId } }),
    db.conversation.findMany({ where: { userId }, include: { messages: true } }),
    db.writingSubmission.findMany({ where: { userId } }),
    db.exerciseAttempt.findMany({ where: { userId } }),
    db.mistake.findMany({ where: { userId }, include: { reviews: true } }),
    db.vocabularyItem.findMany({ where: { userId } }),
    db.assessment.findMany({ where: { userId } }),
    db.studyDay.findMany({ where: { userId } }),
    db.recording.findMany({ where: { userId }, select: { id: true, mode: true, transcript: true, createdAt: true, sizeBytes: true } }),
  ]);
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), user: { name: user.name, email: user.email, level: user.level }, lessons, conversations, writings, attempts, mistakes, vocabulary, assessments, studyDays, recordings },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="english-fluency-lab-export.json"` },
  });
});
