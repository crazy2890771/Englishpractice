import { and, eq } from "drizzle-orm";
import { asUser, schema } from "@/db";
import { getLearner } from "@/server/learner";
import { analytics } from "@/server/analytics";
import { listRecordings } from "@/server/recordings";
import { WEAKNESS_CATEGORIES } from "@/content/tags";
import { ProgressClient } from "./client";

export const metadata = { title: "พัฒนาการ" };

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const learner = await getLearner();
  const sp = await searchParams;
  const { data, active, recordings } = await asUser(learner.id, async (tx) => {
    const act = (await tx.select().from(schema.userLanguages).where(and(eq(schema.userLanguages.userId, learner.id), eq(schema.userLanguages.active, true)))).map((r) => r.languageId);
    const language = (sp.lang === "zh" || sp.lang === "en" ? sp.lang : act[0] ?? "en") as "en" | "zh";
    return { data: { language, ...(await analytics(tx, learner.id, language, learner.profile.timezone)) }, active: act, recordings: await listRecordings(tx, learner.id, language) };
  });
  const cats = Object.fromEntries(WEAKNESS_CATEGORIES.map((c) => [c.id, { th: c.nameTh, en: c.nameEn }]));
  return <ProgressClient data={JSON.parse(JSON.stringify(data))} languages={active.length ? active : ["en"]} categories={cats} recordings={recordings} />;
}
