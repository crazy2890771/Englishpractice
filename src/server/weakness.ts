import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import { getExercise } from "@/content";
import { evaluateWeakness, focusCategories, type WeaknessStatus } from "@/engine/weakness";
import type { LanguageId } from "@/content/types";

const DAY = 86_400_000;

/** Re-evaluates the given categories from evidence (mistakes + tagged attempts). */
export async function refreshWeaknesses(tx: Tx, userId: string, language: LanguageId, categoryIds: string[], now = new Date()) {
  const ids = [...new Set(categoryIds)].filter((c) => c.startsWith(`${language}.`));
  if (!ids.length) return;
  const since = new Date(now.getTime() - 90 * DAY);
  const mistakes = await tx
    .select({ categoryId: schema.mistakeRecords.categoryId, at: schema.mistakeRecords.createdAt, exerciseId: schema.mistakeRecords.exerciseId })
    .from(schema.mistakeRecords)
    .where(and(eq(schema.mistakeRecords.userId, userId), inArray(schema.mistakeRecords.categoryId, ids), gte(schema.mistakeRecords.createdAt, since)));
  const attempts = await tx
    .select({ exerciseId: schema.exerciseAttempts.exerciseId, score: schema.exerciseAttempts.score, at: schema.exerciseAttempts.createdAt })
    .from(schema.exerciseAttempts)
    .where(and(eq(schema.exerciseAttempts.userId, userId), eq(schema.exerciseAttempts.languageId, language), gte(schema.exerciseAttempts.createdAt, since)))
    .orderBy(desc(schema.exerciseAttempts.createdAt))
    .limit(400);
  const existing = await tx.select().from(schema.userWeaknesses).where(and(eq(schema.userWeaknesses.userId, userId), inArray(schema.userWeaknesses.categoryId, ids)));

  for (const cat of ids) {
    const prev = existing.find((w) => w.categoryId === cat);
    const ms = mistakes.filter((m) => m.categoryId === cat);
    if (!ms.length && !prev) continue;
    const tagged = attempts.filter((a) => getExercise(a.exerciseId)?.exercise.tags.includes(cat)).map((a) => ({ at: a.at, score: a.score }));
    const r = evaluateWeakness({ mistakes: ms.map((m) => ({ at: m.at, exerciseId: m.exerciseId })), taggedAttempts: tagged, previousStatus: (prev?.status as WeaknessStatus) ?? null }, now);
    const today = now.toISOString().slice(0, 10);
    const history = ((prev?.history as { date: string; mastery: number; status: string }[]) ?? []).filter((h) => h.date !== today);
    history.push({ date: today, mastery: r.mastery, status: r.status });
    await tx
      .insert(schema.userWeaknesses)
      .values({
        userId,
        categoryId: cat,
        languageId: language,
        status: r.status,
        firstDetectedAt: prev?.firstDetectedAt ?? ms[0]?.at ?? now,
        lastSeenAt: r.lastSeenAt ?? prev?.lastSeenAt ?? now,
        occurrences: r.occurrences,
        recentOccurrences: r.recentOccurrences,
        mastery: r.mastery,
        history: history.slice(-60),
      })
      .onConflictDoUpdate({
        target: [schema.userWeaknesses.userId, schema.userWeaknesses.categoryId],
        set: { status: r.status, lastSeenAt: r.lastSeenAt ?? prev?.lastSeenAt ?? now, occurrences: r.occurrences, recentOccurrences: r.recentOccurrences, mastery: r.mastery, history: history.slice(-60), updatedAt: now },
      });
  }
}

export async function focusTagsFor(tx: Tx, userId: string, language: LanguageId) {
  const rows = await tx.select().from(schema.userWeaknesses).where(and(eq(schema.userWeaknesses.userId, userId), eq(schema.userWeaknesses.languageId, language)));
  return focusCategories(rows.map((r) => ({ ...r, status: r.status as WeaknessStatus })));
}

export async function weaknessCount(tx: Tx, userId: string, language: LanguageId) {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.userWeaknesses)
    .where(and(eq(schema.userWeaknesses.userId, userId), eq(schema.userWeaknesses.languageId, language), inArray(schema.userWeaknesses.status, ["active", "improving"])));
  return r?.n ?? 0;
}
