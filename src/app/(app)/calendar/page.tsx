import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Check, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { lessonOverview } from "@/lib/progress";
import { lessons, WEEKS, LESSON_STEPS } from "@/content/curriculum";
import { PageHeader } from "@/components/layout/page-header";
import { MountainScene } from "@/components/scenery";
import { Badge, ProgressBar } from "@/components/ui";
import { OfflineDownload } from "@/components/offline-download";

export const metadata = { title: "30-Day Journey" };

export default async function CalendarPage() {
  const user = await requireUser();
  const ov = await lessonOverview(user.id);
  const current = lessons.find((l) => l.day === ov.currentDay)!;
  return (
    <div className="space-y-6">
      <PageHeader back="/dashboard" title="30-Day Journey" subtitle="Your path to a more fluent you." />
      <div className="card p-4">
        <p className="mb-2 text-sm font-semibold">Going offline?</p>
        <OfflineDownload compact lessonDays={ov.days.filter((d) => d.status !== "locked").map((d) => d.day)} />
      </div>

      <section className="relative isolate overflow-hidden rounded-3xl border border-border p-6 text-white sm:p-8">
        <MountainScene variant="night" className="absolute inset-0 -z-10 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-slate-950/40" />
        <ol className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {WEEKS.map((w) => {
            const days = ov.days.filter((d) => lessons.find((l) => l.day === d.day)!.week === w.week);
            const done = days.filter((d) => d.status === "completed").length;
            const locked = days.every((d) => d.status === "locked");
            const isCurrent = current.week === w.week;
            return (
              <li key={w.week} className="flex flex-col items-center text-center">
                <span className={clsx("grid h-12 w-12 place-items-center rounded-full border-2", done === days.length ? "border-emerald-400 bg-emerald-500/30" : isCurrent ? "border-violet-300 bg-violet-500/40 shadow-[0_0_30px_rgb(167_139_250/0.7)]" : "border-white/30 bg-white/10")}>
                  {done === days.length ? <Check className="h-5 w-5" aria-hidden /> : locked ? <Lock className="h-4 w-4" aria-hidden /> : <span className="font-bold">{w.week}</span>}
                </span>
                <p className="mt-2 font-semibold">Week {w.week}</p>
                <p className="text-sm text-white/80">{w.title}</p>
                <p className="text-xs text-white/60">{w.subtitle} · {done}/{days.length}</p>
              </li>
            );
          })}
        </ol>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/15 bg-slate-950/50 p-4 backdrop-blur">
          <div>
            <p className="text-sm text-white/70">Day {current.day}</p>
            <p className="text-lg font-bold">{current.title}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{LESSON_STEPS.map((s) => <span key={s.id} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">{s.label}</span>)}</div>
          </div>
          <Link href={`/lesson/${current.day}`} className="grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-glow" aria-label={`Open Day ${current.day}`}>
            <ArrowRight className="h-6 w-6" aria-hidden />
          </Link>
        </div>
        <p className="mt-4 text-right font-script text-xl text-white/80">“Discipline today creates the freedom you want tomorrow.”</p>
      </section>

      <div className="flex items-center gap-3">
        <ProgressBar value={ov.percent} label="30-day completion" />
        <span className="shrink-0 text-sm font-semibold">{ov.percent}%</span>
      </div>

      {WEEKS.map((w) => (
        <section key={w.week} aria-labelledby={`w${w.week}`}>
          <h2 id={`w${w.week}`} className="mb-3 font-semibold">Week {w.week} — {w.title}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {lessons.filter((l) => l.week === w.week).map((l) => {
              const d = ov.days[l.day - 1]!;
              const locked = d.status === "locked";
              const body = (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">Day {l.day}</span>
                    {d.status === "completed" ? <Badge tone="success">Done</Badge> : d.status === "in_progress" ? <Badge tone="brand">{d.completedSteps.length}/5</Badge> : locked ? <Lock className="h-4 w-4 text-muted" aria-label="Locked" /> : <Badge>Ready</Badge>}
                  </div>
                  <p className="mt-1 font-semibold">{l.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{l.summary}</p>
                  {(l.day === 1 || l.day === 30) && <p className="mt-2 text-xs font-medium text-brand">{l.day === 1 ? "+ Baseline assessment" : "+ Final assessment"}</p>}
                </>
              );
              return (
                <li key={l.day}>
                  {locked ? (
                    <div className="card h-full p-4 opacity-60" aria-disabled>{body}</div>
                  ) : (
                    <Link href={`/lesson/${l.day}`} className={clsx("card block h-full p-4 transition hover:border-brand/50", d.day === ov.currentDay && "ring-2 ring-brand/50")}>{body}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
