import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessonOverview } from "@/lib/progress";
import { assessment } from "@/content/assessment";
import { PageHeader } from "@/components/layout/page-header";
import { AssessmentWizard } from "./wizard";

export const metadata = { title: "Level Assessment" };

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const ov = await lessonOverview(user.id);
  const [baseline, final] = await Promise.all([
    db.assessment.findUnique({ where: { userId_kind: { userId: user.id, kind: "BASELINE" } } }),
    db.assessment.findUnique({ where: { userId_kind: { userId: user.id, kind: "FINAL" } } }),
  ]);
  const finalUnlocked = ov.completed >= 29;
  const kind = sp.kind === "FINAL" && finalUnlocked ? "FINAL" : baseline && finalUnlocked ? "FINAL" : "BASELINE";
  const existing = kind === "FINAL" ? final : baseline;
  const canTake = kind === "FINAL" ? finalUnlocked : !baseline || ov.completed === 0;
  return (
    <div>
      <PageHeader
        back="/dashboard"
        title={kind === "FINAL" ? "Day 30 Final Assessment" : "English Level Assessment"}
        subtitle={kind === "FINAL" ? "The same tasks as Day 1 — let's see how far you've come." : "A 15-minute baseline: speaking, listening and writing. You'll repeat it on Day 30."}
      />
      {sp.kind === "FINAL" && !finalUnlocked && (
        <p className="mb-4 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm">The final assessment unlocks on Day 30 ({ov.completed}/30 lessons completed). Showing your baseline instead.</p>
      )}
      <AssessmentWizard
        kind={kind}
        content={assessment}
        canTake={canTake}
        existing={existing ? { overall: existing.overall, level: existing.level, scores: existing.scores as never, completedAt: existing.completedAt.toISOString(), live: existing.live } : null}
      />
    </div>
  );
}
