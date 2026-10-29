import { and, eq } from "drizzle-orm";
import { asUser, schema } from "@/db";
import { getLearner, providerFor } from "@/server/learner";
import { getSkillProgress } from "@/server/curriculum";
import { countDue } from "@/server/vocab";
import { PracticeClient } from "./client";

export const metadata = { title: "ฝึกฝน" };

export default async function PracticePage() {
  const learner = await getLearner();
  const data = await asUser(learner.id, async (tx) => {
    const active = (await tx.select().from(schema.userLanguages).where(and(eq(schema.userLanguages.userId, learner.id), eq(schema.userLanguages.active, true)))).map((r) => r.languageId);
    const langs = active.length ? active : ["en"];
    const status = await Promise.all(
      langs.map(async (l) => ({ language: l, placed: (await getSkillProgress(tx, learner.id, l as "en" | "zh")).length > 0, due: await countDue(tx, learner.id, l as "en" | "zh") })),
    );
    return status;
  });
  return <PracticeClient languages={data} aiEnabled={!!providerFor(learner.profile)} defaultTopics={learner.profile.topics} />;
}
