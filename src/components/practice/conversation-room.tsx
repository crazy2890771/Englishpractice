"use client";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Flag, Square, Volume2, VolumeX, X } from "lucide-react";
import type { RoleplaySummary, TurnFeedback } from "@/lib/ai/schemas";
import { api, errorMessage, isAbort } from "@/lib/client/api";
import { speak, stopSpeaking } from "@/lib/client/audio";
import { useAppConfig } from "../providers";
import { Badge, DemoBadge, EmptyState, ErrorBanner, Notice, Spinner, Tabs } from "../ui";
import { VoiceInput } from "../audio/voice-input";
import { RubricLegend, ScoreBars, TurnFeedbackView } from "./feedback-view";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  feedback?: (TurnFeedback & { live?: boolean }) | null;
  createdAt: string;
}

interface Summary {
  turns: number;
  averages: Record<string, number | null>;
  corrections: number;
  roleplay?: RoleplaySummary & { live: boolean };
}

interface Props {
  topicKey: string;
  day?: number;
  title: string;
  subtitle?: string;
  characterName?: string;
  objectives?: string[];
  usefulPhrases?: string[];
  timeLimitSec?: number;
  targetTurns?: number;
  /** Resume the latest active conversation for this topic instead of starting fresh. */
  resume?: boolean;
  onTurn?: (learnerTurns: number) => void;
  onEnded?: (summary: Summary) => void;
  mode: "SPEAKING" | "ROLEPLAY";
}

