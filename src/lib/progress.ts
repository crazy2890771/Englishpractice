import "server-only";
import { db } from "./db";
import { getLesson, LESSON_STEPS, STEP_IDS, TOTAL_DAYS, type StepId } from "@/content/curriculum";
import { wordCount } from "./text";
import { addDays, computeStreak, isoDate } from "./dates";
import { bandToPercent } from "./ai/schemas";

export type LessonStatus = "locked" | "available" | "in_progress" | "completed";

export async function lessonOverview(userId: string) {
  const rows = await db.lessonProgress.findMany({ where: { userId } });
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const days = Array.from({ length: TOTAL_DAYS }, (_, i) => {
    const day = i + 1;
    const p = byDay.get(day);
    const prevDone = day === 1 || byDay.get(day - 1)?.status === "completed";
    const status: LessonStatus =
      p?.status === "completed" ? "completed" : p?.status === "in_progress" ? "in_progress" : prevDone ? "available" : "locked";
    return {
      day,
      status,
      completedSteps: (p?.completedSteps ?? []) as StepId[],
      secondsSpent: p?.secondsSpent ?? 0,
      completedAt: p?.completedAt ?? null,
    };
  });
  const completed = days.filter((d) => d.status === "completed").length;
  const current = days.find((d) => d.status !== "completed" && d.status !== "locked") ?? days[TOTAL_DAYS - 1]!;
  return { days, completed, currentDay: current.day, percent: Math.round((completed / TOTAL_DAYS) * 100) };
}

export function isDayUnlocked(overview: Awaited<ReturnType<typeof lessonOverview>>, day: number) {
  return overview.days[day - 1]?.status !== "locked";
}

/**
 * Checks real evidence in the database for a lesson step. Completion reflects
 * finished exercises, never elapsed time.
 */
export async function verifyStep(userId: string, day: number, step: StepId): Promise<{ ok: boolean; detail: string }> {
  const lesson = getLesson(day);
  if (!lesson) return { ok: false, detail: "Unknown lesson." };
  const c = lesson.completion;
  switch (step) {
    case "speaking": {
      const turns = await db.message.count({
        where: { role: "user", conversation: { userId, day, mode: { in: ["SPEAKING", "ROLEPLAY"] } } },
      });
      return { ok: turns >= c.speakingTurns, detail: `${turns}/${c.speakingTurns} speaking turns` };
    }
    case "listening": {
      const attempts = await db.exerciseAttempt.findMany({ where: { userId, day, mode: "LISTENING" } });
      const best = Math.max(0, ...attempts.map((a) => (a.maxScore ? ((a.score ?? 0) / a.maxScore) * 100 : 0)));
      const ok = best >= c.listeningMinPercent || attempts.length >= 2;
      return { ok, detail: attempts.length ? `best score ${Math.round(best)}% (${attempts.length} attempt${attempts.length > 1 ? "s" : ""})` : "not attempted" };
    }
    case "writing": {
      const subs = await db.writingSubmission.findMany({ where: { userId, day }, select: { text: true } });
      const best = Math.max(0, ...subs.map((s) => wordCount(s.text)));
      return { ok: best >= c.writingMinWords, detail: subs.length ? `${best} words submitted` : "no submission yet" };
    }
    case "shadowing": {
      const attempts = await db.exerciseAttempt.findMany({
        where: { userId, day, mode: "SHADOWING" },
        select: { exerciseId: true },
        distinct: ["exerciseId"],
      });
      return { ok: attempts.length >= c.shadowingSentences, detail: `${attempts.length}/${c.shadowingSentences} sentences practised` };
    }
    case "review": {
      const [done, dueMistakes, dueVocab] = await Promise.all([
        db.exerciseAttempt.count({ where: { userId, day, mode: "REVIEW" } }),
        db.mistake.count({ where: { userId, mastered: false, dueAt: { lte: new Date() } } }),
        db.vocabularyItem.count({ where: { userId, mastered: false, dueAt: { lte: new Date() } } }),
      ]);
      const ok = done >= c.reviewItems || (done >= 1 && dueMistakes + dueVocab === 0);
      return { ok, detail: `${done}/${c.reviewItems} items reviewed` };
    }
  }
}

/** Re-verifies a step and updates lesson progress; completes the lesson when all steps are done. */
export async function markStep(userId: string, day: number, step: StepId) {
  const check = await verifyStep(userId, day, step);
  const progress = await db.lessonProgress.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, status: "in_progress", startedAt: new Date() },
    update: {},
  });
  if (!check.ok) return { ...check, progress };
  const steps = Array.from(new Set([...(progress.completedSteps as StepId[]), step])).filter((s) => STEP_IDS.includes(s));
  const allDone = STEP_IDS.every((s) => steps.includes(s));
  const updated = await db.lessonProgress.update({
    where: { id: progress.id },
    data: {
      completedSteps: steps,
      status: allDone ? "completed" : "in_progress",
      completedAt: allDone && !progress.completedAt ? new Date() : progress.completedAt,
    },
  });
  return { ...check, progress: updated };
}

