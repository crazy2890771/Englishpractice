import "server-only";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import type { LanguageId, Unit } from "@/content/types";
import { familiarity, reviewItem } from "@/engine/srs";

/** Adds a unit's vocabulary to the learner's deck (idempotent). New words are due immediately. */
export async function addUnitVocabulary(tx: Tx, userId: string, unit: Unit) {
  if (!unit.vocabulary.length) return;
  await tx
    .insert(schema.vocabularyItems)
    .values(
      unit.vocabulary.map((v) => ({
        userId,
        languageId: unit.language,
        word: v.word,
        pronunciation: v.pronunciation ?? null,
        meaningTh: v.meaningTh,
        meaningEn: v.meaningEn,
        example: v.example,
        exampleTranslation: v.exampleTh,
        difficulty: v.difficulty,
        sourceUnitId: unit.id,
      })),
    )
    .onConflictDoNothing();
}

export async function dueVocabulary(tx: Tx, userId: string, language: LanguageId | null, max: number, now = new Date()) {
  const where = [eq(schema.vocabularyItems.userId, userId), lte(schema.vocabularyItems.dueAt, now)];
  if (language) where.push(eq(schema.vocabularyItems.languageId, language));
  // Overdue first, then words with more lapses (recurring difficulty).
  return tx
    .select()
    .from(schema.vocabularyItems)
    .where(and(...where))
    .orderBy(asc(schema.vocabularyItems.dueAt), sql`${schema.vocabularyItems.lapses} desc`)
    .limit(max);
}

export async function countDue(tx: Tx, userId: string, language?: LanguageId, now = new Date()) {
  const where = [eq(schema.vocabularyItems.userId, userId), lte(schema.vocabularyItems.dueAt, now)];
  if (language) where.push(eq(schema.vocabularyItems.languageId, language));
  const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.vocabularyItems).where(and(...where));
  return r?.n ?? 0;
}

export async function reviewVocabulary(tx: Tx, userId: string, itemId: string, quality: number, mode: string, now = new Date()) {
  const [item] = await tx.select().from(schema.vocabularyItems).where(and(eq(schema.vocabularyItems.id, itemId), eq(schema.vocabularyItems.userId, userId)));
  if (!item) return null;
  const next = reviewItem(item, quality, now);
  const [updated] = await tx
    .update(schema.vocabularyItems)
    .set({ easeFactor: next.easeFactor, intervalDays: next.intervalDays, repetitions: next.repetitions, lapses: next.lapses, dueAt: next.dueAt, lastReviewedAt: now })
    .where(eq(schema.vocabularyItems.id, item.id))
    .returning();
  await tx.insert(schema.vocabularyReviews).values({ userId, itemId: item.id, quality, correct: next.correct, mode, intervalDays: next.intervalDays, reviewedAt: now });
  return { item: updated!, correct: next.correct, familiarity: familiarity(updated!) };
}
