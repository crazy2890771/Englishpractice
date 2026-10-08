import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLesson } from "@/content/curriculum";
import { lessonOverview } from "@/lib/progress";
import { chooseVariant } from "@/lib/listening";
import { shadowingId } from "@/content/shadowing-index";
import { EmptyState } from "@/components/ui";
import { LessonWorkspace } from "./workspace";

export async function generateMetadata({ params }: { params: Promise<{ day: string }> }) {
  const day = Number((await params).day);
  const lesson = getLesson(day);
  return { title: lesson ? `Day ${day}: ${lesson.title}` : "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<{ day: string }> }) {
  const day = Number((await params).day);
  const lesson = getLesson(day);
  if (!lesson) notFound();
  const user = await requireUser();
  const ov = await lessonOverview(user.id);
  const state = ov.days[day - 1]!;
  if (state.status === "locked") {
    return (
      <EmptyState icon={<Lock className="h-8 w-8" />} title={`Day ${day} is locked`} action={<Link href={`/lesson/${ov.currentDay}`} className="btn-primary">Go to Day {ov.currentDay}</Link>}>
        Complete the previous lesson to unlock “{lesson.title}”.
      </EmptyState>
    );
  }
  // Adaptive listening difficulty from recent accuracy (prior days only).
  const recent = await db.exerciseAttempt.findMany({
    where: { userId: user.id, mode: "LISTENING", NOT: { day } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { score: true, maxScore: true },
  });
  const progress = await db.lessonProgress.findUnique({ where: { userId_day: { userId: user.id, day } } });
  const stored = (progress?.stepData as { listeningVariant?: "standard" | "challenge" } | null)?.listeningVariant;
  const variant = stored ?? chooseVariant(recent.map((a) => (a.maxScore ? ((a.score ?? 0) / a.maxScore) * 100 : 0)), user.level);
  if (!stored) {
    await db.lessonProgress.upsert({
      where: { userId_day: { userId: user.id, day } },
      create: { userId: user.id, day, stepData: { listeningVariant: variant } },
      update: { stepData: { ...((progress?.stepData as object) ?? {}), listeningVariant: variant } },
    });
  }

  return (
    <LessonWorkspace
      lesson={lesson}
      variant={variant}
      shadowing={lesson.shadowing.map((s, i) => ({ ...s, id: shadowingId(day, i) }))}
      initial={{ completedSteps: state.completedSteps, secondsSpent: state.secondsSpent, status: state.status }}
      nextDay={day < 30 ? day + 1 : null}
    />
  );
}
