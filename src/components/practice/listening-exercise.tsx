"use client";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, Pause, Play, RotateCcw, XCircle } from "lucide-react";
import type { ListeningExercise as Exercise } from "@/content/types";
import { api, errorMessage } from "@/lib/client/api";
import { browserTtsSupported, speak, stopSpeaking, unlockAudio } from "@/lib/client/audio";
import { useAppConfig } from "../providers";
import { Badge, ErrorBanner, Notice, ProgressBar, Spinner, Tabs } from "../ui";

const SPEEDS = [0.75, 0.9, 1, 1.15, 1.25];
const ACCENT_LABEL: Record<string, string> = { US: "American", UK: "British", AU: "Australian", IN: "Indian" };

export interface ListeningResult {
  score: number;
  max: number;
  percent: number;
  results: { id: string; correct: boolean; given: string | number | null; expected: string; explanation: string }[];
}

/** Plays a dialogue line by line with per-speaker voices. */
export function DialoguePlayer({ exercise, onListened, onReplay }: { exercise: Exercise; onListened?: () => void; onReplay?: () => void }) {
  const { settings, providers } = useAppConfig();
  const [speed, setSpeed] = useState(settings.speechRate);
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const plays = useRef(0);

  useEffect(() => () => { abortRef.current?.abort(); stopSpeaking(); }, []);

  async function play(from = 0) {
    unlockAudio();
    setError(null);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPlaying(true);
    if (from === 0) {
      plays.current += 1;
      if (plays.current > 1) onReplay?.();
    }
    try {
      for (let i = from; i < exercise.lines.length; i++) {
        if (ctrl.signal.aborted) return;
        setLine(i);
        const l = exercise.lines[i]!;
        await speak(l.text, { accent: exercise.accent, gender: l.voice, rate: speed, provider: providers.tts, signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        await new Promise((r) => setTimeout(r, 250));
      }
      setLine(-1);
      onListened?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      if (abortRef.current === ctrl) setPlaying(false);
    }
  }

  function pause() {
    abortRef.current?.abort();
    stopSpeaking();
    setPlaying(false);
  }

  const progress = line < 0 ? 0 : ((line + 1) / exercise.lines.length) * 100;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <button
          type="button"
          onClick={() => (playing ? pause() : play(line > 0 ? line : 0))}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-white shadow-glow"
          aria-label={playing ? "Pause dialogue" : line > 0 ? "Resume dialogue" : "Play dialogue"}
        >
          {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="ml-0.5 h-5 w-5" aria-hidden />}
        </button>
        <div className="min-w-0 flex-1">
          <ProgressBar value={progress} label="Dialogue progress" />
          <p className="mt-1.5 text-xs text-muted" aria-live="polite">
            {line >= 0 ? `Line ${line + 1} of ${exercise.lines.length} · ${exercise.lines[line]!.speaker}` : `${exercise.lines.length} lines · ${ACCENT_LABEL[exercise.accent]} accent`}
          </p>
        </div>
        <button type="button" className="btn-ghost h-10 w-10 p-0" onClick={() => play(0)} aria-label="Replay from start">
          <RotateCcw className="h-4 w-4" aria-hidden />
        </button>
        <label className="sr-only" htmlFor={`speed-${exercise.id}`}>Playback speed</label>
        <select id={`speed-${exercise.id}`} className="input w-[4.8rem] px-2 py-1.5" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
        </select>
      </div>
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

export function ListeningExercise({ exercise, day, onGraded }: { exercise: Exercise; day?: number; onGraded?: (r: ListeningResult) => void }) {
  const [answers, setAnswers] = useState<Record<string, string | number | null>>({});
  const [result, setResult] = useState<ListeningResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listened, setListened] = useState(false);
  const [forceReveal, setForceReveal] = useState(false);
  const [tab, setTab] = useState<"questions" | "transcript">("questions");
  const [noAudio, setNoAudio] = useState(false);
  const replays = useRef(0);
  const started = useRef(Date.now());
  const { providers } = useAppConfig();

  useEffect(() => setNoAudio(providers.tts === "browser" && !browserTtsSupported()), [providers.tts]);

  const revealed = !!result || forceReveal || noAudio;
  const answered = exercise.questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== "" && answers[q.id] !== null).length;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<ListeningResult>("/api/listening", {
        body: { exerciseId: exercise.id, day, answers, replays: replays.current, durationSec: Math.round((Date.now() - started.current) / 1000) },
      });
      setResult(r);
      setTab("questions");
      onGraded?.(r);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setAnswers({});
    setResult(null);
    setForceReveal(false);
    started.current = Date.now();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{exercise.title}</h3>
            <Badge tone="brand">{exercise.level}</Badge>
            <Badge>{ACCENT_LABEL[exercise.accent]}</Badge>
          </div>
          <p className="mb-4 text-sm text-muted">{exercise.scenario}</p>
          <DialoguePlayer exercise={exercise} onListened={() => setListened(true)} onReplay={() => (replays.current += 1)} />
          {noAudio && <Notice tone="warn" className="mt-3">Audio isn&apos;t available on this device, so the transcript is shown instead.</Notice>}
          {!revealed && (
            <p className="mt-3 text-xs text-muted">
              Listen first — the transcript unlocks after you check your answers.{" "}
              {listened && (
                <button type="button" className="font-semibold text-brand hover:underline" onClick={() => setForceReveal(true)}>
                  <Eye className="mr-1 inline h-3.5 w-3.5" aria-hidden />Reveal now
                </button>
              )}
            </p>
          )}
        </div>
        {revealed && (
          <div className="card p-4">
            <Tabs tabs={[{ id: "questions", label: "Results" }, { id: "transcript", label: "Transcript" }]} value={tab} onChange={setTab} className="lg:hidden" />
            <div className={clsx("mt-3 lg:mt-0", tab !== "transcript" && "hidden lg:block")}>
              <h3 className="mb-2 text-sm font-semibold">Transcript</h3>
              <ol className="space-y-2 text-sm">
                {exercise.lines.map((l, i) => (
                  <li key={i}><span className="font-semibold">{l.speaker}:</span> <span className="text-muted">{l.text}</span></li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Questions</h3>
          {result ? (
            <Badge tone={result.percent >= 60 ? "success" : "warn"}>{result.score}/{result.max} · {result.percent}%</Badge>
          ) : (
            <span className="text-xs text-muted">{answered}/{exercise.questions.length} answered</span>
          )}
        </div>
        <ol className="space-y-5">
          {exercise.questions.map((q, qi) => {
            const r = result?.results.find((x) => x.id === q.id);
            return (
              <li key={q.id}>
                <fieldset disabled={!!result}>
                  <legend className="mb-2 text-sm font-medium">
                    {qi + 1}. {q.prompt} {q.type === "comprehension" && <Badge className="ml-1">Inference</Badge>}
                  </legend>
                  {q.type === "fill" ? (
                    <input
                      className={clsx("input", r && (r.correct ? "border-success" : "border-danger"))}
                      value={String(answers[q.id] ?? "")}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      placeholder="Type the missing word(s)"
                      aria-label={`Answer for question ${qi + 1}`}
                      autoComplete="off"
                    />
                  ) : (
                    <div className="space-y-1.5">
                      {q.options!.map((opt, oi) => {
                        const chosen = answers[q.id] === oi;
                        const isAnswer = result && Number(q.answer) === oi;
                        return (
                          <label
                            key={oi}
                            className={clsx(
                              "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
                              chosen ? "border-brand bg-brand/10" : "border-border hover:bg-surface-2",
                              isAnswer && "border-success bg-success/10",
                              result && chosen && !isAnswer && "border-danger bg-danger/10",
                            )}
                          >
                            <input type="radio" className="sr-only" name={q.id} checked={chosen} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} />
                            <span className={clsx("grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold", chosen ? "border-brand bg-brand text-white" : "border-border")}>
                              {String.fromCharCode(65 + oi)}
                            </span>
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
                {r && (
                  <div className={clsx("mt-2 flex gap-2 rounded-xl p-2.5 text-sm", r.correct ? "bg-success/10" : "bg-danger/10")}>
                    {r.correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />}
                    <p>
                      {!r.correct && <><span className="font-semibold">Answer: {r.expected}. </span></>}
                      <span className="text-muted">{r.explanation}</span>
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {error && <ErrorBanner className="mt-4" message={error} onRetry={submit} />}
        <div className="mt-5 flex justify-end gap-2">
          {result ? (
            <button type="button" className="btn-secondary" onClick={retry}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Try again
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={submit} disabled={busy || answered < exercise.questions.length}>
              {busy && <Spinner />} Check answers
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
