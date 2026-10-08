"use client";
import { useState } from "react";
import { Plus, Trash2, Volume2 } from "lucide-react";
import { ReviewSession } from "@/components/practice/review-session";
import { Badge, EmptyState, ErrorBanner, Spinner, Tabs } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import { speak } from "@/lib/client/audio";
import { useAppConfig } from "@/components/providers";
import { useStudyTime } from "@/lib/client/use-study-time";

interface V { id: string; word: string; definition: string; example: string; day: number | null; mastered: boolean; successStreak: number; dueAt: string }

export function VocabularyDeck({ initial }: { initial: V[] }) {
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<"cards" | "list">("cards");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ word: "", definition: "", example: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings, providers } = useAppConfig();
  useStudyTime({ active: tab === "cards" });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { item } = await api<{ item: V & { dueAt: string } }>("/api/vocabulary", { body: form });
      setItems((x) => (x.some((i) => i.id === item.id) ? x : [...x, item]));
      setForm({ word: "", definition: "", example: "" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const filtered = items.filter((i) => !q || i.word.toLowerCase().includes(q.toLowerCase()) || i.definition.toLowerCase().includes(q.toLowerCase()));
  const mastered = items.filter((i) => i.mastered).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4"><p className="text-xs text-muted">Words</p><p className="text-2xl font-bold">{items.length}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">Learning</p><p className="text-2xl font-bold">{items.length - mastered}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">Mastered</p><p className="text-2xl font-bold text-success">{mastered}</p></div>
      </div>
      <Tabs tabs={[{ id: "cards", label: "Flashcards" }, { id: "list", label: "Word list" }]} value={tab} onChange={setTab} />
      {tab === "cards" ? (
        <ReviewSession filter="vocab" />
      ) : (
        <div className="space-y-4">
          <form onSubmit={add} className="card grid gap-3 p-4 md:grid-cols-[1fr_2fr_2fr_auto] md:items-end">
            <div><label className="label" htmlFor="w">Word or phrase</label><input id="w" className="input" required maxLength={80} value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} /></div>
            <div><label className="label" htmlFor="d">Meaning</label><input id="d" className="input" maxLength={300} value={form.definition} onChange={(e) => setForm({ ...form, definition: e.target.value })} /></div>
            <div><label className="label" htmlFor="ex">Example</label><input id="ex" className="input" maxLength={300} value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} /></div>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden />} Add</button>
            {error && <ErrorBanner className="md:col-span-4" message={error} />}
          </form>
          <input className="input max-w-xs" placeholder="Search words…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search words" />
          {filtered.length === 0 ? (
            <EmptyState title="No words yet">Start a lesson — its target vocabulary is added automatically.</EmptyState>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {filtered.map((v) => (
                <li key={v.id} className="card p-4 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold">{v.word}</p>
                    <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label={`Hear “${v.word}”`} onClick={() => speak(v.word, { accent: settings.accent, provider: providers.tts }).catch(() => {})}>
                      <Volume2 className="h-4 w-4" aria-hidden />
                    </button>
                    {v.day && <Badge>Day {v.day}</Badge>}
                    {v.mastered ? <Badge tone="success">Mastered</Badge> : <span className="text-xs text-muted">streak {v.successStreak}/3</span>}
                    <button type="button" className="btn-ghost ml-auto h-8 w-8 p-0" aria-label={`Delete ${v.word}`} onClick={async () => { setItems((x) => x.filter((i) => i.id !== v.id)); await api(`/api/vocabulary/${v.id}`, { method: "DELETE" }).catch(() => {}); }}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <p className="mt-1 text-muted">{v.definition}</p>
                  {v.example && <p className="mt-1 italic text-muted">“{v.example}”</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
