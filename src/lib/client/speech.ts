"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* ───────────────────────── Text-to-speech ───────────────────────── */

export interface Segment {
  voice: "female" | "male";
  t: string; // base64 text
}

export function decodeSegment(s: Segment) {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(s.t), (c) => c.charCodeAt(0)));
  } catch {
    return "";
  }
}

const FEMALE = /(female|samantha|karen|moira|tessa|victoria|serena|fiona|zira|susan|allison|ava|kate|jenny|aria|ting-ting|tingting|mei-jia|meijia|sin-ji|xiaoxiao|xiaoyi|huihui|yaoyao|lili|google 普通话)/i;
const MALE = /(male|daniel|alex|fred|david|george|oliver|aaron|guy|ryan|kangkang|yunxi|yunyang|li-mu|limu)/i;

let voicesCache: SpeechSynthesisVoice[] = [];
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof speechSynthesis === "undefined") return Promise.resolve([]);
  const v = speechSynthesis.getVoices();
  if (v.length) return Promise.resolve((voicesCache = v));
  return new Promise((resolve) => {
    const done = () => resolve((voicesCache = speechSynthesis.getVoices()));
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1200);
  });
}

export function pickVoice(voices: SpeechSynthesisVoice[], lang: string, gender: "female" | "male") {
  const norm = (l: string) => l.replace("_", "-").toLowerCase();
  const base = lang.split("-")[0]!.toLowerCase();
  const exact = voices.filter((v) => norm(v.lang) === lang.toLowerCase());
  const same = exact.length ? exact : voices.filter((v) => norm(v.lang).startsWith(base));
  return same.find((v) => (gender === "female" ? FEMALE : MALE).test(v.name)) ?? same[0] ?? null;
}

export function browserTtsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** True when the browser has at least one voice for the language (e.g. zh-CN). */
export async function hasVoiceFor(lang: string) {
  if (!browserTtsSupported()) return false;
  const voices = voicesCache.length ? voicesCache : await loadVoices();
  return !!pickVoice(voices, lang, "female");
}

let sharedAudio: HTMLAudioElement | null = null;

/** iOS only allows audio after a user gesture: call this from a tap handler before playing. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  sharedAudio ??= new Audio();
  if (browserTtsSupported()) {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

const serverCache = new Map<string, string>();

async function speakServer(text: string, voice: "female" | "male", rate: number, signal?: AbortSignal) {
  const key = `${voice}|${rate}|${text}`;
  let url = serverCache.get(key);
  if (!url) {
    const res = await fetch("/api/speech/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, voice, speed: rate }), signal });
    if (!res.ok) throw new Error("tts_failed");
    url = URL.createObjectURL(await res.blob());
    serverCache.set(key, url);
  }
  sharedAudio ??= new Audio();
  const a = sharedAudio;
  a.src = url;
  a.playbackRate = 1;
  await new Promise<void>((resolve, reject) => {
    const stop = () => (a.pause(), resolve());
    signal?.addEventListener("abort", stop, { once: true });
    a.onended = () => resolve();
    a.onerror = () => reject(new Error("playback_failed"));
    a.play().catch(reject);
  });
}

async function speakBrowser(text: string, lang: string, voice: "female" | "male", rate: number, signal?: AbortSignal) {
  if (!browserTtsSupported()) throw new Error("no_tts");
  const voices = voicesCache.length ? voicesCache : await loadVoices();
  await new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(voices, lang, voice);
    if (v) u.voice = v;
    u.lang = v?.lang ?? lang;
    u.rate = rate;
    const watchdog = setTimeout(resolve, Math.max(6000, (text.length * 140) / rate));
    u.onend = () => (clearTimeout(watchdog), resolve());
    u.onerror = (e) => (clearTimeout(watchdog), e.error === "interrupted" || e.error === "canceled" ? resolve() : reject(new Error(e.error)));
    signal?.addEventListener("abort", () => (speechSynthesis.cancel(), resolve()), { once: true });
    speechSynthesis.speak(u);
  });
}

/** Speaks segments in order. Prefers server TTS when configured, otherwise browser voices. */
export async function speakSegments(segments: Segment[], opts: { lang: string; rate: number; server: boolean; signal?: AbortSignal; onLine?: (i: number) => void }) {
  if (browserTtsSupported()) speechSynthesis.cancel();
  for (const [i, s] of segments.entries()) {
    if (opts.signal?.aborted) return;
    opts.onLine?.(i);
    const text = decodeSegment(s);
    if (opts.server) {
      try {
        await speakServer(text, s.voice, opts.rate, opts.signal);
        continue;
      } catch {
        if (opts.signal?.aborted) return;
      }
    }
    await speakBrowser(text, opts.lang, s.voice, opts.rate, opts.signal);
    await new Promise((r) => setTimeout(r, 200));
  }
}

export function stopSpeaking() {
  if (browserTtsSupported()) speechSynthesis.cancel();
  sharedAudio?.pause();
}

