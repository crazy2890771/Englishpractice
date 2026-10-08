"use client";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { ReviewSession } from "@/components/practice/review-session";
import { CategoryBadge } from "@/components/practice/feedback-view";
import { Badge, EmptyState, Tabs } from "@/components/ui";
import { api } from "@/lib/client/api";
import { useStudyTime } from "@/lib/client/use-study-time";
import { MASTERY_STREAK } from "@/lib/srs";

interface M {
  id: string;
  category: string;
  sourceMode: string;
  original: string;
  corrected: string;
  natural: string | null;
  explanation: string;
  occurrences: number;
  successStreak: number;
  mastered: boolean;
  dueAt: string;
}

const CATS = ["ALL", "GRAMMAR", "VOCABULARY", "PRONUNCIATION", "EXPRESSION"] as const;

export function MistakeNotebook({ initial }: { initial: M[] }) {
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<"review" | "notebook">(initial.some((m) => !m.mastered && new Date(m.dueAt) <= new Date()) ? "review" : "notebook");
  const [cat, setCat] = useState<(typeof CATS)[number]>("ALL");
  const [show, setShow] = useState<"active" | "mastered">("active");
  useStudyTime({ active: tab === "review" });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of items) if (!m.mastered) c[m.category] = (c[m.category] ?? 0) + 1;
    return c;
  }, [items]);
  const list = items.filter((m) => (cat === "ALL" || m.category === cat) && (show === "mastered" ? m.mastered : !m.mastered));
  const due = items.filter((m) => !m.mastered && new Date(m.dueAt) <= new Date()).length;

  async function remove(id: string) {
    setItems((x) => x.filter((m) => m.id !== id));
    await api(`/api/mistakes/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATS.slice(1).map((c) => (
          <div key={c} className="card p-4">
            <CategoryBadge category={c} />
            <p className="mt-2 text-2xl font-bold">{counts[c] ?? 0}</p>
            <p className="text-xs text-muted">to master</p>
          </div>
        ))}
      </div>
      <Tabs tabs={[{ id: "review", label: `Review${due ? ` (${due} due)` : ""}` }, { id: "notebook", label: "Notebook" }]} value={tab} onChange={setTab} />
      {tab === "review" ? (
        <ReviewSession filter="mistakes" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {CATS.map((c) => (
              <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={clsx("rounded-full border px-3 py-1.5 text-xs font-semibold capitalize", cat === c ? "border-brand bg-brand text-white" : "border-border bg-surface")}>
                {c.toLowerCase()}
              </button>
            ))}
            <select className="input ml-auto w-auto py-1.5" value={show} onChange={(e) => setShow(e.target.value as typeof show)} aria-label="Show">
              <option value="active">Learning</option>
              <option value="mastered">Mastered</option>
            </select>
          </div>
          {list.length === 0 ? (
            <EmptyState title={show === "mastered" ? "Nothing mastered yet" : "No mistakes here"}>
              {show === "mastered" ? `Items are mastered after ${MASTERY_STREAK} successful reviews spread over several days.` : "Corrections from speaking, writing, roleplay and shadowing appear here automatically."}
            </EmptyState>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {list.map((m) => (
                <li key={m.id} className="card p-4 text-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <CategoryBadge category={m.category} />
                    <span className="text-xs capitalize text-muted">from {m.sourceMode.toLowerCase()}</span>
                    {m.occurrences > 1 && <Badge tone="warn">seen ×{m.occurrences}</Badge>}
                    <button type="button" className="btn-ghost ml-auto h-8 w-8 p-0" aria-label="Delete mistake" onClick={() => remove(m.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <p><span className="text-muted line-through decoration-danger/60">{m.original}</span></p>
                  <p className="mt-1 font-medium text-success">{m.corrected}</p>
                  {m.natural && <p className="mt-1 text-violet-600 dark:text-violet-300">{m.natural}</p>}
                  <p className="mt-2 text-muted">{m.explanation}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                    <span>Mastery</span>
                    {Array.from({ length: MASTERY_STREAK }, (_, i) => (
                      <span key={i} className={clsx("h-1.5 w-6 rounded-full", i < m.successStreak ? "bg-success" : "bg-surface-2")} />
                    ))}
                    {!m.mastered && <span className="ml-auto">Next review {new Date(m.dueAt) <= new Date() ? "now" : new Date(m.dueAt).toLocaleDateString()}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
