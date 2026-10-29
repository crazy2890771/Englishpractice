import "server-only";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import type { LanguageId } from "@/content/types";
import { SKILLS } from "@/content/types";
import { addDays, localDay, weeklyConsistency } from "@/engine/schedule";
import { familiarity } from "@/engine/srs";
import { getSkillProgress } from "./curriculum";

/** Real activity only — every figure is computed from stored attempts, sessions and reviews. */
export async function analytics(tx: Tx, userId: string, language: LanguageId, timeZone: string) {
  const today = localDay(new Date(), timeZone).date;
  const from28 = addDays(today, -27);
  const [progress, snapshots, logs, sessions, vocab, reviews, results, weaknesses, unitDone, attempts30] = await Promise.all([
    getSkillProgress(tx, userId, language),
    tx.select().from(schema.progressSnapshots).where(and(eq(schema.progressSnapshots.userId, userId), eq(schema.progressSnapshots.languageId, language))).orderBy(asc(schema.progressSnapshots.snapshotDate)),
    tx.select().from(schema.studyLog).where(and(eq(schema.studyLog.userId, userId), gte(schema.studyLog.logDate, addDays(today, -7 * 12)))),
    tx.select({ status: schema.studySessions.status, kind: schema.studySessions.kind, languageId: schema.studySessions.languageId, activeSeconds: schema.studySessions.activeSeconds }).from(schema.studySessions).where(eq(schema.studySessions.userId, userId)),
    tx.select().from(schema.vocabularyItems).where(and(eq(schema.vocabularyItems.userId, userId), eq(schema.vocabularyItems.languageId, language))),
    tx
      .select({ correct: schema.vocabularyReviews.correct, at: schema.vocabularyReviews.reviewedAt })
      .from(schema.vocabularyReviews)
      .innerJoin(schema.vocabularyItems, eq(schema.vocabularyItems.id, schema.vocabularyReviews.itemId))
      .where(and(eq(schema.vocabularyReviews.userId, userId), eq(schema.vocabularyItems.languageId, language), gte(schema.vocabularyReviews.reviewedAt, new Date(Date.now() - 84 * 86_400_000)))),
    tx.select().from(schema.assessmentResults).where(and(eq(schema.assessmentResults.userId, userId), eq(schema.assessmentResults.languageId, language))).orderBy(desc(schema.assessmentResults.createdAt)).limit(30),
    tx.select().from(schema.userWeaknesses).where(and(eq(schema.userWeaknesses.userId, userId), eq(schema.userWeaknesses.languageId, language))).orderBy(desc(schema.userWeaknesses.recentOccurrences)),
    tx.select({ n: sql<number>`count(*)::int` }).from(schema.unitProgress).where(and(eq(schema.unitProgress.userId, userId), eq(schema.unitProgress.status, "completed"), sql`${schema.unitProgress.unitId} like ${language + "-%"}`)),
    tx
      .select({ skill: schema.exerciseAttempts.skill, score: schema.exerciseAttempts.score })
      .from(schema.exerciseAttempts)
      .where(and(eq(schema.exerciseAttempts.userId, userId), eq(schema.exerciseAttempts.languageId, language), gte(schema.exerciseAttempts.createdAt, new Date(Date.now() - 30 * 86_400_000)))),
  ]);

  const langLogs = logs.filter((l) => l.languageId === language);
  const activity = Array.from({ length: 28 }, (_, i) => {
    const date = addDays(from28, i);
    return { date, minutes: Math.round(langLogs.filter((l) => l.logDate === date).reduce((s, l) => s + l.seconds, 0) / 60) };
  });
  const allActiveDates = [...new Set(logs.filter((l) => l.seconds >= 60).map((l) => l.logDate))];
  const consistency = weeklyConsistency(allActiveDates, today, 8);

  const skillSeries = Object.fromEntries(SKILLS.map((s) => [s, snapshots.filter((x) => x.skill === s).map((x) => ({ date: x.snapshotDate, accuracy: Math.round(x.accuracy * 100), attempts: x.attempts, level: x.levelCode }))]));
  const recentAccuracy = Object.fromEntries(
    SKILLS.map((s) => {
      const a = attempts30.filter((x) => x.skill === s);
      return [s, a.length ? Math.round((a.reduce((t, x) => t + x.score, 0) / a.length) * 100) : null];
    }),
  );

  // Vocabulary retention: share of correct recalls per week (last 12 weeks).
  const retention: { week: string; rate: number; reviews: number }[] = [];
  for (let w = 11; w >= 0; w--) {
    const start = Date.now() - (w + 1) * 7 * 86_400_000;
    const end = Date.now() - w * 7 * 86_400_000;
    const inWeek = reviews.filter((r) => r.at.getTime() >= start && r.at.getTime() < end);
    if (inWeek.length) retention.push({ week: new Date(start).toISOString().slice(0, 10), rate: Math.round((inWeek.filter((r) => r.correct).length / inWeek.length) * 100), reviews: inWeek.length });
  }
  const famBuckets = [0, 0, 0, 0, 0, 0];
  for (const v of vocab) famBuckets[familiarity(v)]! += 1;

  const recentMistakes = weaknesses.length
    ? await tx
        .select()
        .from(schema.mistakeRecords)
        .where(and(eq(schema.mistakeRecords.userId, userId), inArray(schema.mistakeRecords.categoryId, weaknesses.map((w) => w.categoryId))))
        .orderBy(desc(schema.mistakeRecords.createdAt))
        .limit(60)
    : [];

  const langSessions = sessions.filter((s) => s.languageId === language);
  return {
    profile: SKILLS.map((s) => {
      const p = progress.find((x) => x.skill === s);
      return { skill: s, level: p?.levelCode ?? null, placement: p?.placementLevel ?? null, recentAccuracy: recentAccuracy[s] };
    }),
    totals: {
      minutes: Math.round(langLogs.reduce((s, l) => s + l.seconds, 0) / 60),
      sessions: langSessions.filter((s) => s.status === "completed").length,
      unitsCompleted: unitDone[0]?.n ?? 0,
      vocab: vocab.length,
      vocabMature: vocab.filter((v) => v.intervalDays >= 21).length,
      consistentWeeks: consistency.filter((w) => w.days >= 3).length,
    },
    activity,
    consistency,
    skillSeries,
    retention,
    familiarity: famBuckets,
    assessments: results.map((r) => ({ id: r.id, kind: r.kind, skill: r.skill, level: r.levelCode, unitId: r.unitId, score: r.score, passed: r.passed, at: r.createdAt.toISOString(), sections: r.sectionScores, criteria: r.criteria })),
    weaknesses: weaknesses.map((w) => ({
      categoryId: w.categoryId,
      status: w.status,
      mastery: w.mastery,
      occurrences: w.occurrences,
      recent: w.recentOccurrences,
      firstDetectedAt: w.firstDetectedAt.toISOString(),
      lastSeenAt: w.lastSeenAt.toISOString(),
      history: w.history as { date: string; mastery: number; status: string }[],
      examples: recentMistakes.filter((m) => m.categoryId === w.categoryId).slice(0, 3).map((m) => ({ original: m.original, corrected: m.corrected, explanation: m.explanation, at: m.createdAt.toISOString() })),
    })),
  };
}
