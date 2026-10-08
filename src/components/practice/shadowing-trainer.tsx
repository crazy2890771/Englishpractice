"use client";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, Volume2 } from "lucide-react";
import type { ShadowingSentence } from "@/content/types";
import type { DiffToken } from "@/lib/text";
import { api, errorMessage } from "@/lib/client/api";
import { speak, stopSpeaking, unlockAudio } from "@/lib/client/audio";
import { useAppConfig } from "../providers";
import { Badge, ErrorBanner, Notice, Spinner } from "../ui";
import { VoiceInput } from "../audio/voice-input";

interface Result {
  tokens: DiffToken[];
  accuracy: number;
  paceRatio: number | null;
  transcript: string;
}

export function DiffView({ tokens }: { tokens: DiffToken[] }) {
  return (
    <p className="flex flex-wrap gap-x-1.5 gap-y-1 text-base leading-relaxed">
      {tokens.map((t, i) =>
        t.kind === "match" ? (
          <span key={i} className="text-success">{t.ref}</span>
        ) : t.kind === "missed" ? (
          <span key={i} className="rounded bg-danger/15 px-1 text-danger line-through" title="Missed">{t.ref}</span>
        ) : t.kind === "wrong" ? (
          <span key={i} className="rounded bg-warn/15 px-1 text-warn" title={`You said “${t.said}”`}>
            {t.ref} <span className="text-xs opacity-80">({t.said})</span>
          </span>
        ) : (
          <span key={i} className="rounded bg-surface-2 px-1 text-muted" title="Extra word">+{t.said}</span>
        ),
      )}
    </p>
  );
}

function paceNote(r: number | null) {
  if (r === null) return null;
  if (r > 1.35) return "You were noticeably slower than the model. Try to link words together.";
  if (r < 0.75) return "You were faster than the model — slow down slightly and stress the key words.";
  return "Your pace was close to the model. Nice rhythm!";
}

export function ShadowingTrainer({ items, day, onProgress }: { items: (ShadowingSentence & { id: string })[]; day?: number; onProgress?: (practised: number) => void }) {
  const { settings, providers } = useAppConfig();
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [playing, setPlaying] = useState(false);
  const [refMs, setRefMs] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [showText, setShowText] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const item = items[idx]!;
  const result = results[item.id];

  useEffect(() => () => { abortRef.current?.abort(); stopSpeaking(); }, []);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const practised = Object.keys(results).length;
  useEffect(() => {
    if (practised > 0) void onProgressRef.current?.(practised);
  }, [practised]);

  async function playRef(rate = settings.speechRate) {
    unlockAudio();
    setError(null);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setPlaying(true);
    const t0 = performance.now();
    try {
      await speak(item.text, { accent: settings.accent, rate, provider: providers.tts, gender: idx % 2 ? "male" : "female", signal: abortRef.current.signal });
      if (!abortRef.current.signal.aborted && rate === settings.speechRate) setRefMs((m) => ({ ...m, [item.id]: Math.round(performance.now() - t0) }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPlaying(false);
    }
  }

  async function check(transcript: string, durationSec?: number) {
    const r = await api<Result>("/api/shadowing", {
      body: {
        exerciseId: item.id,
        day,
        transcript,
        durationMs: durationSec ? Math.round(durationSec * 1000) : undefined,
        referenceDurationMs: refMs[item.id],
      },
    });
    setResults((m) => ({ ...m, [item.id]: { ...r, transcript } }));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <Badge tone="brand">Sentence {idx + 1} of {items.length}</Badge>
          <div className="flex gap-1">
            <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} aria-label="Previous sentence"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
            <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))} disabled={idx === items.length - 1} aria-label="Next sentence"><ChevronRight className="h-4 w-4" aria-hidden /></button>
          </div>
        </div>
        <ol className="mb-5 space-y-1 text-sm text-muted">
          <li><span className="font-semibold text-fg">1.</span> Listen to the model sentence (as many times as you like).</li>
          <li><span className="font-semibold text-fg">2.</span> Record yourself repeating it with the same rhythm.</li>
          <li><span className="font-semibold text-fg">3.</span> Compare: green = matched, red = missed, amber = different word.</li>
        </ol>
        <div className="rounded-2xl bg-surface-2 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Reference</p>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={showText} onChange={(e) => setShowText(e.target.checked)} /> Show text
            </label>
          </div>
          <p className={clsx("text-lg font-medium", !showText && "select-none blur-sm")} aria-hidden={!showText}>{item.text}</p>
          <p className="mt-2 text-xs text-muted"><span className="font-semibold">Focus:</span> {item.focus}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => playRef()} disabled={playing}>
              {playing ? <Spinner /> : <Play className="h-4 w-4" aria-hidden />} Play model
            </button>
            <button type="button" className="btn-secondary" onClick={() => playRef(0.75)} disabled={playing}>
              <Volume2 className="h-4 w-4" aria-hidden /> Slow
            </button>
          </div>
        </div>
        {error && <ErrorBanner className="mt-3" message={error} />}
        <div className="mt-5">
          <VoiceInput
            key={item.id}
            mode="SHADOWING"
            lockTranscript
            submitLabel="Compare"
            placeholder="No microphone? Type exactly what you said aloud."
            onSubmit={async (text, meta) => check(text, meta.durationSec)}
          />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 font-semibold">Comparison</h3>
        {result ? (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <div className={clsx("text-3xl font-bold tabular-nums", result.accuracy >= 85 ? "text-success" : result.accuracy >= 60 ? "text-warn" : "text-danger")}>{result.accuracy}%</div>
              <p className="text-muted">word accuracy<br />(words recognised in the right order)</p>
            </div>
            <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Reference vs. you</p><DiffView tokens={result.tokens} /></div>
            <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">What we heard</p><p className="text-muted">“{result.transcript}”</p></div>
            {paceNote(result.paceRatio) && <p><span className="font-semibold">Rhythm/pace: </span>{paceNote(result.paceRatio)}</p>}
            <Notice>
              Based on speech recognition, not a phoneme-level pronunciation score. A missed word can mean unclear pronunciation — or a recognition error.
            </Notice>
            {idx < items.length - 1 && (
              <button type="button" className="btn-primary w-full" onClick={() => setIdx(idx + 1)}>Next sentence <ChevronRight className="h-4 w-4" aria-hidden /></button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Record yourself to see which words matched.</p>
        )}
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">This set</p>
          <ul className="space-y-1.5">
            {items.map((s, i) => (
              <li key={s.id}>
                <button type="button" onClick={() => setIdx(i)} className={clsx("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", i === idx ? "bg-brand/10" : "hover:bg-surface-2")}>
                  <span className={clsx("h-2 w-2 shrink-0 rounded-full", results[s.id] ? (results[s.id]!.accuracy >= 85 ? "bg-success" : "bg-warn") : "bg-border")} aria-hidden />
                  <span className="truncate">{s.text}</span>
                  {results[s.id] && <span className="ml-auto text-xs tabular-nums text-muted">{results[s.id]!.accuracy}%</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