/* ───────────────────────── Recording + speech-to-text ───────────────────────── */

export function recordingSupport(): { ok: boolean; reason?: "insecure" | "no_mic_api" | "no_recorder" } {
  if (typeof window === "undefined") return { ok: false, reason: "no_mic_api" };
  if (!window.isSecureContext) return { ok: false, reason: "insecure" };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: "no_mic_api" };
  if (typeof MediaRecorder === "undefined") return { ok: false, reason: "no_recorder" };
  return { ok: true };
}

/** Safari/iOS records audio/mp4; Chrome/Firefox prefer webm/opus. */
function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
}

export type MicError = "denied" | "no_device" | "busy" | "unknown" | "insecure" | "unsupported";

function micError(err: unknown): MicError {
  const n = (err as DOMException)?.name;
  if (n === "NotAllowedError" || n === "SecurityError") return "denied";
  if (n === "NotFoundError") return "no_device";
  if (n === "NotReadableError") return "busy";
  return "unknown";
}

export interface Recording {
  blob: Blob;
  url: string;
  durationMs: number;
  mime: string;
}

export function useRecorder(maxMs = 120_000) {
  const [state, setState] = useState<"idle" | "requesting" | "recording" | "stopped">("idle");
  const [error, setError] = useState<MicError | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState<Recording | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const raf = useRef(0);
  const ctx = useRef<AudioContext | null>(null);
  const resolver = useRef<((r: Recording | null) => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (timer.current) clearTimeout(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    ctx.current?.close().catch(() => {});
    ctx.current = null;
    setLevel(0);
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    const sup = recordingSupport();
    if (!sup.ok) {
      setError(sup.reason === "insecure" ? "insecure" : "unsupported");
      return false;
    }
    setError(null);
    setRecording(null);
    setState("requesting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const mime = pickMime();
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = () => {
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        const r = blob.size ? { blob, url: URL.createObjectURL(blob), durationMs: Date.now() - started.current, mime: type } : null;
        setRecording(r);
        setState(r ? "stopped" : "idle");
        cleanup();
        resolver.current?.(r);
        resolver.current = null;
      };
      mr.current = rec;
      rec.start(250);
      started.current = Date.now();
      setState("recording");
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ac = new AC();
        ctx.current = ac;
        const an = ac.createAnalyser();
        an.fftSize = 256;
        ac.createMediaStreamSource(s).connect(an);
        const data = new Uint8Array(an.frequencyBinCount);
        const loop = () => {
          an.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += ((v - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
          setElapsed(Date.now() - started.current);
          raf.current = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        /* level meter is optional */
      }
      timer.current = setTimeout(() => mr.current?.state === "recording" && mr.current.stop(), maxMs);
      return true;
    } catch (e) {
      cleanup();
      setError(micError(e));
      setState("idle");
      return false;
    }
  }, [cleanup, maxMs]);

  const stop = useCallback(
    () =>
      new Promise<Recording | null>((resolve) => {
        if (!mr.current || mr.current.state !== "recording") return resolve(recording);
        resolver.current = resolve;
        mr.current.stop();
      }),
    [recording],
  );

  const reset = useCallback(() => {
    setRecording(null);
    setState("idle");
    setElapsed(0);
  }, []);

  return { state, error, level, elapsed, recording, start, stop, reset };
}

interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function SRCtor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function browserSttSupported() {
  return !!SRCtor();
}

/** Browser speech recognition (Web Speech API) — used when no server STT is configured. */
export function useBrowserStt(lang: string) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SR | null>(null);
  const finalText = useRef("");
  const resolver = useRef<((t: string) => void) | null>(null);

  const start = useCallback(() => {
    const C = SRCtor();
    if (!C) return false;
    finalText.current = "";
    setInterim("");
    setError(null);
    const sr = new C();
    sr.lang = lang;
    sr.continuous = true;
    sr.interimResults = true;
    sr.onresult = (e) => {
      let inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText.current += `${r[0].transcript.trim()}${lang.startsWith("zh") ? "" : " "}`;
        else inter += r[0].transcript;
      }
      setInterim(`${finalText.current}${inter}`);
    };
    sr.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(e.error);
    };
    sr.onend = () => {
      setListening(false);
      resolver.current?.(finalText.current.trim());
      resolver.current = null;
    };
    try {
      sr.start();
      ref.current = sr;
      setListening(true);
      return true;
    } catch {
      return false;
    }
  }, [lang]);

  const stop = useCallback(
    () =>
      new Promise<string>((resolve) => {
        if (!ref.current) return resolve(finalText.current.trim());
        resolver.current = resolve;
        ref.current.stop();
        setTimeout(() => {
          if (resolver.current) {
            resolver.current(finalText.current.trim());
            resolver.current = null;
            setListening(false);
          }
        }, 1500);
      }),
    [],
  );

  useEffect(() => () => ref.current?.abort(), []);
  return { listening, interim, error, start, stop };
}
