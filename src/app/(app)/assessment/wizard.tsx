"use client";
import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Headphones, Mic, PenLine } from "lucide-react";
import type { AssessmentContent } from "@/content/assessment";
import type { AssessmentScores } from "@/lib/assessment";
import { api, errorMessage } from "@/lib/client/api";
import { wordCount } from "@/lib/text";
import { VoiceInput } from "@/components/audio/voice-input";
import { DialoguePlayer } from "@/components/practice/listening-exercise";
import { ScoreBars } from "@/components/practice/feedback-view";
import { Badge, DemoBadge, ErrorBanner, Notice, ProgressBar, Spinner } from "@/components/ui";
import { useStudyTime } from "@/lib/client/use-study-time";

interface Existing {
  overall: number;
  level: string;
  scores: AssessmentScores;
  completedAt: string;
  live: boolean;
}

type Step = "intro" | "speaking" | "listening" | "writing" | "submit" | "done";

export function AssessmentWizard({ kind, content, canTake, existing }: { kind: "BASELINE" | "FINAL"; content: AssessmentContent; canTake: boolean; existing: Existing | null }) {
  const [step, setStep] = useState<Step>(existing ? "done" : "intro");
  const [result, setResult] = useState<Existing | null>(existing);
  const [speakIdx, setSpeakIdx] = useState(0);
  const [speaking, setSpeaking] = useState<Record<string, { text: string; durationSec?: number; spoken: boolean }>>({});
  const [answers, setAnswers] = useState<Record<string, string | number | null>>({});
  const [writing, setWriting] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useStudyTime({ active: step !== "done" && step !== "intro" });

  const progress = step === "speaking" ? (speakIdx / content.speaking.length) * 33 : step === "listening" ? 33 : step === "writing" ? 66 : step === "submit" || step === "done" ? 100 : 0;

  async function submit() {
    setBusy(true);
    setError(null);
    setStep("submit");
    try {
      const { assessment } = await api<{ assessment: Existing & { completedAt: string } }>("/api/assessment", {
        body: {
          kind,
          speaking: content.speaking.map((s) => ({ id: s.id, ...speaking[s.id]! })),
          listening: answers,
          writing,
        },
        timeoutMs: 180_000,
      });
      setResult(assessment);
      setStep("done");
    } catch (e) {
      setError(errorMessage(e));
      setStep("writing");
    } finally {
      setBusy(false);
    }
  }

  if (step === "done" && result) {
    const s = result.scores;
    return (
      <div className="space-y-4">
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted">{kind === "FINAL" ? "Day 30 result" : "Baseline result"} · {new Date(result.completedAt).toLocaleDateString()}</p>
              <p className="mt-1 text-4xl font-extrabold">{Math.round(result.overall)}%</p>
              <p className="mt-1 text-sm">Estimated level: <span className="font-semibold">{result.level}</span> <span className="text-muted">(self-study estimate, not a certified CEFR result)</span></p>
            </div>
            <DemoBadge live={result.live} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {(["speaking", "listening", "writing"] as const).map((k) => (
              <div key={k} className="rounded-xl bg-surface-2 p-4">
                <p className="text-sm capitalize text-muted">{k}</p>
                <p className="text-2xl font-bold">{s.sections[k]}%</p>
                <ProgressBar value={s.sections[k]} className="mt-2" label={k} />
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div><p className="mb-2 text-sm font-semibold">Speaking (bands 1–5)</p><ScoreBars scores={s.speaking} keys={["grammar", "vocabulary", "fluency", "taskCompletion"]} /></div>
            <div><p className="mb-2 text-sm font-semibold">Writing (bands 1–5)</p><ScoreBars scores={s.writing} keys={["grammar", "vocabulary", "clarity", "coherence", "taskCompletion"]} /></div>
          </div>
          <p className="mt-4 text-sm text-muted">Listening: {s.listening.score}/{s.listening.max} correct.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={kind === "FINAL" ? "/progress/compare" : "/lesson/1"} className="btn-primary">{kind === "FINAL" ? "Compare Day 1 vs Day 30" : "Start Day 1"} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
          {canTake && <button type="button" className="btn-ghost" onClick={() => { setResult(null); setStep("intro"); setSpeaking({}); setAnswers({}); setWriting(""); setSpeakIdx(0); }}>Retake</button>}
        </div>
      </div>
    );
  }

  if (!canTake) {
    return <Notice>Your baseline is locked because you&apos;ve started lessons — this keeps the Day 30 comparison fair.</Notice>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ProgressBar value={progress} label="Assessment progress" />
      <ol className="flex justify-between text-xs text-muted" aria-label="Sections">
        {[{ s: "speaking", i: Mic, l: "Speaking" }, { s: "listening", i: Headphones, l: "Listening" }, { s: "writing", i: PenLine, l: "Writing" }].map(({ s, i: Icon, l }) => (
          <li key={s} className={clsx("flex items-center gap-1", step === s && "font-semibold text-fg")}><Icon className="h-3.5 w-3.5" aria-hidden /> {l}</li>
        ))}
      </ol>

      {step === "intro" && (
        <div className="card space-y-4 p-6">
          <h2 className="text-xl font-bold">How it works</h2>
          <ul className="space-y-2 text-sm text-muted">
            <li>🎤 <strong className="text-fg">Speaking</strong> — 3 short questions. Speak (or type) for about 30–60 seconds each.</li>
            <li>🎧 <strong className="text-fg">Listening</strong> — one conversation and 8 questions. You can replay it.</li>
            <li>✍️ <strong className="text-fg">Writing</strong> — a short email (100–150 words).</li>
          </ul>
          <Notice>Scores are estimates using fixed rubrics so Day 1 and Day 30 can be compared. They are not certified CEFR results.</Notice>
          <button type="button" className="btn-primary" onClick={() => setStep("speaking")}>Begin <ArrowRight className="h-4 w-4" aria-hidden /></button>
        </div>
      )}

      {step === "speaking" && (() => {
        const task = content.speaking[speakIdx]!;
        const done = speaking[task.id];
        return (
          <div className="card space-y-4 p-6">
            <Badge tone="brand">Speaking {speakIdx + 1} of {content.speaking.length}</Badge>
            <p className="text-lg font-semibold">{task.prompt}</p>
            <p className="text-xs text-muted">Aim for at least {task.minWords} words.</p>
            {done ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-surface-2 p-3 text-sm"><p className="mb-1 text-xs font-semibold text-muted">Your answer ({wordCount(done.text)} words)</p>{done.text}</div>
                <div className="flex justify-between">
                  <button type="button" className="btn-ghost" onClick={() => setSpeaking((x) => { const n = { ...x }; delete n[task.id]; return n; })}>Redo</button>
                  <button type="button" className="btn-primary" onClick={() => (speakIdx < content.speaking.length - 1 ? setSpeakIdx(speakIdx + 1) : setStep("listening"))}>Next <ArrowRight className="h-4 w-4" aria-hidden /></button>
                </div>
              </div>
            ) : (
              <VoiceInput key={task.id} mode="ASSESSMENT" submitLabel="Save answer" onSubmit={(text, meta) => setSpeaking((x) => ({ ...x, [task.id]: { text, durationSec: meta.durationSec, spoken: meta.spoken } }))} />
            )}
            {speakIdx > 0 && <button type="button" className="btn-ghost" onClick={() => setSpeakIdx(speakIdx - 1)}><ArrowLeft className="h-4 w-4" aria-hidden /> Previous</button>}
          </div>
        );
      })()}

      {step === "listening" && (
        <div className="card space-y-5 p-6">
          <div><h2 className="font-semibold">{content.listening.title}</h2><p className="text-sm text-muted">{content.listening.scenario}</p></div>
          <DialoguePlayer exercise={content.listening} />
          <ol className="space-y-5">
            {content.listening.questions.map((q, qi) => (
              <li key={q.id}>
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">{qi + 1}. {q.prompt}</legend>
                  {q.type === "fill" ? (
                    <input className="input" value={String(answers[q.id] ?? "")} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} aria-label={`Answer ${qi + 1}`} autoComplete="off" />
                  ) : (
                    <div className="space-y-1.5">
                      {q.options!.map((o, oi) => (
                        <label key={oi} className={clsx("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm", answers[q.id] === oi ? "border-brand bg-brand/10" : "border-border hover:bg-surface-2")}>
                          <input type="radio" name={q.id} className="accent-[rgb(var(--brand))]" checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} />
                          {o}
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
              </li>
            ))}
          </ol>
          <div className="flex justify-between">
            <button type="button" className="btn-ghost" onClick={() => setStep("speaking")}><ArrowLeft className="h-4 w-4" aria-hidden /> Back</button>
            <button type="button" className="btn-primary" onClick={() => setStep("writing")} disabled={content.listening.questions.some((q) => answers[q.id] === undefined || answers[q.id] === "")}>Next <ArrowRight className="h-4 w-4" aria-hidden /></button>
          </div>
        </div>
      )}

      {(step === "writing" || step === "submit") && (
        <div className="card space-y-4 p-6">
          <p className="font-semibold">{content.writing.prompt}</p>
          <label htmlFor="assess-writing" className="sr-only">Your email</label>
          <textarea id="assess-writing" className="input min-h-[240px]" value={writing} onChange={(e) => setWriting(e.target.value)} disabled={busy} />
          <p className="text-xs text-muted">{wordCount(writing)} words · target {content.writing.minWords}–{content.writing.maxWords}</p>
          {error && <ErrorBanner message={error} onRetry={submit} />}
          <div className="flex justify-between">
            <button type="button" className="btn-ghost" onClick={() => setStep("listening")} disabled={busy}><ArrowLeft className="h-4 w-4" aria-hidden /> Back</button>
            <button type="button" className="btn-primary" onClick={submit} disabled={busy || wordCount(writing) < 20}>
              {busy ? <><Spinner /> Scoring…</> : <><CheckCircle2 className="h-4 w-4" aria-hidden /> Submit assessment</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
