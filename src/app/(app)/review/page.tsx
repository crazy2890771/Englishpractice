import { asUser } from "@/db";
import { getLearner } from "@/server/learner";
import { dueVocabulary } from "@/server/vocab";
import { ReviewClient } from "./client";

export const metadata = { title: "ทบทวนคำศัพท์" };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const language = lang === "en" || lang === "zh" ? lang : null;
  const learner = await getLearner();
  const items = await asUser(learner.id, (tx) => dueVocabulary(tx, learner.id, language, learner.profile.reviewMaxPerDay));
  return (
    <ReviewClient
      items={items.map((v) => ({ id: v.id, languageId: v.languageId, word: v.word, pronunciation: v.pronunciation, meaningTh: v.meaningTh, meaningEn: v.meaningEn, example: v.example, exampleTranslation: v.exampleTranslation }))}
    />
  );
}
