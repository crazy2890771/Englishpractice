import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { chooseVariant } from "@/lib/listening";
import { PageHeader } from "@/components/layout/page-header";
import { ListeningLibrary } from "./library";

export const metadata = { title: "Listening Challenge" };

export default async function ListeningPage() {
  const user = await requireUser();
  const attempts = await db.exerciseAttempt.findMany({
    where: { userId: user.id, mode: "LISTENING" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { exerciseId: true, score: true, maxScore: true },
  });
  const best: Record<string, number> = {};
  for (const a of attempts) {
    const p = a.maxScore ? Math.round(((a.score ?? 0) / a.maxScore) * 100) : 0;
    best[a.exerciseId] = Math.max(best[a.exerciseId] ?? 0, p);
  }
  const recommended = chooseVariant(attempts.slice(0, 3).map((a) => (a.maxScore ? ((a.score ?? 0) / a.maxScore) * 100 : 0)), user.level);
  return (
    <div>
      <PageHeader back="/dashboard" title="Listening Challenge" subtitle="Listen first, answer, then review the transcript. Adjust speed and replay as often as you need." />
      <ListeningLibrary best={best} recommended={recommended} />
    </div>
  );
}
