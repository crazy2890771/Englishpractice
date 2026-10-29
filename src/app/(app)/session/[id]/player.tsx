"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Flag, Loader2, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ExercisePlayer, type ExerciseResult } from "@/components/learn/exercise-player";
import { Flashcard, type VocabCardData } from "@/components/learn/flashcard";
import { useL, usePrefs } from "@/components/app/ui-context";
import { api, ApiError } from "@/lib/client/api";
import { errorText, SKILL_NAMES } from "@/i18n";
import { cn } from "@/lib/utils";
import type { ClientDialogue, ClientExercise, ClientPassage } from "@/server/dto";
import type { PlanActivity } from "@/engine/planner";
import type { Response } from "@/engine/scoring";
import { SessionSummary } from "./summary";
import { saveRecording } from "@/lib/client/recordings";

export interface SessionViewData {
  sectionTitles: Record<string, { th: string; en: string }>;
  unitTitle: { th: string; en: string; level: string } | null;
  session: { id: string; kind: string; languageId: string; skills: string[]; status: string; durationMinutes: number; activeSeconds: number; summary: unknown; exam: boolean };
  activities: PlanActivity[];
  state: { pos: { a: number; i: number }; answered: Record<string, { done: boolean; correct?: boolean; score?: number }>; drafts: Record<string, string>; vocabDone: Record<string, boolean> };
  exercises: Record<string, ClientExercise>;
  materials: Record<string, ClientDialogue | ClientPassage>;
  vocab: VocabCardData[];
  results: Record<string, ExerciseResult>;
}

const ACTIVITY_NAMES: Record<string, [string, string]> = {
  warmup: ["วอร์มอัพ", "Warm-up"],
  vocab_review: ["ทบทวนคำศัพท์", "Spaced review"],
  weakness_review: ["ทบทวนจุดอ่อน", "Weakness review"],
  corrections: ["แก้ไขและลองใหม่", "Corrections & retry"],
  mini_assessment: ["แบบทดสอบย่อย", "Mini assessment"],
  unit_assessment: ["แบบทดสอบประจำหน่วย", "Unit assessment"],
};

const KIND_NAMES: Record<string, [string, string]> = {
  scheduled: ["บทเรียนวันนี้", "Today's lesson"],
  practice: ["ฝึกเพิ่มเติม", "Practice"],
  makeup: ["เรียนชดเชย", "Make-up lesson"],
  review: ["วันทบทวน", "Review day"],
  remediation: ["บทเรียนทบทวนก่อนสอบใหม่", "Remediation"],
  unit_assessment: ["แบบทดสอบประจำหน่วย", "Unit assessment"],
  level_exam: ["สอบเลื่อนระดับ", "Level exam"],
};

type Item = { kind: "exercise"; exerciseId: string } | { kind: "vocab"; vocabId: string };