export async function addStudyTime(userId: string, date: string, seconds: number, day?: number) {
  await db.studyDay.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, seconds },
    update: { seconds: { increment: seconds } },
  });
  if (day) {
    await db.lessonProgress.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, status: "in_progress", startedAt: new Date(), secondsSpent: seconds },
      update: { secondsSpent: { increment: seconds } },
    });
  }
}

const ACTIVE_DAY_SECONDS = 120;

export async function streakFor(userId: string, today: string) {
  const days = await db.studyDay.findMany({ where: { userId, seconds: { gte: ACTIVE_DAY_SECONDS } }, select: { date: true } });
  return computeStreak(days.map((d) => d.date), today);
}

export async function weeklyActivity(userId: string, today: string, span = 7) {
  const from = addDays(today, -(span - 1));
  const rows = await db.studyDay.findMany({ where: { userId, date: { gte: from, lte: today } } });
  const map = new Map(rows.map((r) => [r.date, r.seconds]));
  return Array.from({ length: span }, (_, i) => {
    const date = addDays(from, i);
    const d = new Date(`${date}T12:00:00Z`);
    return { date, label: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), minutes: Math.round((map.get(date) ?? 0) / 60) };
  });
}

type Bands = Record<string, number>;
function avgBands(list: Bands[], keys: string[]) {
  if (!list.length) return null;
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = list.reduce((s, b) => s + (b[k] ?? 0), 0) / list.length;
  return out;
}

/** Skill estimates (0–100) from the learner's most recent real activity. Null when there's no data. */
export async function skillsOverview(userId: string) {
  const [msgs, writings, listening, shadowing] = await Promise.all([
    db.message.findMany({
      where: { role: "user", conversation: { userId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { feedback: true },
    }),
    db.writingSubmission.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { scores: true } }),
    db.exerciseAttempt.findMany({ where: { userId, mode: "LISTENING" }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.exerciseAttempt.findMany({ where: { userId, mode: "SHADOWING" }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const sp = avgBands(
    msgs.map((m) => (m.feedback as { scores?: Bands } | null)?.scores).filter((x): x is Bands => !!x),
    ["grammar", "vocabulary", "fluency", "taskCompletion"],
  );
  const wr = avgBands(writings.map((w) => w.scores as Bands), ["grammar", "vocabulary", "clarity", "coherence", "taskCompletion"]);
  const listen = listening.length
    ? Math.round(listening.reduce((s, a) => s + (a.maxScore ? (a.score ?? 0) / a.maxScore : 0), 0) / listening.length * 100)
    : null;
  const shadow = shadowing.length ? Math.round(shadowing.reduce((s, a) => s + (a.score ?? 0), 0) / shadowing.length) : null;
  const pct = (v: number | undefined) => (v === undefined ? null : bandToPercent(v));
  return {
    speaking: sp ? Math.round(((sp.fluency! + sp.taskCompletion!) / 2 / 5) * 100) : null,
    grammar: sp || wr ? pct(((sp?.grammar ?? wr!.grammar!) + (wr?.grammar ?? sp!.grammar!)) / 2) : null,
    vocabulary: sp || wr ? pct(((sp?.vocabulary ?? wr!.vocabulary!) + (wr?.vocabulary ?? sp!.vocabulary!)) / 2) : null,
    writing: wr ? Math.round(((wr.grammar! + wr.vocabulary! + wr.clarity! + wr.coherence! + wr.taskCompletion!) / 25) * 100) : null,
    listening: listen,
    pronunciation: shadow,
  };
}

export async function dashboardData(userId: string, today = isoDate(new Date())) {
  const [overview, streak, week, skills, recentMistakes, dueMistakes, dueVocab, baseline] = await Promise.all([
    lessonOverview(userId),
    streakFor(userId, today),
    weeklyActivity(userId, today),
    skillsOverview(userId),
    db.mistake.findMany({ where: { userId, mastered: false }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.mistake.count({ where: { userId, mastered: false, dueAt: { lte: new Date() } } }),
    db.vocabularyItem.count({ where: { userId, mastered: false, dueAt: { lte: new Date() } } }),
    db.assessment.findUnique({ where: { userId_kind: { userId, kind: "BASELINE" } }, select: { id: true } }),
  ]);
  const current = overview.days[overview.currentDay - 1]!;
  const lesson = getLesson(overview.currentDay)!;
  return {
    overview,
    streak,
    week,
    skills,
    recentMistakes,
    due: dueMistakes + dueVocab,
    hasBaseline: !!baseline,
    current: {
      day: current.day,
      title: lesson.title,
      summary: lesson.summary,
      week: lesson.week,
      status: current.status,
      stepsDone: current.completedSteps.length,
      stepsTotal: LESSON_STEPS.length,
      completedSteps: current.completedSteps,
    },
  };
}
