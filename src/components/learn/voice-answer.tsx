"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { Keyboard, Loader2, Mic, RotateCcw, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client/api";
import { browserSttSupported, recordingSupport, stopSpeaking, unlockAudio, useBrowserStt, useRecorder, type MicError } from "@/lib/client/speech";
import { useL, usePrefs } from "@/components/app/ui-context";

export interface VoiceMeta {
  durationMs?: number;
  inputMode: "voice" | "text";
  recording?: Blob;
}

const noopSubscribe = () => () => {};

const MIC_MSG: Record<MicError, [string, string]> = {
  denied: ["ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน — เปิดสิทธิ์ในการตั้งค่าเบราว์เซอร์ (iPhone: การตั้งค่า → Safari → ไมโครโฟน) หรือพิมพ์คำตอบแทน", "Microphone permission denied. Allow it in browser settings (iPhone: Settings → Safari → Microphone) or type instead."],
  no_device: ["ไม่พบไมโครโฟน — พิมพ์คำตอบแทนได้", "No microphone found — you can type instead."],
  busy: ["ไมโครโฟนกำลังถูกใช้งานโดยแอปอื่น", "The microphone is in use by another app."],
  unknown: ["เปิดไมโครโฟนไม่สำเร็จ — พิมพ์คำตอบแทนได้", "Couldn't start the microphone — you can type instead."],
  insecure: ["การใช้ไมโครโฟนต้องเปิดผ่าน HTTPS", "The microphone needs a secure (HTTPS) connection."],
  unsupported: ["เบราว์เซอร์นี้อัดเสียงไม่ได้ — พิมพ์คำตอบแทนได้", "This browser can't record audio — you can type instead."],
};

/**
 * Record → transcribe → review → submit. Server speech-to-text when configured,
 * otherwise the browser's speech recognition; typing is always available.
 */
