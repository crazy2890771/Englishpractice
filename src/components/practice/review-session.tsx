"use client";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { isOfflineError, pendingReviewIds, postOrQueue } from "@/lib/client/outbox";
import { answersMatch } from "@/lib/text";
import { useAppConfig } from "../providers";
import { Badge, EmptyState, ErrorBanner, ProgressBar, Spinner } from "../ui";
import { CategoryBadge } from "./feedback-view";

interface MistakeCard {
  id: string;
  category: string;
  original: string;
  corrected: string;
  natural: string | null;
  explanation: string;
  successStreak: number;
}
interface VocabCard {
  id: string;
  word: string;
  definition: string;
  example: string;
  successStreak: number;
}
type Card = { kind: "mistake"; item: MistakeCard } | { kind: "vocab"; item: VocabCard };

/** Interleaves due mistakes (correction exercises) and vocabulary (flashcards). */
export function ReviewSession({ day, onReviewed, filter = "all" }: { day?: number; onReviewed?: (n: number) => void; filter?: "all" | "mistakes" | "vocab" }) {
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [i, setI] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<{ correct: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const { user } = useAppConfig();

  const load = useCallback(async () => {
    setError(null);
    setQueue(null);
    try {
      // Offline, the service worker serves the last downloaded queue; hide items already rated offline.
      const q = await api<{ mistakes: MistakeCard[]; vocab: VocabCard[] }>("/api/review/queue");
      const pending = pendingReviewIds(user.id);
      const m: Card[] = filter === "vocab" ? [] : q.mistakes.filter((x) => !pending.has(x.id)).map((item) => ({ kind: "mistake", item }));
      const v: Card[] = filter === "mistakes" ? [] : q.vocab.filter((x) => !pending.has(x.id)).map((item) => ({ kind: "vocab", item }));
      const mixed: Card[] = [];
      while (m.length || v.length) {
        if (m.length) mixed.push(m.shift()!);
        if (v.length) mixed.push(v.shift()!);
      }
      setQueue(mixed);
      setI(0);
    } catch (e) {
      setError(
        isOfflineError(e)
          ? "You're offline and your review queue hasn't been downloaded yet. Use “Download for offline” in Settings next time you're online."
          : errorMessage(e),
      );
    }
  }, [filter, user.id]);

  useEffect(() => void load(), [load]);

  function next() {
    setAnswer("");
    setRevealed(false);
    setChecked(null);
    setI((x) => x + 1);
    setDone((d) => {
      onReviewed?.(d + 1);
      return d + 1;
    });
  }

  async function checkMistake(card: MistakeCard) {
    setBusy(true);
    try {
      const out = await postOrQueue<{ correct: boolean }>(user.id, `/api/review/mistake/${card.id}`, { answer, day }, day ? { day, step: "review" } : undefined);
      // Offline: check on the device with the same matching rule the server uses.
      const correct = out.queued ? answersMatch(answer, card.corrected, card.natural ? [card.natural] : []) : out.data.correct;
      if (out.queued) setOfflineCount((n) => n + 1);
      setChecked({ correct });
      setRevealed(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function rate(card: Card, quality: number) {
    setBusy(true);
    try {
      const url = card.kind === "vocab" ? `/api/review/vocab/${card.item.id}` : `/api/review/mistake/${card.item.id}`;
      const out = await postOrQueue(user.id, url, { quality, day }, day ? { day, step: "review" } : undefined);
      if (out.queued) setOfflineCount((n) => n + 1);
      next();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!queue) return <div className="grid min-h-[200px] place-items-center"><Spinner label="Loading review" /></div>;
  if (queue.length === 0 || i >= queue.length) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-8 w-8 text-success" />}
        title={done > 0 ? `Review complete — ${done} item${done > 1 ? "s" : ""} reviewed` : "Nothing due right now"}
        action={<button type="button" className="btn-secondary" onClick={load}><RotateCcw className="h-4 w-4" aria-hidden /> Check again</button>}
      >
        {done > 0 ? "Items come back on a spaced schedule. They're mastered after three successful reviews on different days." : "New mistakes and vocabulary appear here when they're due."}
      </EmptyState>
    );
  }

  const card = queue[i]!;
  return (
    <div className="mx-auto max-w-2xl">
      {offlineCount > 0 && (
        <p className="mb-3 rounded-xl bg-brand-soft px-3 py-2 text-xs" role="status">
          Offline: {offlineCount} {offlineCount === 1 ? "review is" : "reviews are"} saved on this device and will sync when you reconnect.
        </p>
      )}
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar value={(i / queue.length) * 100} label="Review progress" />
        <span className="shrink-0 text-xs tabular-nums text-muted">{i + 1}/{queue.length}</span>
      </div>
      <div className="card p-6">
        {card.kind === "mistake" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><CategoryBadge category={card.item.category} /><Badge>Fix the mistake</Badge><span className="ml-auto text-xs text-muted">Streak {card.item.successStreak}/3</span></div>
            <p className="text-lg"><span className="text-muted">You said: </span>“{card.item.original}”</p>
            {!revealed ? (
              <>
                <label htmlFor="fix" className="label">Write the corrected version</label>
                <input id="fix" className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && answer.trim() && checkMistake(card.item)} autoFocus autoComplete="off" />
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className="btn-ghost" onClick={() => setRevealed(true)}>Show answer</button>
                  <button type="button" className="btn-primary" disabled={!answer.trim() || busy} onClick={() => checkMistake(card.item)}>{busy && <Spinner />} Check</button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {checked && (
                  <p className={clsx("flex items-center gap-2 font-semibold", checked.correct ? "text-success" : "text-danger")}>
                    {checked.correct ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <XCircle className="h-5 w-5" aria-hidden />}
                    {checked.correct ? "Correct!" : "Not quite."}
                  </p>
                )}
                <p><span className="font-semibold">Correct: </span><span className="text-success">{card.item.corrected}</span></p>
                {card.item.natural && <p><span className="font-semibold">Natural: </span>{card.item.natural}</p>}
                <p className="text-sm text-muted">{card.item.explanation}</p>
                {checked ? (
                  <div className="flex justify-end"><button type="button" className="btn-primary" onClick={next}>Next</button></div>
                ) : (
                  <RateButtons busy={busy} onRate={(q) => rate(card, q)} />
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2"><Badge tone="brand">Vocabulary</Badge><span className="text-xs text-muted">Streak {card.item.successStreak}/3</span></div>
            <p className="text-3xl font-bold">{card.item.word}</p>
            {!revealed ? (
              <>
                <p className="text-sm text-muted">Say what it means and use it in a sentence, then reveal.</p>
                <button type="button" className="btn-primary" onClick={() => setRevealed(true)} autoFocus>Reveal</button>
              </>
            ) : (
              <div className="space-y-3 text-left">
                <p><span className="font-semibold">Meaning: </span>{card.item.definition}</p>
                {card.item.example && <p className="italic text-muted">“{card.item.example}”</p>}
                <RateButtons busy={busy} onRate={(q) => rate(card, q)} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RateButtons({ onRate, busy }: { onRate: (q: number) => void; busy: boolean }) {
  const opts = [
    { q: 1, label: "Again", cls: "border-danger/40 text-danger" },
    { q: 3, label: "Hard", cls: "border-warn/40 text-warn" },
    { q: 4, label: "Good", cls: "border-brand/40 text-brand" },
    { q: 5, label: "Easy", cls: "border-success/40 text-success" },
  ];
  return (
    <div className="grid grid-cols-4 gap-2 pt-2" role="group" aria-label="How well did you remember?">
      {opts.map((o) => (
        <button key={o.q} type="button" disabled={busy} onClick={() => onRate(o.q)} className={clsx("btn border bg-surface", o.cls)}>{o.label}</button>
      ))}
    </div>
  );
}
