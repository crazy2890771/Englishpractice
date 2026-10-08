import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, AudioLines, CalendarDays, Check, Clock, Flame, Headphones, Lock, MessageSquareText, Mic, NotebookPen, PenLine } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { dashboardData } from "@/lib/progress";
import { cookies } from "next/headers";
import { MountainScene } from "@/components/scenery";
import { ActivityBars } from "@/components/charts";
import { Badge, ProgressBar } from "@/components/ui";
import { CategoryBadge } from "@/components/practice/feedback-view";
import { LESSON_STEPS } from "@/content/curriculum";
import { isValidIsoDate } from "@/lib/dates";
import { Greeting } from "./greeting";

export const metadata = { title: "Home" };

const MODES = [
  { href: "/speaking", label: "Speaking", sub: "Chat with AI", icon: Mic, color: "text-sky-400" },
  { href: "/listening", label: "Listening", sub: "Real conversations", icon: Headphones, color: "text-cyan-400" },
  { href: "/writing", label: "Writing", sub: "Get AI feedback", icon: PenLine, color: "text-amber-400" },
  { href: "/roleplay", label: "Roleplay", sub: "Real-life situations", icon: MessageSquareText, color: "text-violet-400" },
  { href: "/shadowing", label: "Shadowing", sub: "Speak like a native", icon: AudioLines, color: "text-indigo-400" },
  { href: "/mistakes", label: "Mistake Hub", sub: "Learn from errors", icon: NotebookPen, color: "text-rose-400" },
];

const SKILL_LABELS: Record<string, string> = {
  speaking: "Speaking", listening: "Listening", writing: "Writing", grammar: "Grammar", vocabulary: "Vocabulary", pronunciation: "Shadowing accuracy",
};

