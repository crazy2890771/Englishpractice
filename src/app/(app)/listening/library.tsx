"use client";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { listeningLibrary } from "@/content/listening-index";
import { ListeningExercise } from "@/components/practice/listening-exercise";
import { useStudyTime } from "@/lib/client/use-study-time";
import { Badge, Notice } from "@/components/ui";

const ACCENTS = { US: "American", UK: "British", AU: "Australian", IN: "Indian" } as const;

export function ListeningLibrary({ best, recommended }: { best: Record<string, number>; recommended: "standard" | "challenge" }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [level, setLevel] = useState<"standard" | "challenge">(recommended);
  const [accent, setAccent] = useState<"all" | keyof typeof ACCENTS>("all");
  useStudyTime({ active: !!selected });

  const list = useMemo(() => listeningLibrary.filter((x) => x.variant === level && (accent === "all" || x.exercise.accent === accent)), [level, accent]);
  const item = listeningLibrary.find((x) => x.exercise.id === selected);

  if (item) {
    return (
      <div className="space-y-4">
        <button type="button" className="btn-ghost" onClick={() => setSelected(null)}><ArrowLeft className="h-4 w-4" aria-hidden /> All exercises</button>
        <ListeningExercise key={item.exercise.id} exercise={item.exercise} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Notice>
        Recommended level for you: <strong>{recommended === "challenge" ? "Challenge (B2)" : "Standard"}</strong> — based on your last three scores. Difficulty rises automatically when you score 80%+.
      </Notice>
      <div className="flex flex-wrap items-center gap-2">
        {(["standard", "challenge"] as const).map((l) => (
          <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={clsx("rounded-full border px-4 py-1.5 text-sm font-medium capitalize", level === l ? "border-brand bg-brand text-white" : "border-border bg-surface")}>
            {l}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted">Accent</span>
          <select className="input w-auto py-1.5" value={accent} onChange={(e) => setAccent(e.target.value as typeof accent)}>
            <option value="all">All accents</option>
            {Object.entries(ACCENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map(({ day, exercise }) => (
          <li key={exercise.id}>
            <button type="button" onClick={() => setSelected(exercise.id)} className="card flex h-full w-full flex-col gap-2 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/50">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Day {day}</Badge>
                <Badge tone="brand">{exercise.level}</Badge>
                <span className="text-xs text-muted">{ACCENTS[exercise.accent]}</span>
                {best[exercise.id] !== undefined && <Badge tone={best[exercise.id]! >= 60 ? "success" : "warn"} className="ml-auto">Best {best[exercise.id]}%</Badge>}
              </div>
              <h3 className="font-semibold">{exercise.title}</h3>
              <p className="line-clamp-2 text-sm text-muted">{exercise.scenario}</p>
              <p className="mt-auto text-xs text-muted">{exercise.lines.length} lines · {exercise.questions.length} questions</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
