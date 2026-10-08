import "server-only";
import type { Mode, MistakeCategory } from "@prisma/client";
import { db } from "./db";
import type { FeedbackItem } from "./ai/schemas";

const CAT: Record<FeedbackItem["category"], MistakeCategory> = {
  grammar: "GRAMMAR",
  vocabulary: "VOCABULARY",
  pronunciation: "PRONUNCIATION",
  expression: "EXPRESSION",
};

/**
 * Collects feedback items into the mistake notebook. A repeated mistake increases its
 * occurrence count, resets its mastery streak and makes it due again.
 */
export async function saveMistakes(userId: string, sourceMode: Mode, items: FeedbackItem[]) {
  const saved = [];
  for (const it of items.slice(0, 12)) {
    const original = it.original.trim().slice(0, 400);
    const corrected = it.corrected.trim().slice(0, 400);
    if (!original || !corrected || original.toLowerCase() === corrected.toLowerCase()) continue;
    saved.push(
      await db.mistake.upsert({
        where: { userId_original_corrected: { userId, original, corrected } },
        create: {
          userId,
          sourceMode,
          category: CAT[it.category],
          original,
          corrected,
          natural: it.natural || null,
          explanation: it.explanation.slice(0, 400),
        },
        update: { occurrences: { increment: 1 }, successStreak: 0, mastered: false, dueAt: new Date() },
      }),
    );
  }
  return saved;
}

export async function addLessonVocabulary(userId: string, day: number, items: { word: string; definition: string; example: string }[]) {
  for (const v of items) {
    await db.vocabularyItem.upsert({
      where: { userId_word: { userId, word: v.word } },
      create: { userId, day, word: v.word, definition: v.definition, example: v.example },
      update: {},
    });
  }
}