export default async function Dashboard() {
  const user = await requireUser();
  // The learner's local date comes from a cookie set by the client (falls back to server date).
  const tz = (await cookies()).get("efl_today")?.value;
  const data = await dashboardData(user.id, tz && isValidIsoDate(tz) ? tz : undefined);
  const { overview, current } = data;
  const daysLeft = 30 - overview.completed;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-border text-white">
        <MountainScene className="absolute inset-0 -z-10 h-full w-full" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/10" />
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
                <Flame className="h-3.5 w-3.5 text-orange-400" aria-hidden /> {data.streak.current}-day streak
              </span>
              <Link href="/calendar" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur hover:bg-white/20">
                Day {current.day} / 30 <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            <Greeting name={user.name} />
            <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              A more fluent <span className="text-blue-300">you</span>
              <br />is closer than <span className="bg-gradient-to-r from-blue-300 to-violet-300 bg-clip-text text-transparent">you think.</span>
            </h1>
            <p className="mt-2 text-sm text-white/75">Practice. Make mistakes. Improve. Repeat.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-slate-950/50 p-5 backdrop-blur-md">
            <p className="flex items-center gap-1.5 text-xs font-medium text-white/70"><Mic className="h-3.5 w-3.5" aria-hidden /> Today&apos;s lesson · Week {current.week}</p>
            <h2 className="mt-1 text-xl font-bold">{current.title}</h2>
            <p className="mt-1 text-sm text-white/70">{current.summary}</p>
            <div className="mt-3 flex items-center gap-3">
              <ProgressBar value={(current.stepsDone / current.stepsTotal) * 100} className="bg-white/15" label="Today's progress" />
              <span className="shrink-0 text-xs text-white/70">{current.stepsDone}/{current.stepsTotal}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Link href={`/lesson/${current.day}`} className="btn-primary px-5">
                {overview.completed === 30 ? "Review Day 30" : current.status === "in_progress" ? "Continue Learning" : "Start Today's Lesson"} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <span className="inline-flex items-center gap-1 text-xs text-white/70"><Clock className="h-3.5 w-3.5" aria-hidden /> 60 min</span>
            </div>
          </div>
        </div>
      </section>

      {!data.hasBaseline && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-brand/40 p-4">
          <div>
            <p className="font-semibold">Take your Day 1 baseline assessment</p>
            <p className="text-sm text-muted">15 minutes. You&apos;ll repeat the same tasks on Day 30 to see your real progress.</p>
          </div>
          <Link href="/assessment" className="btn-primary">Start assessment</Link>
        </div>
      )}
      {overview.completed >= 29 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-success/40 p-4">
          <div>
            <p className="font-semibold">Your final assessment is unlocked 🎉</p>
            <p className="text-sm text-muted">Take it to compare Day 1 with Day 30.</p>
          </div>
          <Link href="/assessment?kind=FINAL" className="btn-primary">Final assessment</Link>
        </div>
      )}

      {/* Modes */}
      <nav aria-label="Training modes" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {MODES.map(({ href, label, sub, icon: Icon, color }) => (
          <Link key={href} href={href} className="card group flex flex-col items-center gap-2 p-4 text-center transition hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-glow">
            <Icon className={clsx("h-7 w-7", color)} aria-hidden />
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-xs text-muted">{sub}</span>
          </Link>
        ))}
      </nav>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Your stats">
        <Stat label="Current day" value={`Day ${current.day}`} sub={`Week ${current.week} of 4`} />
        <Stat label="Today's progress" value={`${current.stepsDone}/${current.stepsTotal} steps`} sub={LESSON_STEPS.filter((s) => current.completedSteps.includes(s.id)).map((s) => s.label).join(" · ") || "Not started yet"} />
        <Stat label="30-day completion" value={`${overview.percent}%`} sub={`${overview.completed} lessons done · ${daysLeft} left`} bar={overview.percent} />
        <Stat label="Study streak" value={`${data.streak.current} day${data.streak.current === 1 ? "" : "s"}`} sub={`Longest: ${data.streak.longest}`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2" aria-labelledby="journey">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="journey" className="font-semibold">Your 30-Day Journey</h2>
            <Link href="/calendar" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"><CalendarDays className="h-4 w-4" aria-hidden /> Calendar</Link>
          </div>
          <ol className="flex flex-wrap gap-2" aria-label="Lesson days">
            {overview.days.map((d) => (
              <li key={d.day}>
                <Link
                  href={d.status === "locked" ? "/calendar" : `/lesson/${d.day}`}
                  aria-label={`Day ${d.day}: ${d.status.replace("_", " ")}`}
                  className={clsx(
                    "grid h-8 w-8 place-items-center rounded-full text-xs font-semibold transition",
                    d.status === "completed" && "bg-brand text-white",
                    d.status === "in_progress" && "bg-accent text-white ring-4 ring-accent/30",
                    d.status === "available" && "border-2 border-brand text-brand",
                    d.status === "locked" && "bg-surface-2 text-muted",
                  )}
                >
                  {d.status === "completed" ? <Check className="h-4 w-4" aria-hidden /> : d.status === "locked" ? <Lock className="h-3 w-3" aria-hidden /> : d.day}
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-4 font-script text-xl text-muted">“Small progress every day leads to big results.”</p>
        </section>

        <section className="card p-5" aria-labelledby="week">
          <h2 id="week" className="mb-1 font-semibold">This week</h2>
          <p className="mb-3 text-xs text-muted">Minutes of active study per day</p>
          <ActivityBars data={data.week} />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="skills">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="skills" className="font-semibold">Skills overview</h2>
            <Link href="/progress" className="text-sm font-medium text-brand hover:underline">Analytics</Link>
          </div>
          <dl className="space-y-3">
            {Object.entries(data.skills).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-3 text-sm">
                <dt className="text-muted">{SKILL_LABELS[k]}</dt>
                <dd><ProgressBar value={v ?? 0} label={SKILL_LABELS[k]} /></dd>
                <dd className="text-right font-semibold tabular-nums">{v === null ? "—" : `${v}%`}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">Estimates from your recent exercises. “—” means no data yet.</p>
        </section>

        <section className="card p-5" aria-labelledby="mistakes">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="mistakes" className="font-semibold">Recent mistakes</h2>
            <Link href="/mistakes" className="text-sm font-medium text-brand hover:underline">{data.due > 0 ? <Badge tone="warn">{data.due} due</Badge> : "Mistake Hub"}</Link>
          </div>
          {data.recentMistakes.length === 0 ? (
            <p className="text-sm text-muted">No mistakes collected yet. They&apos;ll appear here as you practise.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentMistakes.map((m) => (
                <li key={m.id} className="rounded-xl bg-surface-2 p-3 text-sm">
                  <div className="mb-1 flex items-center gap-2"><CategoryBadge category={m.category} />{m.occurrences > 1 && <span className="text-xs text-muted">×{m.occurrences}</span>}</div>
                  <span className="text-muted line-through">{m.original}</span> → <span className="font-medium">{m.corrected}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, bar }: { label: string; value: string; sub: string; bar?: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {bar !== undefined && <ProgressBar value={bar} className="mt-2" label={label} />}
      <p className="mt-1 truncate text-xs text-muted">{sub}</p>
    </div>
  );
}
