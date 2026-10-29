"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Flag, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VoiceAnswer } from "@/components/learn/voice-answer";
import { EvaluationView } from "@/components/learn/exercise-player";
import { useL, usePrefs } from "@/components/app/ui-context";
import { api, ApiError } from "@/lib/client/api";
import { errorText, TOPIC_NAMES } from "@/i18n";
import { speakSegments, stopSpeaking, unlockAudio } from "@/lib/client/speech";
import { cn } from "@/lib/utils";
import type { OpenEvaluation } from "@/engine/open-eval";

interface Msg {
  id: string;
  role: "tutor" | "learner";
  content: string;
  feedback: OpenEvaluation | null;
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

export function ConversationClient(props: { id: string; languageId: string; topic: string; level: string; correctionMode: string; evaluator: string; status: string; ttsLang: string; sttLang: string; initial: Msg[] }) {
  const L = useL();
  const { uiLang, ttsServer, playbackSpeed } = usePrefs();
  const [messages, setMessages] = useState<Msg[]>(props.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(props.status !== "active");
  const [summary, setSummary] = useState<{ turns: number; average: number } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const zh = props.languageId === "zh";
  const showFeedbackNow = props.correctionMode !== "end";

  useEffect(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), [messages.length]);
  useEffect(() => () => stopSpeaking(), []);

  function say(text: string) {
    unlockAudio();
    void speakSegments([{ voice: "female", t: b64(text) }], { lang: props.ttsLang, rate: playbackSpeed, server: ttsServer }).catch(() => {});
  }

  async function send(text: string, meta: { durationMs?: number; inputMode: "voice" | "text" }) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ learnerMessage: Msg; tutorMessage: Msg; feedback: OpenEvaluation }>(`/api/conversations/${props.id}/turn`, { body: { text, inputMode: meta.inputMode, durationMs: meta.durationMs }, timeoutMs: 90_000 });
      setMessages((m) => [...m, { ...r.learnerMessage, feedback: r.feedback }, r.tutorMessage]);
      if (voiceOn) say(r.tutorMessage.content);
    } catch (e) {
      setError(errorText((e as ApiError).code, uiLang));
    } finally {
      setBusy(false);
    }
  }

  async function end() {
    const r = await api<{ summary: { turns: number; average: number } }>(`/api/conversations/${props.id}/end`, { method: "POST" });
    setSummary(r.summary);
    setEnded(true);
  }

  const learnerMsgs = messages.filter((m) => m.role === "learner");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/practice">
            <X /> {L("ออก", "Exit")}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant="secondary">{L(TOPIC_NAMES[props.topic]?.th ?? props.topic, TOPIC_NAMES[props.topic]?.en ?? props.topic)} · {props.level}</Badge>
          <Badge variant={props.evaluator === "ai" ? "success" : "warning"}>{props.evaluator === "ai" ? L("ครู AI", "AI tutor") : L("เดโม: บทสนทนาตามสคริปต์", "Demo: scripted tutor")}</Badge>
          <Button variant="ghost" size="sm" onClick={() => (setVoiceOn((v) => !v), stopSpeaking())} aria-pressed={voiceOn}>
            <Volume2 /> {voiceOn ? L("เสียงเปิด", "Voice on") : L("ปิดเสียง", "Muted")}
          </Button>
        </div>
      </header>

      <div ref={listRef} className="max-h-[55dvh] space-y-3 overflow-y-auto rounded-2xl border bg-card p-4" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col gap-2", m.role === "learner" ? "items-end" : "items-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px]", m.role === "learner" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-secondary", zh && "zh")}>
              {m.content}
              {m.role === "tutor" && (
                <button type="button" onClick={() => say(m.content)} className="ml-2 inline-flex align-middle opacity-60 hover:opacity-100" aria-label={L("ฟังอีกครั้ง", "Play again")}>
                  <Volume2 className="size-4" />
                </button>
              )}
            </div>
            {m.role === "learner" && m.feedback && (showFeedbackNow || ended) && (
              <details className="w-full max-w-[85%] rounded-xl border bg-background p-3 text-sm" open={props.correctionMode === "immediate" && m.feedback.mistakes.length > 0}>
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  {m.feedback.mistakes.length ? L(`${m.feedback.mistakes.length} จุดที่ควรแก้`, `${m.feedback.mistakes.length} correction(s)`) : L("ไม่พบข้อผิดพลาด ✓", "No mistakes found ✓")}
                </summary>
                <div className="mt-3">
                  <EvaluationView ev={m.feedback} />
                </div>
              </details>
            )}
          </div>
        ))}
      </div>

      {summary && (
        <div className="rounded-2xl border bg-card p-4 text-sm">
          <p className="font-medium">{L(`สรุป: ตอบ ${summary.turns} ครั้ง · คะแนนเฉลี่ย ${Math.round(summary.average * 100)}%`, `Summary: ${summary.turns} turns · average ${Math.round(summary.average * 100)}%`)}</p>
          {props.correctionMode === "end" && <p className="mt-1 text-muted-foreground">{L("ดูการแก้ไขของแต่ละคำตอบด้านบน", "See corrections for each answer above.")}</p>}
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!ended ? (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <VoiceAnswer key={messages.length} sttLang={props.sttLang} languageId={props.languageId} busy={busy} onSubmit={(t, meta) => send(t, meta)} submitLabel={L("ส่ง", "Send")} />
          <div className="flex justify-end border-t pt-3">
            <Button variant="outline" size="sm" onClick={end} disabled={busy || learnerMsgs.length === 0}>
              <Flag /> {L("จบการสนทนา", "End conversation")}
            </Button>
          </div>
        </div>
      ) : (
        <Button asChild>
          <Link href="/practice">{L("กลับไปหน้าฝึกฝน", "Back to Practice")}</Link>
        </Button>
      )}
    </div>
  );
}
