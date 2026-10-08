import "server-only";
import { db } from "./db";
import { addDays, isoDate } from "./dates";
import { sectionPercent } from "./assessment";

function label(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Aggregates real learner activity for the analytics page. */
export async function analytics(userId: string, startDate: Date, today: string) {
  const start = isoDate(startDate);
  const [studyDays, listening, writings, convos, shadowing, mistakes, vocab, lessons] = await Promise.all([
    db.studyDay.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    db.exerciseAttempt.findMany({ where: { userId, mode: "LISTENING" }, orderBy: { createdAt: "asc" } }),
    db.writingSubmission.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { createdAt: true, scores: true, feedback: true } }),
    db.exerciseAttempt.findMany({ where: { userId, mode: { in: ["SPEAKING", "ROLEPLAY"] } }, orderBy: { createdAt: "asc" } }),
    db.exerciseAttempt.findMany({ where: { userId, mode: "SHADOWING" }, orderBy: { createdAt: "asc" }, select: { createdAt: true, score: true } }),
    db.mistake.findMany({ where: { userId }, select: { category: true, mastered: true, createdAt: true } }),
    db.vocabularyItem.findMany({ where: { userId }, select: { mastered: true, reviewCount: true } }),
    db.lessonProgress.findMany({ where: { userId }, select: { day: true, status: true, completedAt: true, secondsSpent: true } }),
  ]);

  // Daily minutes for the program window (30 days from start, or the last 30 days).
  const windowStart = today < addDays(start, 29) ? start : addDays(today, -29);
  const minutesMap = new Map(studyDays.map((d) => [d.date, d.seconds]));
  const daily = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(windowStart, i);
    return { date, label: date.slice(5).replace("-", "/"), minutes: Math.round((minutesMap.get(date) ?? 0) / 60) };
  }).filter((d) => d.date <= today);

  const listeningTrend = listening.map((a, i) => ({ label: `#${i + 1}`, date: label(a.createdAt), accuracy: a.maxScore ? Math.round(((a.score ?? 0) / a.maxScore) * 100) : 0 }));
  const writingTrend = writings.map((w, i) => {
    const s = w.scores as Record<string, number>;
    return { label: `#${i + 1}`, date: label(w.createdAt), overall: sectionPercent(s), grammar: Math.round((s.grammar ?? 0) * 20), coherence: Math.round((s.coherence ?? 0) * 20) };
  });
  const speakingTrend = convos.filter((c) => c.score !== null).map((c, i) => ({ label: `#${i + 1}`, date: label(c.createdAt), score: Math.round(((c.score ?? 0) / (c.maxScore ?? 20)) * 100) }));

  const shadowByDay = new Map<string, number[]>();
  for (const s of shadowing) {
    const k = label(s.createdAt);
    shadowByDay.set(k, [...(shadowByDay.get(k) ?? []), s.score ?? 0]);
  }
  const shadowTrend = [...shadowByDay.entries()].map(([k, v]) => ({ label: k, accuracy: Math.round(v.reduce((a, b) => a + b, 0) / v.length) }));

  const byCat: Record<string, number> = {};
  for (const m of mistakes) byCat[m.category] = (byCat[m.category] ?? 0) + 1;
  const categories = Object.entries(byCat).map(([name, value]) => ({ name: name[0] + name.slice(1).toLowerCase(), value }));

  const weaknessCount: Record<string, number> = {};
  for (const w of writings) for (const x of ((w.feedback as { weaknesses?: string[] })?.weaknesses ?? [])) weaknessCount[x] = (weaknessCount[x] ?? 0) + 1;
  const weaknesses = Object.entries(weaknessCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Weekly reports by program week (7-day blocks from the start date).
  const weeks = [1, 2, 3, 4].map((w) => {
    const from = addDays(start, (w - 1) * 7);
    const to = addDays(start, w === 4 ? 29 : w * 7 - 1);
    const inRange = (d: Date) => {
      const x = isoDate(d);
      return x >= from && x <= to;
    };
    const minutes = Math.round(studyDays.filter((d) => d.date >= from && d.date <= to).reduce((s, d) => s + d.seconds, 0) / 60);
    const lAcc = listening.filter((a) => inRange(a.createdAt));
    const wr = writings.filter((x) => inRange(x.createdAt));
    const sp = convos.filter((c) => inRange(c.createdAt) && c.score !== null);
    return {
      week: w,
      from,
      to,
      started: from <= today,
      minutes,
      lessonsCompleted: lessons.filter((l) => l.completedAt && inRange(l.completedAt)).length,
      listening: lAcc.length ? Math.round((lAcc.reduce((s, a) => s + (a.maxScore ? (a.score ?? 0) / a.maxScore : 0), 0) / lAcc.length) * 100) : null,
      writing: wr.length ? Math.round(wr.reduce((s, x) => s + sectionPercent(x.scores as Record<string, number>), 0) / wr.length) : null,
      speaking: sp.length ? Math.round(sp.reduce((s, c) => s + (c.score ?? 0) / (c.maxScore ?? 20), 0) / sp.length * 100) : null,
      newMistakes: mistakes.filter((m) => inRange(m.createdAt)).length,
    };
  });

  return {
    totals: {
      minutes: Math.round(studyDays.reduce((s, d) => s + d.seconds, 0) / 60),
      lessonsCompleted: lessons.filter((l) => l.status === "completed").length,
      mistakes: mistakes.length,
      mistakesMastered: mistakes.filter((m) => m.mastered).length,
      vocab: vocab.length,
      vocabMastered: vocab.filter((v) => v.mastered).length,
      listeningAttempts: listening.length,
      writingSubmissions: writings.length,
    },
    daily,
    listeningTrend,
    writingTrend,
    speakingTrend,
    shadowTrend,
    categories,
    weaknesses,
    weeks,
  };
}
