"use client";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Mic, RotateCcw, Send, Square } from "lucide-react";
import { useAppConfig } from "../providers";
import { ErrorBanner, Spinner } from "../ui";
import { Waveform } from "./waveform";
import { api, errorMessage } from "@/lib/client/api";
import { browserSttSupported, recordingSupport, stopSpeaking, unlockAudio, useRecorder, useSpeechRecognition } from "@/lib/client/audio";

export interface VoiceSubmitMeta {
  durationSec?: number;
  recordingId?: string;
  spoken: boolean;
}

interface Props {
  onSubmit: (text: string, meta: VoiceSubmitMeta) => Promise<void> | void;
  disabled?: boolean;
  busy?: boolean;
  mode: "SPEAKING" | "ROLEPLAY" | "SHADOWING" | "ASSESSMENT";
  placeholder?: string;
  /** Countdown in seconds (timed responses). Recording stops automatically. */
  timeLimitSec?: number;
  submitLabel?: string;
  /** Shadowing: keep transcript read-only so the comparison is honest. */
  lockTranscript?: boolean;
  label?: string;
}

/**
 * Turn-based voice input: record → transcribe (server STT or browser recognition) →
 * review transcript → send. Always offers a text-only fallback.
 */
export function VoiceInput({ onSubmit, disabled, busy, mode, placeholder = "Type your answer…", timeLimitSec, submitLabel = "Send", lockTranscript, label }: Props) {
  const { providers, settings } = useAppConfig();
  const rec = useRecorder({ maxMs: (timeLimitSec ?? 120) * 1000 });
  const sr = useSpeechRecognition("en-US");
  const [typed, setTyped] = useState(false);
  const [text, setText] = useState("");
  const [spoken, setSpoken] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState({ record: true, browserStt: false, ready: false });
  const usingBrowserStt = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const autoStopped = useRef(false);

  useEffect(() => {
    const record = recordingSupport().ok;
    const browserStt = browserSttSupported();
    setCaps({ record, browserStt, ready: true });
    if (!record && !(browserStt && providers.stt === "browser")) setTyped(true);
  }, [providers.stt]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const canVoice = caps.record || caps.browserStt;
  const recording = rec.state === "recording" || sr.listening;

  async function startVoice() {
    setError(null);
    setText("");
    autoStopped.current = false;
    unlockAudio();
    stopSpeaking();
    rec.reset();
    const serverStt = providers.stt === "openai" && caps.record;
    usingBrowserStt.current = !serverStt && caps.browserStt;
    let ok = true;
    if (caps.record) ok = await rec.start();
    if (usingBrowserStt.current) {
      // On some iOS versions recognition and recording compete for the mic; recognition wins.
      const srOk = sr.start();
      if (!srOk && !ok) setTyped(true);
    } else if (!ok) {
      setTyped(true);
    }
  }

  async function stopVoice() {
    setTranscribing(true);
    const [recording, browserText] = await Promise.all([rec.stop(), usingBrowserStt.current ? sr.stop() : Promise.resolve("")]);
    let transcript = browserText;
    try {
      if (!usingBrowserStt.current && recording) {
        const form = new FormData();
        form.append("audio", recording.blob, "speech");
        abortRef.current = new AbortController();
        const out = await api<{ text: string }>("/api/ai/stt", { form, signal: abortRef.current.signal, timeoutMs: 60_000 });
        transcript = out.text;
      }
      if (!transcript.trim()) {
        setError("We couldn't hear any words. Try again closer to the microphone, or type your answer.");
      }
      setText(transcript);
      setSpoken(!!transcript.trim());
    } catch (e) {
      setError(`${errorMessage(e)} You can type what you said instead.`);
      setTyped(true);
    } finally {
      setTranscribing(false);
    }
  }

  // Auto-stop at the time limit.
  useEffect(() => {
    if (timeLimitSec && recording && rec.elapsedMs >= timeLimitSec * 1000 && !autoStopped.current) {
      autoStopped.current = true;
      void stopVoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.elapsedMs, recording, timeLimitSec]);

  async function submit() {
    const value = text.trim();
    if (!value) return;
    setError(null);
    let recordingId: string | undefined;
    if (spoken && settings.saveRecordings && rec.recording) {
      try {
        const form = new FormData();
        form.append("audio", rec.recording.blob, "speech");
        form.append("mode", mode);
        form.append("durationMs", String(rec.recording.durationMs));
        form.append("label", value.slice(0, 120));
        recordingId = (await api<{ id: string }>("/api/recordings", { form })).id;
      } catch {
        /* saving the recording is optional; continue */
      }
    }
    try {
      await onSubmit(value, { durationSec: spoken && rec.recording ? rec.recording.durationMs / 1000 : undefined, recordingId, spoken });
      setText("");
      setSpoken(false);
      rec.reset();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const remaining = timeLimitSec ? Math.max(0, timeLimitSec - Math.floor(rec.elapsedMs / 1000)) : null;
  const liveText = sr.listening ? `${sr.transcript} ${sr.interim}`.trim() : "";

  return (
    <div className="space-y-3" aria-label={label}>
      {!typed && canVoice && (
        <div className="flex flex-col items-center gap-3">
          <Waveform level={rec.level || (sr.listening ? 0.4 : 0)} active={recording} bars={28} />
          {liveText && <p className="max-w-md text-center text-sm text-muted" aria-live="polite">{liveText}</p>}
          <div className="relative">
            {recording && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-danger/40" aria-hidden />}
            <button
              type="button"
              disabled={disabled || busy || transcribing || rec.state === "requesting"}
              onClick={recording ? stopVoice : startVoice}
              className={clsx(
                "relative grid h-20 w-20 place-items-center rounded-full text-white shadow-glow transition-transform active:scale-95 disabled:opacity-50",
                recording ? "bg-danger" : "bg-gradient-to-br from-blue-500 to-violet-600",
              )}
              aria-label={recording ? "Stop recording" : "Start recording"}
            >
              {transcribing || rec.state === "requesting" ? <Spinner className="h-7 w-7" /> : recording ? <Square className="h-7 w-7" aria-hidden /> : <Mic className="h-8 w-8" aria-hidden />}
            </button>
          </div>
          <p className="text-sm text-muted" aria-live="polite">
            {transcribing
              ? "Transcribing…"
              : recording
                ? remaining !== null
                  ? `Recording… ${remaining}s left · tap to stop`
                  : "Listening… tap to stop"
                : text
                  ? "Check your transcript, then send"
                  : "Tap the microphone and speak"}
          </p>
        </div>
      )}

      {(typed || text || (!canVoice && caps.ready)) && (
        <div>
          <label htmlFor={`answer-${mode}`} className="sr-only">Your answer</label>
          <textarea
            id={`answer-${mode}`}
            className="input min-h-[96px] resize-y"
            value={text}
            readOnly={lockTranscript && spoken}
            onChange={(e) => {
              setText(e.target.value);
            }}
            placeholder={placeholder}
            maxLength={2000}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
          />
          {spoken && !lockTranscript && <p className="mt-1 text-xs text-muted">Transcript from speech recognition — fix recognition errors only, so feedback reflects what you said.</p>}
        </div>
      )}

      {(error || rec.error || sr.error) && <ErrorBanner message={error ?? rec.error ?? sr.error ?? ""} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {canVoice && (
            <button type="button" className="btn-ghost" onClick={() => setTyped((t) => !t)} disabled={recording}>
              {typed ? <Mic className="h-4 w-4" aria-hidden /> : <Keyboard className="h-4 w-4" aria-hidden />} {typed ? "Use voice" : "Type instead"}
            </button>
          )}
          {rec.recording && !recording && (
            <button type="button" className="btn-ghost" onClick={() => { rec.reset(); setText(""); setSpoken(false); }}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Re-record
            </button>
          )}
        </div>
        <button type="button" className="btn-primary" onClick={submit} disabled={disabled || busy || !text.trim() || recording || transcribing}>
          {busy ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />} {submitLabel}
        </button>
      </div>
      {rec.recording && !recording && (
        <audio controls src={rec.recording.url} className="h-10 w-full" aria-label="Your recording" />
      )}
    </div>
  );
}