export function ConversationRoom(props: Props) {
  const { settings, providers } = useAppConfig();
  const [convoId, setConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "ended" | "error">("loading");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<{ text: string; meta: { durationSec?: number; recordingId?: string } } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"corrections" | "transcript" | "vocabulary">("corrections");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ending, setEnding] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const interruptionFree = settings.interruptionFree;

  const learnerTurns = messages.filter((m) => m.role === "user").length;

  const say = useCallback(
    async (m: Msg) => {
      setSpeakingId(m.id);
      try {
        await speak(m.content, { accent: settings.accent, rate: settings.speechRate, provider: providers.tts, gender: "female" });
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setSpeakingId(null);
      }
    },
    [settings.accent, settings.speechRate, providers.tts],
  );

  const start = useCallback(
    async (fresh: boolean) => {
      setStatus("loading");
      setError(null);
      setSummary(null);
      setComplete(false);
      try {
        if (!fresh && props.resume) {
          const list = await api<{ conversations: { id: string; status: string }[] }>(`/api/conversations?topic=${encodeURIComponent(props.topicKey)}`);
          const active = list.conversations.find((c) => c.status === "active");
          if (active) {
            const { conversation } = await api<{ conversation: { id: string; messages: Msg[] } }>(`/api/conversations/${active.id}`);
            setConvoId(conversation.id);
            setMessages(conversation.messages);
            setStatus("ready");
            return;
          }
        }
        const { conversation } = await api<{ conversation: { id: string; messages: Msg[] } }>("/api/conversations", {
          body: { topic: props.topicKey, day: props.day },
        });
        setConvoId(conversation.id);
        setMessages(conversation.messages);
        setStatus("ready");
      } catch (e) {
        setError(errorMessage(e));
        setStatus("error");
      }
    },
    [props.resume, props.topicKey, props.day],
  );

  useEffect(() => {
    void start(false);
    return () => {
      abortRef.current?.abort();
      stopSpeaking();
    };
  }, [start]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send(text: string, meta: { durationSec?: number; recordingId?: string }) {
    if (!convoId) return;
    setSending(true);
    setError(null);
    setLastFailed(null);
    abortRef.current = new AbortController();
    try {
      const res = await api<{ userMessage: Msg; reply: Msg; feedback: TurnFeedback; live: boolean; scenarioComplete: boolean }>(
        `/api/conversations/${convoId}/turn`,
        { body: { text, ...meta }, signal: abortRef.current.signal, timeoutMs: 60_000 },
      );
      const userMsg = { ...res.userMessage, feedback: { ...res.feedback, live: res.live } };
      setMessages((m) => [...m, userMsg, res.reply]);
      setSelected(userMsg.id);
      setTab("corrections");
      props.onTurn?.(learnerTurns + 1);
      if (res.scenarioComplete) setComplete(true);
      if (autoSpeak) void say(res.reply);
    } catch (e) {
      if (isAbort(e)) {
        setError("Cancelled. Your answer is kept — send it again when ready.");
      } else {
        setError(errorMessage(e));
      }
      setLastFailed({ text, meta });
      throw e;
    } finally {
      setSending(false);
    }
  }

  async function end() {
    if (!convoId) return;
    setEnding(true);
    setError(null);
    stopSpeaking();
    try {
      const { summary } = await api<{ summary: Summary }>(`/api/conversations/${convoId}/end`, { method: "POST", timeoutMs: 60_000 });
      setSummary(summary);
      setStatus("ended");
      props.onEnded?.(summary);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setEnding(false);
    }
  }

  const userMsgs = messages.filter((m) => m.role === "user");
  const current = userMsgs.find((m) => m.id === selected) ?? userMsgs[userMsgs.length - 1];
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const live = current?.feedback?.live ?? providers.mode === "live";
  const showFeedback = !interruptionFree || status === "ended";

  if (status === "loading") {
    return (
      <div className="card grid min-h-[320px] place-items-center p-6">
        <Spinner className="h-6 w-6" label="Starting conversation" />
      </div>
    );
  }
  if (status === "error" && !convoId) {
    return <ErrorBanner message={error ?? "Couldn't start the conversation."} onRetry={() => start(false)} />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Voice column */}
      <section className="card relative overflow-hidden p-5" aria-label="Voice controls">
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-[radial-gradient(circle_at_center,rgb(99_102_241/0.35),transparent_65%)]" aria-hidden />
        <div className="relative flex flex-col items-center gap-4">
          <div
            className={clsx(
              "mt-2 h-28 w-28 rounded-full bg-[radial-gradient(circle_at_35%_30%,#a5b4fc,#6366f1_45%,#4c1d95_75%)] shadow-[0_0_60px_-5px_rgb(129_140_248/0.8)] transition-transform sm:h-36 sm:w-36",
              (speakingId || sending) && "animate-pulse",
            )}
            aria-hidden
          />
          <p className="text-sm font-semibold" aria-live="polite">
            {sending ? "Thinking…" : speakingId ? `${props.characterName ?? "AI"} is speaking…` : status === "ended" ? "Session ended" : "Your turn"}
          </p>
          {props.timeLimitSec && status !== "ended" && <Badge tone="brand">Timed: {props.timeLimitSec}s per answer</Badge>}
          {status !== "ended" ? (
            <div className="w-full">
              <VoiceInput
                mode={props.mode}
                busy={sending}
                                timeLimitSec={props.timeLimitSec}
                onSubmit={async (text, meta) => {
                  stopSpeaking();
                  await send(text, meta);
                }}
              />
            </div>
          ) : null}
          {sending && (
            <button type="button" className="btn-ghost" onClick={() => abortRef.current?.abort()}>
              <X className="h-4 w-4" aria-hidden /> Cancel
            </button>
          )}
          {error && (
            <ErrorBanner
              message={error}
              onRetry={lastFailed ? () => void send(lastFailed.text, lastFailed.meta).catch(() => {}) : undefined}
            />
          )}
          <div className="flex w-full flex-wrap items-center justify-center gap-2 border-t border-border pt-4">
            <button type="button" className="btn-ghost" onClick={() => { setAutoSpeak((a) => !a); stopSpeaking(); }} aria-pressed={autoSpeak}>
              {autoSpeak ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />} {autoSpeak ? "Voice on" : "Muted"}
            </button>
            {speakingId && (
              <button type="button" className="btn-ghost" onClick={() => stopSpeaking()}>
                <Square className="h-4 w-4" aria-hidden /> Stop audio
              </button>
            )}
            {status !== "ended" ? (
              <button type="button" className="btn-secondary" onClick={end} disabled={ending || learnerTurns === 0}>
                {ending ? <Spinner /> : <Flag className="h-4 w-4" aria-hidden />} End & review
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => start(true)}>
                Start a new conversation
              </button>
            )}
          </div>
          {props.targetTurns ? (
            <p className="text-xs text-muted">
              {Math.min(learnerTurns, props.targetTurns)}/{props.targetTurns} turns for today&apos;s goal
            </p>
          ) : null}
        </div>
      </section>

      {/* Conversation column */}
      <section className="card flex max-h-[70vh] min-h-[320px] flex-col p-0" aria-label="Conversation">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{props.title}</h2>
            {props.subtitle && <p className="truncate text-xs text-muted">{props.subtitle}</p>}
          </div>
          <DemoBadge live={providers.mode === "live"} />
        </div>
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={clsx(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                  m.role === "user" ? "rounded-br-sm bg-brand text-brand-fg" : "rounded-bl-sm bg-surface-2",
                  m.role === "user" && selected === m.id && "ring-2 ring-accent",
                )}
              >
                <div className="mb-1 flex items-center gap-2 text-[11px] opacity-70">
                  <span className="font-semibold">{m.role === "user" ? "You" : props.characterName ?? "AI"}</span>
                  <time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                </div>
                <p className="whitespace-pre-wrap">{m.content}</p>
                <div className="mt-1.5 flex gap-3 text-[11px]">
                  {m.role === "assistant" && (
                    <button type="button" className="inline-flex items-center gap-1 opacity-70 hover:opacity-100" onClick={() => say(m)} aria-label="Play this message">
                      <Volume2 className="h-3.5 w-3.5" aria-hidden /> Replay
                    </button>
                  )}
                  {m.role === "user" && m.feedback && showFeedback && (
                    <button type="button" className="opacity-80 hover:opacity-100" onClick={() => { setSelected(m.id); setTab("corrections"); }}>
                      {m.feedback.items.length ? `${m.feedback.items.length} correction${m.feedback.items.length > 1 ? "s" : ""}` : "No errors ✓"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-surface-2 px-4 py-3"><Spinner label="AI is replying" /></div>
            </div>
          )}
        </div>
        {complete && status !== "ended" && (
          <div className="border-t border-border p-3">
            <Notice>
              {props.mode === "ROLEPLAY" ? "The scenario has reached its end." : "That's the end of the planned conversation."} Tap <strong>End &amp; review</strong> for your summary — or keep talking.
            </Notice>
          </div>
        )}
        {lastAssistant && status !== "ended" && !sending && (
          <p className="sr-only" aria-live="assertive">{lastAssistant.content}</p>
        )}
      </section>

      {/* Feedback column */}
      <section className="card p-4" aria-label="Feedback">
        <Tabs
          tabs={[
            { id: "corrections", label: "Corrections" },
            { id: "transcript", label: "Transcript" },
            { id: "vocabulary", label: "Phrases" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="mt-4">
          {summary && <SummaryView summary={summary} objectives={props.objectives} />}
          {tab === "corrections" &&
            (!showFeedback ? (
              <EmptyState title="Interruption-free mode">Feedback is hidden until you end the conversation, so you can focus on speaking.</EmptyState>
            ) : current?.feedback ? (
              <>
                <div className="mb-3 flex justify-end"><DemoBadge live={!!live} /></div>
                <TurnFeedbackView feedback={current.feedback} source={props.mode} />
                <div className="mt-3"><RubricLegend keys={["grammar", "vocabulary", "fluency", "taskCompletion"]} /></div>
              </>
            ) : (
              <EmptyState title="No feedback yet">Answer the question to see corrections and a more natural version.</EmptyState>
            ))}
          {tab === "transcript" && (
            <ol className="space-y-2 text-sm">
              {messages.map((m) => (
                <li key={m.id}>
                  <span className="font-semibold">{m.role === "user" ? "You" : props.characterName ?? "AI"}: </span>
                  <span className="text-muted">{m.content}</span>
                </li>
              ))}
            </ol>
          )}
          {tab === "vocabulary" && (
            <div className="space-y-4 text-sm">
              {props.objectives && props.objectives.length > 0 && (
                <div>
                  <p className="mb-2 font-semibold">Objectives</p>
                  <ul className="list-disc space-y-1 pl-5 text-muted">{props.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
                </div>
              )}
              {props.usefulPhrases && props.usefulPhrases.length > 0 ? (
                <div>
                  <p className="mb-2 font-semibold">Useful phrases</p>
                  <div className="flex flex-wrap gap-2">{props.usefulPhrases.map((p) => <span key={p} className="chip">{p}</span>)}</div>
                </div>
              ) : (
                !props.objectives && <EmptyState title="No phrase list">Suggested vocabulary appears in your corrections.</EmptyState>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryView({ summary, objectives }: { summary: Summary; objectives?: string[] }) {
  const avg = Object.fromEntries(Object.entries(summary.averages).filter(([, v]) => v !== null)) as Record<string, number>;
  return (
    <div className="mb-5 space-y-3 rounded-xl border border-brand/30 bg-brand-soft/50 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> Session summary</p>
      <p className="text-muted">{summary.turns} turns · {summary.corrections} corrections saved to your Mistake Hub.</p>
      {Object.keys(avg).length > 0 && <ScoreBars scores={avg} keys={["grammar", "vocabulary", "fluency", "taskCompletion"]} />}
      {summary.roleplay && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Roleplay feedback</p>
            <DemoBadge live={summary.roleplay.live} />
          </div>
          <ScoreBars
            scores={{ appropriateness: summary.roleplay.appropriateness, clarity: summary.roleplay.clarity, naturalness: summary.roleplay.naturalness }}
            keys={["appropriateness", "clarity", "naturalness"]}
          />
          {objectives && (
            <ul className="space-y-1">
              {objectives.map((o, i) => (
                <li key={o} className="flex gap-2">
                  <span aria-hidden>{summary.roleplay!.objectivesMet[i] ? "✅" : "⬜"}</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          )}
          <p>{summary.roleplay.comments}</p>
          {summary.roleplay.betterPhrases.map((b, i) => (
            <p key={i} className="text-xs"><span className="text-muted line-through">{b.original}</span> → <span className="font-medium">{b.better}</span></p>
          ))}
        </div>
      )}
    </div>
  );
}
