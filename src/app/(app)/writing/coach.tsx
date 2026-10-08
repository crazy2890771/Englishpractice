"use client";
import clsx from "clsx";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FreeWritingPrompt } from "@/content/writing-prompts";
import { WritingStudio, type WritingPromptInfo } from "@/components/practice/writing-studio";
import { useStudyTime } from "@/lib/client/use-study-time";
import { Badge, EmptyState } from "@/components/ui";
import { sectionPercent } from "@/lib/assessment";

interface Props {
  lessonPrompt: { day: number; title: string; prompt: WritingPromptInfo };
  prompts: FreeWritingPrompt[];
  history: { id: string; prompt: string; text: string; natural: string; scores: Record<string, number>; createdAt: string; day: number | null; live: boolean }[];
}

export function WritingCoach({ lessonPrompt, prompts, history }: Props) {
  const [choice, setChoice] = useState<string>("lesson");
  const [openId, setOpenId] = useState<string | null>(null);
  const router = useRouter();
  useStudyTime();
  const free = prompts.find((p) => p.id === choice);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Writing prompt">
        <button type="button" role="radio" aria-checked={choice === "lesson"} onClick={() => setChoice("lesson")} className={clsx("rounded-full border px-4 py-1.5 text-sm", choice === "lesson" ? "border-brand bg-brand text-white" : "border-border bg-surface")}>
          Day {lessonPrompt.day}: {lessonPrompt.title}
        </button>
        {prompts.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={choice === p.id} onClick={() => setChoice(p.id)} className={clsx("rounded-full border px-4 py-1.5 text-sm", choice === p.id ? "border-brand bg-brand text-white" : "border-border bg-surface")}>
            {p.title}
          </button>
        ))}
      </div>
      {choice === "lesson" ? (
        <WritingStudio key="lesson" day={lessonPrompt.day} prompt={lessonPrompt.prompt} onSubmitted={() => router.refresh()} />
      ) : free ? (
        <WritingStudio key={free.id} prompt={free} onSubmitted={() => router.refresh()} />
      ) : null}

      <section aria-labelledby="history">
        <h2 id="history" className="mb-3 font-semibold">Saved writing</h2>
        {history.length === 0 ? (
          <EmptyState title="No submissions yet">Your original and corrected texts are saved here.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="card p-4">
                <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setOpenId(openId === h.id ? null : h.id)} aria-expanded={openId === h.id}>
                  <span className="text-sm font-medium">{new Date(h.createdAt).toLocaleDateString()}</span>
                  {h.day && <Badge>Day {h.day}</Badge>}
                  <span className="line-clamp-1 flex-1 text-sm text-muted">{h.prompt}</span>
                  <Badge tone="brand">{sectionPercent(h.scores)}%</Badge>
                </button>
                {openId === h.id && (
                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <div><p className="mb-1 font-semibold">Original</p><p className="whitespace-pre-wrap text-muted">{h.text}</p></div>
                    <div><p className="mb-1 font-semibold">Natural version {h.live ? "" : "(demo)"}</p><p className="whitespace-pre-wrap">{h.natural}</p></div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
