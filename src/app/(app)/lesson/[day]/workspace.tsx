"use client";
import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Pause, Play, PartyPopper, Target } from "lucide-react";
import type { Lesson, ShadowingSentence } from "@/content/types";
import { LESSON_STEPS, type StepId } from "@/content/curriculum";
import { api, errorMessage } from "@/lib/client/api";
import { useStudyTime } from "@/lib/client/use-study-time";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, ErrorBanner, Notice, ProgressBar, Spinner } from "@/components/ui";
import { ConversationRoom } from "@/components/practice/conversation-room";
import { ListeningExercise } from "@/components/practice/listening-exercise";
import { WritingStudio } from "@/components/practice/writing-studio";
import { ShadowingTrainer } from "@/components/practice/shadowing-trainer";
import { ReviewSession } from "@/components/practice/review-session";

interface Props {
  lesson: Lesson;
  variant: "standard" | "challenge";
  shadowing: (ShadowingSentence & { id: string })[];
  initial: { completedSteps: StepId[]; secondsSpent: number; status: string };
  nextDay: number | null;
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function LessonWorkspace({ lesson, variant, shadowing, initial, nextDay }: Props) {
  const day = lesson.day;
  const [completed, setCompleted] = useState<StepId[]>(initial.completedSteps);
  const [active, setActive] = useState<StepId>(() => LESSON_STEPS.find((s) => !initial.completedSteps.includes(s.id))?.id ?? "speaking");
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(initial.secondsSpent);
  const [checking, setChecking] = useState(false);
  const [stepMsg, setStepMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const lastActive = useRef(Date.now());

  useStudyTime({ day, active: !paused });

  // Start / resume the lesson (adds vocabulary to the flashcard deck).
  const startLesson = useCallback(async () => {
    setStartError(null);
    try {
      await api(`/api/lessons/${day}/start`, { method: "POST" });
    } catch (e) {
      setStartError(errorMessage(e));
    }
  }, [day]);
  useEffect(() => void startLesson(), [startLesson]);

  // Restore the last open step (save & resume).
  useEffect(() => {
    try {
      const s = localStorage.getItem(`efl-step:${day}`) as StepId | null;
      if (s && LESSON_STEPS.some((x) => x.id === s)) setActive(s);
    } catch {
      /* ignore */
    }
  }, [day]);
  useEffect(() => {
    try {
      localStorage.setItem(`efl-step:${day}`, active);
    } catch {
      /* ignore */
    }
  }, [active, day]);

  // Visible session timer (counts only while not paused and the tab is visible & in use).
  useEffect(() => {
    const mark = () => (lastActive.current = Date.now());
    window.addEventListener("pointerdown", mark);
    window.addEventListener("keydown", mark);
    const t = setInterval(() => {
      if (!paused && document.visibilityState === "visible" && Date.now() - lastActive.current < 120_000) setElapsed((e) => e + 1);
    }, 1000);
    return () => {
      clearInterval(t);
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, [paused]);

  const markStep = useCallback(
    async (step: StepId, silent = true) => {
      if (!silent) setChecking(true);
      setError(null);
      try {
        const r = await api<{ ok: boolean; detail: string; completedSteps: StepId[] }>(`/api/lessons/${day}/step`, { body: { step } });
        setCompleted(r.completedSteps);
        if (!silent) setStepMsg(r.ok ? `${LESSON_STEPS.find((s) => s.id === step)!.label} complete ✓` : `Not finished yet: ${r.detail}.`);
        return r.ok;
      } catch (e) {
        if (!silent) setError(errorMessage(e));
        return false;
      } finally {
        if (!silent) setChecking(false);
      }
    },
    [day],
  );

  const allDone = LESSON_STEPS.every((s) => completed.includes(s.id));
  const stepInfo = LESSON_STEPS.find((s) => s.id === active)!;
  const exercise = lesson.listening[variant];
  const targetMinutes = 60;

  return (
    <div>
      <PageHeader
        back="/calendar"
        title={`Day ${day}: ${lesson.title}`}
        subtitle={`Week ${lesson.week} · ${lesson.theme}`}
        actions={
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5">
            <span className={clsx("font-mono text-sm tabular-nums", paused && "text-muted")} aria-label={`Time studied: ${fmt(elapsed)}`}>
              {fmt(elapsed)} <span className="text-xs text-muted">/ {targetMinutes}:00</span>
            </span>
            <button type="button" className="btn-ghost h-8 px-2 py-0" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
              {paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
              <span className="text-xs">{paused ? "Resume" : "Pause"}</span>
            </button>
          </div>
        }
      />

      {startError && <ErrorBanner className="mb-4" message={startError} onRetry={startLesson} />}

      {/* Steps */}
      <nav aria-label="Lesson steps" className="mb-5">
        <ol className="grid grid-cols-5 gap-2">
          {LESSON_STEPS.map((s, i) => {
            const done = completed.includes(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => { setActive(s.id); setStepMsg(null); }}
                  aria-current={active === s.id ? "step" : undefined}
                  className={clsx(
                    "flex w-full flex-col items-center gap-1 rounded-xl border p-2 text-center transition sm:flex-row sm:gap-2 sm:p-3 sm:text-left",
                    active === s.id ? "border-brand bg-brand/10" : "border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden /> : <Circle className="h-5 w-5 shrink-0 text-muted" aria-hidden />}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold sm:text-sm">{i + 1}. {s.label}</span>
                    <span className="hidden text-xs text-muted sm:block">{s.minutes} min{done ? " · done" : ""}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <ProgressBar className="mt-3" value={(completed.length / LESSON_STEPS.length) * 100} label="Lesson progress" />
      </nav>

      {paused && (
        <Notice className="mb-4">Session paused — study time isn&apos;t being counted. Your progress is saved; press Resume to continue.</Notice>
      )}

      {allDone && (
        <section className="card mb-5 border-success/40 p-5" aria-label="Daily completion summary">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <PartyPopper className="h-8 w-8 text-success" aria-hidden />
              <div>
                <h2 className="text-lg font-bold">Day {day} complete!</h2>
                <p className="text-sm text-muted">All 5 exercises finished · {Math.round(elapsed / 60)} minutes studied · vocabulary added to your deck.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/progress" className="btn-secondary">See progress</Link>
              {nextDay ? (
                <Link href={`/lesson/${nextDay}`} className="btn-primary">Day {nextDay} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              ) : (
                <Link href="/assessment?kind=FINAL" className="btn-primary">Final assessment <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-brand" aria-hidden /> Today&apos;s objectives</p>
          <ul className="grid gap-1 text-sm text-muted sm:grid-cols-2">{lesson.objectives.map((o) => <li key={o}>• {o}</li>)}</ul>
        </div>
        <div className="card flex flex-col justify-center gap-2 p-4 text-sm">
          <p className="font-semibold">{stepInfo.label} · {stepInfo.minutes} min</p>
          <p className="max-w-xs text-xs text-muted">{completionHint(active, lesson)}</p>
          <button type="button" className={completed.includes(active) ? "btn-secondary" : "btn-primary"} onClick={() => markStep(active, false)} disabled={checking}>
            {checking && <Spinner />} {completed.includes(active) ? "Completed ✓" : "Check completion"}
          </button>
          {stepMsg && <p className="text-xs" aria-live="polite">{stepMsg}</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </div>

      <section aria-label={`${stepInfo.label} exercise`}>
        {active === "speaking" && (
          <div className="space-y-3">
            <div className="card p-4 text-sm">
              <p><span className="font-semibold">Topic:</span> {lesson.speaking.topic} — <span className="text-muted">{lesson.speaking.goal}</span></p>
              <div className="mt-2 flex flex-wrap gap-2">{lesson.speaking.usefulPhrases.map((p) => <span key={p} className="chip">{p}</span>)}</div>
            </div>
            <ConversationRoom
              mode="SPEAKING"
              topicKey={`lesson:${day}`}
              day={day}
              resume
              title={lesson.speaking.topic}
              subtitle="AI Speaking Partner"
              usefulPhrases={lesson.speaking.usefulPhrases}
              timeLimitSec={lesson.speaking.timedResponseSec}
              targetTurns={lesson.completion.speakingTurns}
              onTurn={() => void markStep("speaking")}
            />
          </div>
        )}
        {active === "listening" && (
          <div className="space-y-3">
            {variant === "challenge" && <Notice>Your recent listening accuracy is high, so today you get the <strong>challenge</strong> version.</Notice>}
            <ListeningExercise exercise={exercise} day={day} onGraded={() => void markStep("listening")} />
          </div>
        )}
        {active === "writing" && (
          <WritingStudio
            day={day}
            prompt={{ id: `d${day}-writing`, ...lesson.writing }}
            onSubmitted={() => void markStep("writing")}
          />
        )}
        {active === "shadowing" && (
          <ShadowingTrainer items={shadowing} day={day} onProgress={() => void markStep("shadowing")} />
        )}
        {active === "review" && (
          <div className="space-y-4">
            <div className="card p-4 text-sm">
              <p className="mb-2 font-semibold">Review tasks (say them aloud)</p>
              <ul className="list-disc space-y-1 pl-5 text-muted">{lesson.review.map((r) => <li key={r}>{r}</li>)}</ul>
              <div className="mt-3">
                <p className="mb-1 font-semibold">Today&apos;s vocabulary</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {lesson.vocabulary.map((v) => (
                    <li key={v.word} className="rounded-lg bg-surface-2 p-2"><span className="font-semibold">{v.word}</span> — <span className="text-muted">{v.definition}</span></li>
                  ))}
                </ul>
              </div>
            </div>
            <ReviewSession day={day} onReviewed={() => void markStep("review")} />
          </div>
        )}
      </section>
      <p className="mt-6 text-center text-xs text-muted">
        <Badge>Completion</Badge> Each step is checked against the exercises you actually finished — not time spent.
      </p>
    </div>
  );
}

function completionHint(step: StepId, l: Lesson) {
  const c = l.completion;
  switch (step) {
    case "speaking": return `Answer at least ${c.speakingTurns} questions in the conversation.`;
    case "listening": return `Score ${c.listeningMinPercent}% or more (or complete two attempts and review the explanations).`;
    case "writing": return `Submit at least ${c.writingMinWords} words for feedback.`;
    case "shadowing": return `Practise all ${c.shadowingSentences} sentences.`;
    case "review": return `Review ${c.reviewItems} due items (mistakes or flashcards), or clear your queue.`;
  }
}
