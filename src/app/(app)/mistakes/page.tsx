import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { MistakeNotebook } from "./notebook";

export const metadata = { title: "Mistake Notebook" };

export default async function MistakesPage() {
  const user = await requireUser();
  const mistakes = await db.mistake.findMany({ where: { userId: user.id }, orderBy: [{ mastered: "asc" }, { dueAt: "asc" }] });
  return (
    <div>
      <PageHeader back="/dashboard" title="Mistake Hub" subtitle="Every correction from every mode, reviewed with spaced repetition until you master it." />
      <MistakeNotebook
        initial={mistakes.map((m) => ({ ...m, dueAt: m.dueAt.toISOString(), createdAt: m.createdAt.toISOString(), lastReviewedAt: m.lastReviewedAt?.toISOString() ?? null }))}
      />
    </div>
  );
}
