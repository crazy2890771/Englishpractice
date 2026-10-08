"use client";
import clsx from "clsx";
import { useState } from "react";
import { ArrowLeft, Briefcase, Building2, Headset, Plane, PlaneTakeoff, Users } from "lucide-react";
import type { RoleplayScenario } from "@/content/types";
import { ConversationRoom } from "@/components/practice/conversation-room";
import { useStudyTime } from "@/lib/client/use-study-time";
import { Badge } from "@/components/ui";

const ICONS = { interview: Briefcase, hotel: Building2, airport: PlaneTakeoff, workplace: Users, "customer-service": Headset, aviation: Plane } as const;
const CATS = ["all", "interview", "hotel", "airport", "workplace", "customer-service", "aviation"] as const;

export function RoleplaySimulator({ scenarios }: { scenarios: RoleplayScenario[] }) {
  const [selected, setSelected] = useState<RoleplayScenario | null>(null);
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const [level, setLevel] = useState<"all" | "B1" | "B2">("all");
  useStudyTime({ active: !!selected });

  if (selected) {
    return (
      <div className="space-y-4">
        <button type="button" className="btn-ghost" onClick={() => setSelected(null)}><ArrowLeft className="h-4 w-4" aria-hidden /> All scenarios</button>
        <div className="card p-4 text-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{selected.title}</h2><Badge tone="brand">{selected.level}</Badge></div>
          <p className="text-muted">{selected.setting}</p>
          <p className="mt-2"><span className="font-semibold">You are:</span> {selected.learnerRole} · <span className="font-semibold">Talking to:</span> {selected.character.name}, {selected.character.role}</p>
        </div>
        <ConversationRoom
          key={selected.id}
          mode="ROLEPLAY"
          topicKey={`roleplay:${selected.id}`}
          title={selected.title}
          subtitle={`${selected.character.name} · ${selected.character.role}`}
          characterName={selected.character.name}
          objectives={selected.objectives}
          usefulPhrases={selected.usefulPhrases}
        />
      </div>
    );
  }

  const list = scenarios.filter((s) => (cat === "all" || s.category === cat) && (level === "all" || s.level === level));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {CATS.map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={clsx("rounded-full border px-3 py-1.5 text-sm capitalize", cat === c ? "border-brand bg-brand text-white" : "border-border bg-surface hover:bg-surface-2")}>
            {c.replace("-", " ")}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted">Difficulty</span>
          <select className="input w-auto py-1.5" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
            <option value="all">All</option>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => {
          const Icon = ICONS[s.category];
          return (
            <button key={s.id} type="button" onClick={() => setSelected(s)} className="card flex flex-col gap-2 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/50">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 text-brand"><Icon className="h-4 w-4" aria-hidden /></span>
                <Badge>{s.level}</Badge>
                <span className="text-xs capitalize text-muted">{s.category.replace("-", " ")}</span>
              </div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="line-clamp-2 text-sm text-muted">{s.setting}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted">{s.objectives.map((o) => <li key={o}>• {o}</li>)}</ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