export function SessionPlayer({ view, ttsLang, sttLang }: { view: SessionViewData; ttsLang: string; sttLang: string }) {
  const L = useL();
  const router = useRouter();
  const { uiLang, saveRecordings, userId } = usePrefs();
  const { session } = view;
  const exam = session.exam;
  const [results, setResults] = useState<Record<string, ExerciseResult>>(view.results);
  const [answered, setAnswered] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.keys(view.state.answered).map((k) => [k, true])));
  const [vocabDone, setVocabDone] = useState<Record<string, boolean>>(view.state.vocabDone);
  const [retried, setRetried] = useState<Record<string, boolean>>({});
  const [pos, setPos] = useState(view.state.pos);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<unknown>(session.status === "completed" ? session.summary : null);
  const [seconds, setSeconds] = useState(session.activeSeconds);
  const lastInteraction = useRef(0);
  const pendingSeconds = useRef(0);

  // Corrections & retry = exercises answered wrongly so far in this session (practice only).
  const activities = useMemo(() => {
    const wrong = Object.entries(results).filter(([, r]) => !r.correct).map(([id]) => id);
    return view.activities.map((a) => (a.type === "corrections" ? { ...a, items: wrong.map((id) => ({ kind: "exercise" as const, exerciseId: id, reason: "consolidation" as const })) } : a));
  }, [view.activities, results]);

  const flat = useMemo(() => activities.flatMap((a, ai) => a.items.map((it, ii) => ({ a: ai, i: ii, item: it as Item }))), [activities]);
  const total = flat.length;
  const doneCount = flat.filter(({ a, item }) => (item.kind === "vocab" ? vocabDone[item.vocabId] : activities[a]!.type === "corrections" ? retried[item.exerciseId] : answered[item.exerciseId])).length;
  const activity = activities[pos.a];
  const current = activity?.items[pos.i] as Item | undefined;

  /* ── autosave position ── */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePatch = useCallback((patch: object) => api(`/api/sessions/${session.id}/state`, { method: "PATCH", body: patch }).catch(() => {}), [session.id]);
  useEffect(() => {
    if (summary) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void savePatch({ pos }), 400);
  }, [pos, savePatch, summary]);

  /* ── active-time heartbeat (visible, not paused, interacted in the last 2 minutes) ── */
  useEffect(() => {
    if (summary) return;
    const mark = () => (lastInteraction.current = Date.now());
    mark();
    window.addEventListener("pointerdown", mark);
    window.addEventListener("keydown", mark);
    const tick = setInterval(() => {
      if (!paused && document.visibilityState === "visible" && Date.now() - lastInteraction.current < 120_000) {
        pendingSeconds.current += 1;
        setSeconds((s) => s + 1);
      }
    }, 1000);
    const flush = setInterval(() => {
      const n = Math.min(60, pendingSeconds.current);
      if (n > 0) {
        pendingSeconds.current -= n;
        void api(`/api/sessions/${session.id}/time`, { body: { seconds: n } }).catch(() => (pendingSeconds.current += n));
      }
    }, 30_000);
    return () => {
      clearInterval(tick);
      clearInterval(flush);
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, [paused, session.id, summary]);

  // Drafts are committed to state on the same debounce as the autosave, so going back restores them.
  const [drafts, setDrafts] = useState<Record<string, string>>(view.state.drafts);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onDraft(exerciseId: string, text: string) {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      setDrafts((d) => ({ ...d, [exerciseId]: text }));
      void savePatch({ draft: { exerciseId, text } });
    }, 800);
  }

  function go(delta: number) {
    const idx = flat.findIndex((f) => f.a === pos.a && f.i === pos.i);
    const next = flat[Math.max(0, Math.min(flat.length - 1, idx + delta))];
    if (next) setPos({ a: next.a, i: next.i });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(exerciseId: string, response: Response, meta: { durationMs?: number; retry?: boolean; recording?: Blob }) {
    setError(null);
    if (saveRecordings && meta.recording) {
      const ex = view.exercises[exerciseId];
      void saveRecording(userId, meta.recording, { languageId: session.languageId, exerciseId, prompt: ex?.prompt, transcript: "transcript" in response ? response.transcript : undefined, durationMs: meta.durationMs });
    }
    const isCorrection = activity?.type === "corrections";
    try {
      const r = await api<{ saved: true; result?: ExerciseResult }>(`/api/sessions/${session.id}/answer`, {
        body: { exerciseId, response, durationMs: meta.durationMs, retry: meta.retry || isCorrection || undefined },
        timeoutMs: 90_000,
      });
      if (isCorrection) {
        setRetried((x) => ({ ...x, [exerciseId]: true }));
        if (r.result) setResults((x) => ({ ...x, [`retry:${exerciseId}`]: r.result! }));
      } else {
        setAnswered((x) => ({ ...x, [exerciseId]: true }));
        if (r.result) setResults((x) => ({ ...x, [exerciseId]: r.result! }));
      }
      if (exam) go(1);
    } catch (e) {
      setError(errorText((e as ApiError).code, uiLang));
      throw e;
    }
  }

  async function rateVocab(itemId: string, quality: number) {
    try {
      await api(`/api/sessions/${session.id}/vocab`, { body: { itemId, quality } });
      setVocabDone((x) => ({ ...x, [itemId]: true }));
      go(1);
    } catch (e) {
      setError(errorText((e as ApiError).code, uiLang));
    }
  }

  async function finish() {
    setFinishing(true);
    setError(null);
    try {
      const n = pendingSeconds.current;
      if (n > 0) await api(`/api/sessions/${session.id}/time`, { body: { seconds: Math.min(60, n) } }).catch(() => {});
      pendingSeconds.current = 0;
      const r = await api<{ summary: unknown }>(`/api/sessions/${session.id}/complete`, { method: "POST", timeoutMs: 60_000 });
      setSummary(r.summary);
      router.refresh();
    } catch (e) {
      setError(errorText((e as ApiError).code, uiLang));
    } finally {
      setFinishing(false);
    }
  }

  if (summary) return <SessionSummary kind={session.kind} languageId={session.languageId} summary={summary as Record<string, unknown>} />;

  const activityTitle = (a: PlanActivity) => (a.type === "skill" ? L(SKILL_NAMES[a.skill!]!.th, SKILL_NAMES[a.skill!]!.en) : a.type === "exam_section" ? L(view.sectionTitles[a.sectionId!]?.th ?? "", view.sectionTitles[a.sectionId!]?.en ?? "") : L(...(ACTIVITY_NAMES[a.type] ?? [a.type, a.type])));
  const allDone = doneCount >= flat.filter(({ a }) => activities[a]!.type !== "corrections").length;
  const isLast = flat.findIndex((f) => f.a === pos.a && f.i === pos.i) === flat.length - 1;
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/today" aria-label={L("ออก (บันทึกไว้แล้ว)", "Exit (progress saved)")}>
              <X /> {L("ออก", "Exit")}
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{L(...(KIND_NAMES[session.kind] ?? [session.kind, session.kind]))}</Badge>
            <span className="font-mono text-sm tabular-nums text-muted-foreground" aria-label={L("เวลาเรียน", "Study time")}>
              {mm(seconds)} / {session.durationMinutes}:00
            </span>
            <Button variant="ghost" size="icon" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={paused ? L("เรียนต่อ", "Resume") : L("พัก", "Pause")}>
              {paused ? <Play /> : <Pause />}
            </Button>
          </div>
        </div>
        <Progress value={total ? (doneCount / total) * 100 : 0} aria-label={L("ความคืบหน้าบทเรียน", "Lesson progress")} />
        <nav aria-label={L("กิจกรรม", "Activities")} className="flex gap-1.5 overflow-x-auto pb-1">
          {activities.map((a, ai) => {
            const items = a.items as Item[];
            const done = items.length > 0 && items.every((it) => (it.kind === "vocab" ? vocabDone[it.vocabId] : a.type === "corrections" ? retried[it.exerciseId] : answered[it.exerciseId]));
            return (
              <button
                key={a.id}
                type="button"
                disabled={items.length === 0}
                onClick={() => setPos({ a: ai, i: 0 })}
                aria-current={ai === pos.a ? "step" : undefined}
                className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40", ai === pos.a ? "border-primary bg-accent text-accent-foreground" : "hover:bg-secondary")}
              >
                {done && <CheckCircle2 className="size-3.5 text-emerald-600" />}
                {activityTitle(a)} <span className="text-muted-foreground">{items.length}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {paused ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="font-medium">{L("พักอยู่ — เวลาเรียนจะไม่ถูกนับ", "Paused — study time isn't counted")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{L("คำตอบทั้งหมดบันทึกแล้ว กลับมาเรียนต่อได้ทุกเมื่อ", "Everything is saved. Come back any time.")}</p>
          <Button className="mt-4" onClick={() => setPaused(false)}>
            <Play /> {L("เรียนต่อ", "Resume")}
          </Button>
        </div>
      ) : !current ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {activity?.type === "corrections" ? L("ยังไม่มีข้อที่ต้องแก้ เยี่ยมมาก!", "Nothing to correct — great job!") : activity?.type === "vocab_review" ? L("ไม่มีคำศัพท์ที่ถึงกำหนดทบทวน", "No words are due for review.") : L("ไม่มีแบบฝึกในส่วนนี้", "No exercises here.")}
        </div>
      ) : current.kind === "vocab" ? (
        (() => {
          const card = view.vocab.find((v) => v.id === current.vocabId);
          return card ? (
            vocabDone[card.id] ? (
              <p className="rounded-2xl border bg-card p-6 text-center text-sm">{L("ทบทวนคำนี้แล้ว", "Reviewed")} ✓</p>
            ) : (
              <Flashcard key={card.id} card={card} languageId={session.languageId} ttsLang={ttsLang} onRate={(q) => rateVocab(card.id, q)} />
            )
          ) : null;
        })()
      ) : (
        (() => {
          const ex = view.exercises[current.exerciseId];
          if (!ex) return null;
          const isCorrection = activity!.type === "corrections";
          const result = isCorrection ? results[`retry:${ex.id}`] : results[ex.id];
          return (
            <section aria-label={activityTitle(activity!)} className="space-y-3">
              {isCorrection && (
                <p className="rounded-xl bg-accent px-4 py-2.5 text-sm text-accent-foreground">{L("ลองทำข้อนี้อีกครั้ง — คุณตอบผิดก่อนหน้านี้", "Try this one again — you missed it earlier.")}</p>
              )}
              <ExercisePlayer
                key={`${isCorrection ? "r" : ""}${ex.id}`}
                exercise={ex}
                material={ex.source ? view.materials[ex.source] : null}
                languageId={session.languageId}
                ttsLang={ttsLang}
                sttLang={sttLang}
                result={result ?? null}
                hideFeedback={exam}
                draft={drafts[ex.id]}
                onDraft={(t) => onDraft(ex.id, t)}
                onSubmit={(r, meta) => submit(ex.id, r, meta)}
              />
            </section>
          );
        })()
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!paused && (
        <footer className="flex items-center justify-between gap-3 border-t pt-4">
          <Button variant="ghost" onClick={() => go(-1)} disabled={flat.findIndex((f) => f.a === pos.a && f.i === pos.i) <= 0}>
            <ArrowLeft /> {L("ก่อนหน้า", "Previous")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {doneCount}/{total}
          </span>
          {isLast || allDone ? (
            <Button onClick={finish} disabled={finishing}>
              {finishing ? <Loader2 className="animate-spin" /> : <Flag />} {exam ? L("ส่งข้อสอบ", "Submit exam") : L("จบบทเรียน", "Finish")}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => go(1)}>
              {L("ถัดไป", "Next")} <ArrowRight />
            </Button>
          )}
        </footer>
      )}
    </div>
  );
}
