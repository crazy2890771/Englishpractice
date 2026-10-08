"use client";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Mic, Square } from "lucide-react";
import { Logo } from "@/components/logo";
import { ErrorBanner, Notice, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import { recordingSupport, useRecorder, unlockAudio } from "@/lib/client/audio";
import { Waveform } from "@/components/audio/waveform";

const GOALS = ["Speak more confidently", "Prepare for job interviews", "Communicate at work", "Travel with ease", "Aviation / airline career"];

export function Onboarding({ name: initialName }: { name: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [goal, setGoal] = useState(GOALS[0]!);
  const [level, setLevel] = useState<"B1" | "B2">("B1");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRecorder({ maxMs: 6000 });
  const [support, setSupport] = useState<{ ok: boolean; reason?: string }>({ ok: true });
  useEffect(() => setSupport(recordingSupport()), []);

  async function finish(next: "/assessment" | "/dashboard") {
    setBusy(true);
    setError(null);
    try {
      await api("/api/profile", { method: "PATCH", body: { name: name.trim() || "Learner", goal, level, onboarded: true } });
      await api("/api/settings", { method: "PATCH", body: { saveRecordings: consent } });
      window.location.href = next;
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const steps = ["About you", "Your goal", "Microphone", "Ready"];

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-8">
      <Logo />
      <ol className="mt-8 flex gap-2" aria-label="Onboarding progress">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={clsx("h-1.5 rounded-full", i <= step ? "bg-brand" : "bg-surface-2")} />
            <span className={clsx("mt-1 block text-xs", i === step ? "text-fg" : "text-muted")}>{s}</span>
          </li>
        ))}
      </ol>

      <div className="card mt-6 flex-1 p-6 sm:flex-none">
        {step === 0 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Welcome! What should we call you?</h1>
            <div>
              <label className="label" htmlFor="name">Your name</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Alex" autoFocus />
            </div>
            <fieldset>
              <legend className="label">How would you describe your English now?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["B1", "B2"] as const).map((l) => (
                  <button key={l} type="button" onClick={() => setLevel(l)} aria-pressed={level === l} className={clsx("rounded-xl border p-3 text-left text-sm", level === l ? "border-brand bg-brand/10" : "border-border")}>
                    <span className="font-semibold">{l === "B1" ? "Intermediate (B1)" : "Upper-intermediate (B2)"}</span>
                    <span className="mt-0.5 block text-muted">{l === "B1" ? "I can handle everyday topics but often search for words." : "I can discuss most topics but want to sound more natural."}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">The Day 1 assessment will fine-tune this, and difficulty adapts as you go.</p>
            </fieldset>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">What&apos;s your main goal?</h1>
            <div className="grid gap-2">
              {GOALS.map((g) => (
                <button key={g} type="button" onClick={() => setGoal(g)} aria-pressed={goal === g} className={clsx("flex items-center justify-between rounded-xl border p-3 text-left text-sm", goal === g ? "border-brand bg-brand/10" : "border-border")}>
                  {g}
                  {goal === g && <Check className="h-4 w-4 text-brand" aria-hidden />}
                </button>
              ))}
            </div>
            <Notice>Your plan: 30 days × 60 minutes — Speaking 20 · Listening 15 · Writing 10 · Shadowing 10 · Review 5.</Notice>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Let&apos;s check your microphone</h1>
            <p className="text-sm text-muted">Record a few words, then play them back. Nothing is uploaded during this check.</p>
            {!support.ok ? (
              <Notice tone="warn">{support.reason} You can still use every mode by typing.</Notice>
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface-2 p-6">
                <Waveform level={rec.level} active={rec.state === "recording"} />
                {rec.state === "recording" ? (
                  <button type="button" className="btn-danger" onClick={() => rec.stop()}>
                    <Square className="h-4 w-4" aria-hidden /> Stop
                  </button>
                ) : (
                  <button type="button" className="btn-primary" onClick={() => (unlockAudio(), rec.reset(), rec.start())} disabled={rec.state === "requesting"}>
                    <Mic className="h-4 w-4" aria-hidden /> {rec.recording ? "Record again" : "Start test"}
                  </button>
                )}
                {rec.recording && <audio controls src={rec.recording.url} className="w-full" />}
                {rec.error && <ErrorBanner message={rec.error} />}
              </div>
            )}
            <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                <span className="font-semibold">Save my recordings</span> so I can replay them later. Recordings are private, kept for 30 days by default, and can be deleted at any time in Settings. (Optional — transcripts are saved either way.)
              </span>
            </label>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">You&apos;re all set{name ? `, ${name}` : ""}!</h1>
            <p className="text-muted">
              Start with a 15-minute baseline assessment (speaking, listening and writing). You&apos;ll take the same assessment on Day 30 to compare your progress fairly.
            </p>
            {error && <ErrorBanner message={error} />}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-primary" disabled={busy} onClick={() => finish("/assessment")}>
                {busy && <Spinner />} Take the baseline assessment <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => finish("/dashboard")}>
                Skip for now
              </button>
            </div>
          </div>
        )}
      </div>

      {step < 3 && (
        <div className="mt-6 flex justify-between">
          <button type="button" className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </button>
          <button type="button" className="btn-primary" onClick={() => { if (rec.state === "recording") rec.stop(); setStep((s) => s + 1); }} disabled={step === 0 && !name.trim()}>
            Continue <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
