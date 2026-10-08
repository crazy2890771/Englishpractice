"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Lightbulb, X } from "lucide-react";
import type { WritingFeedback } from "@/lib/ai/schemas";
import { api, errorMessage, isAbort } from "@/lib/client/api";
import { wordCount } from "@/lib/text";
import { Badge, DemoBadge, EmptyState, ErrorBanner, Spinner, Tabs } from "../ui";
import { CategoryBadge, RubricLegend, SaveMistakesButton, ScoreBars } from "./feedback-view";

export interface WritingPromptInfo {
  id: string;
  type: string;
  prompt: string;
  tips?: string[];
  minWords: number;
  maxWords: number;
}

/** Highlights each corrected fragment inside the learner's text. */
export function highlightErrors(text: string, fragments: string[]): ReactNode[] {
  const frags = fragments.filter((f) => f.trim().length > 0).sort((a, b) => b.length - a.length);
  if (!frags.length) return [text];
  const escaped = frags.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  return text.split(re).map((part, i) => (frags.includes(part) ? <mark key={i} className="rounded bg-danger/20 px-0.5 text-fg underline decoration-danger decoration-wavy underline-offset-4">{part}</mark> : part));
}

export function WritingStudio({ prompt, day, onSubmitted }: { prompt: WritingPromptInfo; day?: number; onSubmitted?: (words: number) => void }) {
  const draftKey = `efl-draft:${day ?? "free"}:${prompt.id}`;
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<(WritingFeedback & { live: boolean }) | null>(null);
  const [submittedText, setSubmittedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"feedback" | "corrections" | "natural">("feedback");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      setText(localStorage.getItem(draftKey) ?? "");
    } catch {
      /* ignore */
    }
    setFeedback(null);
  }, [draftKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (text) localStorage.setItem(draftKey, text);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [text, draftKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const words = wordCount(text);
  const inRange = words >= prompt.minWords && words <= prompt.maxWords;

  async function submit() {
    setBusy(true);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const res = await api<{ feedback: WritingFeedback; live: boolean }>("/api/writing", {
        body: { text, day, promptId: prompt.id },
        signal: abortRef.current.signal,
        timeoutMs: 90_000,
      });
      setFeedback({ ...res.feedback, live: res.live });
      setSubmittedText(text);
      setTab("feedback");
      onSubmitted?.(words);
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError(isAbort(e) ? "Cancelled. Your text is still here." : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const highlighted = useMemo(() => (feedback ? highlightErrors(submittedText, feedback.items.map((i) => i.original)) : null), [feedback, submittedText]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge tone="brand" className="capitalize">{prompt.type}</Badge>
            <span className="text-xs text-muted">{prompt.minWords}–{prompt.maxWords} words</span>
          </div>
          <p className="text-sm">{prompt.prompt}</p>
          {prompt.tips && prompt.tips.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">{prompt.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          )}
        </div>
        <div className="card p-4">
          <label htmlFor="writing" className="mb-2 block text-sm font-semibold">Your writing</label>
          {feedback && highlighted ? (
            <div className="min-h-[220px] whitespace-pre-wrap rounded-xl border border-border bg-surface p-3.5 text-sm leading-relaxed">{highlighted}</div>
          ) : (
            <textarea
              id="writing"
              className="input min-h-[260px] resize-y leading-relaxed"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Start writing here… (your draft is saved on this device)"
              maxLength={4000}
              spellCheck={false}
            />
          )}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className={inRange ? "text-success" : "text-muted"} aria-live="polite">{words} words</span>
            {!feedback && words > 0 && words < prompt.minWords && <span className="text-muted">{prompt.minWords - words} more to reach the target</span>}
          </div>
          {error && <ErrorBanner className="mt-3" message={error} onRetry={submit} />}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {feedback ? (
              <button type="button" className="btn-secondary" onClick={() => { setFeedback(null); setText(submittedText); }}>
                Revise and resubmit
              </button>
            ) : (
              <>
                <button type="button" className="btn-secondary" onClick={() => setText("")} disabled={!text || busy}>Clear</button>
                {busy && (
                  <button type="button" className="btn-ghost" onClick={() => abortRef.current?.abort()}><X className="h-4 w-4" aria-hidden /> Cancel</button>
                )}
                <button type="button" className="btn-primary" onClick={submit} disabled={busy || words < 20}>
                  {busy ? <Spinner /> : null} Check with AI <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card p-4">
        <Tabs
          tabs={[
            { id: "feedback", label: "Feedback" },
            { id: "corrections", label: "Corrections" },
            { id: "natural", label: "Natural version" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="mt-4">
          {!feedback ? (
            <EmptyState title="Feedback appears here">Write at least {prompt.minWords} words, then tap “Check with AI”.</EmptyState>
          ) : tab === "feedback" ? (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between"><p className="font-semibold">Overall feedback</p><DemoBadge live={feedback.live} /></div>
              <p className="text-muted">{feedback.overall}</p>
              <ScoreBars scores={feedback.scores} keys={["grammar", "vocabulary", "clarity", "coherence", "taskCompletion"]} />
              {feedback.weaknesses.length > 0 && (
                <div><p className="mb-1.5 font-semibold">Focus areas</p><div className="flex flex-wrap gap-2">{feedback.weaknesses.map((w) => <span key={w} className="chip">{w}</span>)}</div></div>
              )}
              <div className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                <p><span className="font-semibold">Tip: </span>{feedback.tip}</p>
              </div>
              {feedback.followUpExercise && <p><span className="font-semibold">Follow-up exercise: </span>{feedback.followUpExercise}</p>}
              <RubricLegend keys={["grammar", "vocabulary", "clarity", "coherence", "taskCompletion"]} />
            </div>
          ) : tab === "corrections" ? (
            <div className="space-y-3 text-sm">
              {feedback.items.length === 0 ? (
                <EmptyState title="No corrections">{feedback.live ? "Great accuracy!" : "The demo checker found no common errors. A live AI review can catch more."}</EmptyState>
              ) : (
                <ul className="space-y-2">
                  {feedback.items.map((it, i) => (
                    <li key={i} className="rounded-xl bg-surface-2 p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <CategoryBadge category={it.category} />
                        <span className="text-muted line-through decoration-danger/60">{it.original}</span>
                        <span aria-hidden>→</span>
                        <span className="font-medium">{it.corrected}</span>
                      </div>
                      <p className="text-muted">{it.explanation}</p>
                    </li>
                  ))}
                </ul>
              )}
              {feedback.suggestedVocabulary.length > 0 && (
                <div><p className="mb-1.5 font-semibold">Try using</p><div className="flex flex-wrap gap-2">{feedback.suggestedVocabulary.map((v) => <span key={v} className="chip">{v}</span>)}</div></div>
              )}
              <SaveMistakesButton items={feedback.items} source="WRITING" />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div><p className="mb-1 font-semibold">Corrected</p><p className="whitespace-pre-wrap text-muted">{feedback.corrected}</p></div>
              <div><p className="mb-1 font-semibold">Natural version</p><p className="whitespace-pre-wrap text-violet-700 dark:text-violet-300">{feedback.natural}</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
