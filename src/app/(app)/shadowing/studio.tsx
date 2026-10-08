"use client";
import { useState } from "react";
import type { ShadowingSentence } from "@/content/types";
import { ShadowingTrainer } from "@/components/practice/shadowing-trainer";
import { useStudyTime } from "@/lib/client/use-study-time";

export function ShadowingStudio({ sets, initialDay }: { sets: { day: number; title: string; items: (ShadowingSentence & { id: string })[] }[]; initialDay: number }) {
  const [day, setDay] = useState(initialDay);
  useStudyTime();
  const set = sets.find((s) => s.day === day) ?? sets[0]!;
  return (
    <div className="space-y-4">
      <label className="flex max-w-md items-center gap-2 text-sm">
        <span className="shrink-0 text-muted">Sentence set</span>
        <select className="input" value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {sets.map((s) => <option key={s.day} value={s.day}>Day {s.day} — {s.title}</option>)}
        </select>
      </label>
      <ShadowingTrainer key={set.day} items={set.items} />
    </div>
  );
}
