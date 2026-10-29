import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { asUser, schema } from "@/db";
import { getLearner } from "@/server/learner";

export default async function LearnIndex() {
  const learner = await getLearner();
  const rows = await asUser(learner.id, (tx) => tx.select().from(schema.userLanguages).where(and(eq(schema.userLanguages.userId, learner.id), eq(schema.userLanguages.active, true))));
  redirect(`/learn/${rows[0]?.languageId ?? "en"}`);
}
