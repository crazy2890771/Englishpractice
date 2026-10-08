import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, withUser } from "@/lib/api";
import { getLesson } from "@/content/curriculum";
import { isDayUnlocked, lessonOverview } from "@/lib/progress";
import { addLessonVocabulary } from "@/lib/mistakes";

/** Starts (or resumes) a lesson: marks it in progress and adds its vocabulary to the flashcard deck. */
export const POST = withUser<{ day: string }>(async (_req, user, { params }) => {
  const day = Number((await params).day);
  const lesson = getLesson(day);
  if (!lesson) throw new ApiError(404, "Lesson not found.");
  const ov = await lessonOverview(user.id);
  if (!isDayUnlocked(ov, day)) throw new ApiError(403, "Finish the previous lesson to unlock this day.");
  const progress = await db.lessonProgress.upsert({
    where: { userId_day: { userId: user.id, day } },
    create: { userId: user.id, day, status: "in_progress", startedAt: new Date() },
    update: {},
  });
  if (progress.status === "not_started") {
    await db.lessonProgress.update({ where: { id: progress.id }, data: { status: "in_progress", startedAt: new Date() } });
  }
  await addLessonVocabulary(user.id, day, lesson.vocabulary);
  return NextResponse.json({ progress });
});
