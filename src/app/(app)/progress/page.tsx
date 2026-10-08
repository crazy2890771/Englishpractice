import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { analytics } from "@/lib/analytics";
import { isoDate, isValidIsoDate } from "@/lib/dates";
import { PageHeader } from "@/components/layout/page-header";
import { ActivityBars, CategoryPie, TrendLines } from "@/components/charts";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Progress Analytics" };

export default async function ProgressPage() {
  const user = await requireUser();
  const c = (await cookies()).get("efl_today")?.value;
  const today = c && isValidIsoDate(c) ? c : isoDate(new Date());
  const a = await analytics(user.id, user.startDate, today);
  const t = a.totals;
  return (
    <div className="space-y-6">
      <PageHeader
        back="/dashboard"
        title="Progress Analytics"
        subtitle="Real activity only — every number comes from exercises you completed. Scores are estimates, not certified assessments."
        actions={<Link href="/progress/compare" className="btn-primary">Day 1 vs Day 30 <ArrowRight className="h-4 w-4" aria-hidden /></Link>}
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Totals">
        <Tile label="Study time" value={`${Math.floor(t.minutes / 60)}h ${t.minutes % 60}m`} />
        <Tile label="Lessons completed" value={`${t.lessonsCompleted}/30`} />
        <Tile label="Mistakes mastered" value={`${t.mistakesMastered}/${t.mistakes}`} />
        <Tile label="Words mastered" value={`${t.vocabMastered}/${t.vocab}`} />
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Daily study minutes</h2>
        {a.daily.some((d) => d.minutes > 0) ? <ActivityBars data={a.daily} height={220} /> : <EmptyState title="No study time yet">Time is logged while you actively practise.</EmptyState>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="Listening accuracy (%)" empty={!a.listeningTrend.length}>
          <TrendLines data={a.listeningTrend} lines={[{ key: "accuracy", label: "Accuracy" }]} />
        </Chart>
        <Chart title="Speaking estimate (%)" empty={!a.speakingTrend.length}>
          <TrendLines data={a.speakingTrend} lines={[{ key: "score", label: "Avg rubric score" }]} />
        </Chart>
        <Chart title="Writing scores (%)" empty={!a.writingTrend.length}>
          <TrendLines data={a.writingTrend} lines={[{ key: "overall", label: "Overall" }, { key: "grammar", label: "Grammar" }, { key: "coherence", label: "Coherence" }]} />
        </Chart>
        <Chart title="Shadowing word accuracy (%)" empty={!a.shadowTrend.length}>
          <TrendLines data={a.shadowTrend} lines={[{ key: "accuracy", label: "Word accuracy" }]} />
        </Chart>
        <Chart title="Mistakes by category" empty={!a.categories.length}>
          <CategoryPie data={a.categories} />
        </Chart>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Recurring writing weaknesses</h2>
          {a.weaknesses.length ? (
            <ul className="space-y-2 text-sm">
              {a.weaknesses.map(([w, n]) => (
                <li key={w} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2"><span>{w}</span><span className="text-muted">{n}×</span></li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No writing yet">Weak areas appear after a few submissions.</EmptyState>
          )}
        </section>
      </div>

      <section aria-labelledby="weekly">
        <h2 id="weekly" className="mb-3 font-semibold">Weekly reports</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {a.weeks.map((w) => (
            <div key={w.week} className="card p-4 text-sm">
              <p className="font-semibold">Week {w.week}</p>
              <p className="text-xs text-muted">{w.from} → {w.to}</p>
              {!w.started ? (
                <p className="mt-3 text-muted">Not started yet.</p>
              ) : (
                <dl className="mt-3 space-y-1.5">
                  <Row k="Study time" v={`${w.minutes} min`} />
                  <Row k="Lessons completed" v={String(w.lessonsCompleted)} />
                  <Row k="Speaking" v={w.speaking === null ? "—" : `${w.speaking}%`} />
                  <Row k="Listening" v={w.listening === null ? "—" : `${w.listening}%`} />
                  <Row k="Writing" v={w.writing === null ? "—" : `${w.writing}%`} />
                  <Row k="New mistakes" v={String(w.newMistakes)} />
                </dl>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
function Chart({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {empty ? <EmptyState title="No data yet">Complete an exercise to see your trend.</EmptyState> : children}
    </section>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>;
}
