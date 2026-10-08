import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { VocabularyDeck } from "./deck";

export const metadata = { title: "Vocabulary Flashcards" };

export default async function VocabularyPage() {
  const user = await requireUser();
  const items = await db.vocabularyItem.findMany({ where: { userId: user.id }, orderBy: [{ day: "asc" }, { createdAt: "asc" }] });
  return (
    <div>
      <PageHeader back="/dashboard" title="Vocabulary" subtitle="Words from your lessons and your own additions, reviewed with spaced repetition." />
      <VocabularyDeck initial={items.map((v) => ({ id: v.id, word: v.word, definition: v.definition, example: v.example, day: v.day, mastered: v.mastered, successStreak: v.successStreak, dueAt: v.dueAt.toISOString() }))} />
    </div>
  );
}