export function VoiceAnswer({
  sttLang,
  languageId,
  onSubmit,
  busy,
  lockTranscript,
  submitLabel,
  placeholder,
  initialText = "",
  onDraft,
}: {
  sttLang: string;
  languageId: string;
  onSubmit: (text: string, meta: VoiceMeta) => Promise<void> | void;
  busy?: boolean;
  lockTranscript?: boolean;
  submitLabel?: string;
  placeholder?: string;
  initialText?: string;
  onDraft?: (text: string) => void;
}) {
  const L = useL();
  const { sttServer } = usePrefs();
  const rec = useRecorder();
  const sr = useBrowserStt(sttLang);
  const [text, setText] = useState(initialText);
  const [chosenMode, setMode] = useState<"voice" | "text">("voice");
  const [spoken, setSpoken] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Device capabilities never change after load; the server snapshot assumes recording works.
  const canRecord = useSyncExternalStore(noopSubscribe, () => recordingSupport().ok, () => true);
  const canBrowserStt = useSyncExternalStore(noopSubscribe, browserSttSupported, () => false);
  const caps = { record: canRecord, browser: canBrowserStt };
  const usingBrowser = useRef(false);

  const recording = rec.state === "recording" || sr.listening;
  const voiceAvailable = (sttServer && caps.record) || caps.browser;
  const mode = voiceAvailable ? chosenMode : "text";

  async function startVoice() {
    setErr(null);
    unlockAudio();
    stopSpeaking();
    usingBrowser.current = !(sttServer && caps.record) && caps.browser;
    let ok = false;
    if (caps.record) ok = await rec.start();
    if (usingBrowser.current) ok = sr.start() || ok;
    if (!ok) setMode("text");
  }

  async function stopVoice() {
    setTranscribing(true);
    const [r, browserText] = await Promise.all([rec.stop(), usingBrowser.current ? sr.stop() : Promise.resolve("")]);
    let t = browserText;
    try {
      if (!usingBrowser.current && r) {
        const form = new FormData();
        form.append("audio", r.blob, "speech");
        form.append("language", languageId);
        t = (await api<{ text: string }>("/api/speech/stt", { form, timeoutMs: 60_000 })).text;
      }
      if (!t.trim()) setErr(L("ไม่ได้ยินเสียงพูด ลองใหม่ใกล้ไมโครโฟน หรือพิมพ์คำตอบ", "We couldn't hear any words. Try again closer to the mic, or type."));
      setText(t);
      onDraft?.(t);
      setSpoken(!!t.trim());
    } catch {
      setErr(L("แปลงเสียงเป็นข้อความไม่สำเร็จ — พิมพ์สิ่งที่พูดแทนได้", "Transcription failed — you can type what you said."));
      setMode("text");
    } finally {
      setTranscribing(false);
    }
  }

  async function submit() {
    if (!text.trim()) return;
    await onSubmit(text.trim(), { durationMs: spoken && rec.recording ? rec.recording.durationMs : undefined, inputMode: spoken ? "voice" : "text", recording: spoken ? rec.recording?.blob : undefined });
  }

  const micError = rec.error ? L(...MIC_MSG[rec.error]) : null;

  return (
    <div className="space-y-3">
      {mode === "voice" && voiceAvailable && (
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="flex h-10 items-center gap-[3px]" aria-hidden>
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className={cn("w-[3px] rounded-full transition-[height] duration-75", recording ? "bg-primary" : "bg-border")} style={{ height: `${recording ? Math.max(12, Math.min(100, (rec.level || 0.35) * 160 * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7))))) : 12}%` }} />
            ))}
          </div>
          {sr.listening && sr.interim && <p className={cn("max-w-md text-center text-sm text-muted-foreground", languageId === "zh" && "zh")}>{sr.interim}</p>}
          <button
            type="button"
            onClick={recording ? stopVoice : startVoice}
            disabled={busy || transcribing || rec.state === "requesting"}
            className={cn("relative grid size-16 place-items-center rounded-full text-white shadow-md transition-transform active:scale-95 disabled:opacity-50", recording ? "bg-red-600" : "bg-primary")}
            aria-label={recording ? L("หยุดอัดเสียง", "Stop recording") : L("เริ่มพูด", "Start speaking")}
          >
            {recording && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/30" aria-hidden />}
            {transcribing || rec.state === "requesting" ? <Loader2 className="size-6 animate-spin" /> : recording ? <Square className="size-6" /> : <Mic className="size-7" />}
          </button>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {transcribing ? L("กำลังแปลงเสียง…", "Transcribing…") : recording ? `${L("กำลังฟัง… แตะเพื่อหยุด", "Listening… tap to stop")} · ${Math.floor(rec.elapsed / 1000)}s` : text ? L("ตรวจข้อความแล้วกดส่ง", "Check the transcript, then submit") : L("แตะไมโครโฟนแล้วพูด", "Tap the mic and speak")}
          </p>
        </div>
      )}
      {(mode === "text" || text) && (
        <div>
          <label htmlFor="answer" className="sr-only">
            {L("คำตอบ", "Answer")}
          </label>
          <Textarea
            id="answer"
            value={text}
            readOnly={lockTranscript && spoken}
            onChange={(e) => {
              setText(e.target.value);
              onDraft?.(e.target.value);
            }}
            placeholder={placeholder ?? L("พิมพ์คำตอบ…", "Type your answer…")}
            className={cn(languageId === "zh" && "zh")}
            maxLength={5000}
          />
          {spoken && !lockTranscript && <p className="mt-1 text-xs text-muted-foreground">{L("ข้อความจากการรู้จำเสียง — แก้เฉพาะคำที่ระบบฟังผิด", "Transcript from speech recognition — only fix recognition errors.")}</p>}
        </div>
      )}
      {(err || micError || sr.error) && (
        <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {err ?? micError ?? L("การรู้จำเสียงขัดข้อง — พิมพ์คำตอบแทนได้", "Speech recognition error — you can type instead.")}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {voiceAvailable && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode(mode === "voice" ? "text" : "voice")} disabled={recording}>
              {mode === "voice" ? <Keyboard /> : <Mic />} {mode === "voice" ? L("พิมพ์แทน", "Type instead") : L("พูดแทน", "Use voice")}
            </Button>
          )}
          {rec.recording && !recording && (
            <Button type="button" variant="ghost" size="sm" onClick={() => (rec.reset(), setText(""), setSpoken(false))}>
              <RotateCcw /> {L("อัดใหม่", "Re-record")}
            </Button>
          )}
        </div>
        <Button type="button" onClick={submit} disabled={busy || recording || transcribing || !text.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : <Send />} {submitLabel ?? L("ส่งคำตอบ", "Submit")}
        </Button>
      </div>
      {rec.recording && !recording && <audio controls src={rec.recording.url} className="h-10 w-full" aria-label={L("เสียงของคุณ", "Your recording")} />}
    </div>
  );
}
