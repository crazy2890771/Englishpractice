"use client";
import clsx from "clsx";
import { useState } from "react";
import { Bookmark, BookmarkCheck, Lightbulb } from "lucide-react";
import type { FeedbackItem, TurnFeedback } from "@/lib/ai/schemas";
import { RUBRICS, bandToPercent } from "@/lib/ai/schemas";
import { api, errorMessage } from "@/lib/client/api";
import { Badge, Spinner } from "../ui";

const CAT_TONE: Record<FeedbackItem["category"], "brand" | "warn" | "danger" | "success"> = {
  grammar: "danger",
  vocabulary: "warn",
  pronunciation: "brand",
  expression: "success",
};

export function CategoryBadge({ category }: { category: string }) {
  return <Badge tone={CAT_TONE[category.toLowerCase() as FeedbackItem["category"]] ?? "default"} className="capitalize">{category.toLowerCase()}</Badge>;
}

export function ScoreBars({ scores, keys }: { scores: Record<string, number>; keys: string[] }) {
  const colors = ["bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-pink-500"];
  return (
    <dl className="space-y-2.5">
      {keys.map((k, i) => {
        const band = scores[k] ?? 0;
        return (
          <div key={k} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm">
            <dt className="text-muted" title={RUBRICS[k]?.bands[Math.round(band) as 1]}>{RUBRICS[k]?.label ?? k}</dt>
            <dd className="h-2 overflow-hidden rounded-full bg-surface-2" aria-label={`${RUBRICS[k]?.label}: band ${band} of 5`}>
              <div className={clsx("h-full rounded-full", colors[i % colors.length])} style={{ width: `${bandToPercent(band)}%` }} />
            </dd>
            <dd className="text-right font-semibold tabular-nums">{Math.round(band * 10) / 10}/5</dd>
          </div>
        );
      })}
    </dl>
  );
}

export function RubricLegend({ keys }: { keys: string[] }) {
  return (
    <details className="text-xs text-muted">
      <summary className="cursor-pointer select-none font-medium">How scores work</summary>
      <p className="mt-2">Estimated bands 1–5 using a fixed rubric (not a certified CEFR or pronunciation assessment):</p>
      <ul className="mt-1 space-y-1">
        {keys.map((k) => (
          <li key={k}>
            <span className="font-semibold text-fg">{RUBRICS[k]?.label}:</span> 5 = {RUBRICS[k]?.bands[5]} 3 = {RUBRICS[k]?.bands[3]} 1 = {RUBRICS[k]?.bands[1]}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function SaveMistakesButton({ items, source }: { items: FeedbackItem[]; source: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  if (!items.length) return null;
  return (
    <div>
      <button
        type="button"
        className="btn-secondary w-full"
        disabled={state === "busy" || state === "done"}
        onClick={async () => {
          setState("busy");
          try {
            await api("/api/mistakes", { body: { source, items } });
            setState("done");
          } catch (e) {
            setMsg(errorMessage(e));
            setState("error");
          }
        }}
      >
        {state === "busy" ? <Spinner /> : state === "done" ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
        {state === "done" ? "Saved to Mistake Hub" : "Save to Mistakes"}
      </button>
      {state === "error" && <p className="mt-1 text-xs text-danger">{msg}</p>}
      {state === "idle" && <p className="mt-1 text-center text-xs text-muted">Corrections are also added automatically.</p>}
    </div>
  );
}

/** Original → corrected → natural, plus explanations. */
export function TurnFeedbackView({ feedback, source = "SPEAKING" }: { feedback: TurnFeedback; source?: string }) {
  const unchanged = feedback.corrected.trim() === feedback.original.trim();
  return (
    <div className="space-y-4 text-sm">
      <ol className="relative space-y-4 border-l border-border pl-5">
        <li>
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-sky-400" aria-hidden />
          <p className="font-semibold">Your sentence</p>
          <p className="mt-0.5 text-muted">{feedback.original}</p>
        </li>
        <li>
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
          <p className="font-semibold">{unchanged ? "Correct ✓" : "Corrected"}</p>
          <p className={clsx("mt-0.5", unchanged ? "text-muted" : "text-emerald-600 dark:text-emerald-300")}>{unchanged ? "No errors found — nice!" : feedback.corrected}</p>
        </li>
        {feedback.natural && feedback.natural.trim() !== feedback.corrected.trim() && (
          <li>
            <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-violet-400" aria-hidden />
            <p className="font-semibold">More natural</p>
            <p className="mt-0.5 text-violet-600 dark:text-violet-300">{feedback.natural}</p>
          </li>
        )}
      </ol>
      {feedback.items.length > 0 && (
        <div>
          <p className="mb-2 font-semibold">Why?</p>
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
        </div>
      )}
      {feedback.suggestedVocabulary.length > 0 && (
        <div>
          <p className="mb-2 font-semibold">Useful alternatives</p>
          <div className="flex flex-wrap gap-2">
            {feedback.suggestedVocabulary.map((v) => (
              <span key={v} className="chip">{v}</span>
            ))}
          </div>
        </div>
      )}
      {feedback.followUpExercise && (
        <div className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <p><span className="font-semibold">Try this: </span>{feedback.followUpExercise}</p>
        </div>
      )}
      <div className="rounded-xl bg-surface-2 p-3">
        <p className="mb-2 font-semibold">Estimated scores</p>
        <ScoreBars scores={feedback.scores} keys={["grammar", "vocabulary", "fluency", "taskCompletion"]} />
      </div>
      <SaveMistakesButton items={feedback.items} source={source} />
    </div>
  );
}
