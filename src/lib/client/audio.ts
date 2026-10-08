"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* ───────────────────────── Recording (MediaRecorder) ───────────────────────── */

export type RecorderState = "idle" | "requesting" | "recording" | "stopped" | "error";

export function recordingSupport(): { ok: boolean; reason?: string } {
  if (typeof window === "undefined") return { ok: false, reason: "Not in a browser." };
  if (!window.isSecureContext) return { ok: false, reason: "Microphone access needs a secure (HTTPS) connection." };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: "This browser can't access the microphone." };
  if (typeof MediaRecorder === "undefined") return { ok: false, reason: "This browser can't record audio (MediaRecorder unsupported)." };
  return { ok: true };
}

/** Safari/iOS records audio/mp4; Chrome/Firefox prefer webm/opus. */
export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
}

function permissionMessage(err: unknown) {
  const name = (err as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone permission was denied. Allow microphone access in your browser settings (on iPhone: Settings → Safari → Microphone), then try again — or type your answer instead.";
  if (name === "NotFoundError") return "No microphone was found. Connect one or type your answer instead.";
  if (name === "NotReadableError") return "Your microphone is being used by another app. Close it and try again.";
  return "Couldn't start the microphone. You can type your answer instead.";
}

export interface Recording {
  blob: Blob;
  url: string;
  durationMs: number;
  mimeType: string;
}

export function useRecorder({ maxMs = 120_000 }: { maxMs?: number } = {}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const raf = useRef<number>(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const resolveStop = useRef<((r: Recording | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    if (timer.current) clearTimeout(timer.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);
  useEffect(() => () => {
    if (recording) URL.revokeObjectURL(recording.url);
  }, [recording]);

  const start = useCallback(async () => {
    const support = recordingSupport();
    if (!support.ok) {
      setError(support.reason!);
      setState("error");
      return false;
    }
    setError(null);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      mr.onstop = () => {
        const type = mr.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        const durationMs = Date.now() - started.current;
        const rec = blob.size > 0 ? { blob, url: URL.createObjectURL(blob), durationMs, mimeType: type } : null;
        setRecording(rec);
        setState(rec ? "stopped" : "error");
        if (!rec) setError("Nothing was recorded. Please try again.");
        cleanup();
        resolveStop.current?.(rec);
        resolveStop.current = null;
      };
      mediaRef.current = mr;
      mr.start(250);
      started.current = Date.now();
      setState("recording");

      // Live input level for the waveform.
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += ((v - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
          setElapsedMs(Date.now() - started.current);
          raf.current = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        /* waveform is optional */
      }
      timer.current = setTimeout(() => mediaRef.current?.state === "recording" && mediaRef.current.stop(), maxMs);
      return true;
    } catch (err) {
      cleanup();
      setError(permissionMessage(err));
      setState("error");
      return false;
    }
  }, [cleanup, maxMs]);

  const stop = useCallback(() => {
    return new Promise<Recording | null>((resolve) => {
      const mr = mediaRef.current;
      if (!mr || mr.state !== "recording") return resolve(recording);
      resolveStop.current = resolve;
      mr.stop();
    });
  }, [recording]);

  const reset = useCallback(() => {
    setRecording(null);
    setState("idle");
    setError(null);
    setElapsedMs(0);
  }, []);

  return { state, error, recording, level, elapsedMs, start, stop, reset };
}

/* ───────────────────────── Browser speech recognition (fallback STT) ───────────────────────── */

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

function getSR(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function browserSttSupported() {
  return !!getSR();
}

export function useSpeechRecognition(lang = "en-US") {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SR | null>(null);
  const finalText = useRef("");
  const resolveEnd = useRef<((t: string) => void) | null>(null);

  const start = useCallback(() => {
    const Ctor = getSR();
    if (!Ctor) {
      setError("Speech recognition isn't available in this browser. Please type your answer.");
      return false;
    }
    finalText.current = "";
    setTranscript("");
    setInterim("");
    setError(null);
    const sr = new Ctor();
    sr.lang = lang;
    sr.continuous = true;
    sr.interimResults = true;
    sr.onresult = (e) => {
      let inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText.current += `${r[0].transcript.trim()} `;
        else inter += r[0].transcript;
      }
      setTranscript(finalText.current.trim());
      setInterim(inter);
    };
    sr.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Speech recognition permission was denied. You can type your answer instead."
          : e.error === "network"
            ? "Speech recognition needs an internet connection. You can type instead."
            : `Speech recognition error (${e.error}). You can type instead.`,
      );
    };
    sr.onend = () => {
      setListening(false);
      setInterim("");
      resolveEnd.current?.(finalText.current.trim());
      resolveEnd.current = null;
    };
    try {
      sr.start();
      ref.current = sr;
      setListening(true);
      return true;
    } catch {
      setError("Couldn't start speech recognition. Please type instead.");
      return false;
    }
  }, [lang]);

  const stop = useCallback(() => {
    return new Promise<string>((resolve) => {
      if (!ref.current || !listening) return resolve(finalText.current.trim());
      resolveEnd.current = resolve;
      ref.current.stop();
      // Safety: some browsers never fire onend.
      setTimeout(() => {
        if (resolveEnd.current) {
          resolveEnd.current(finalText.current.trim());
          resolveEnd.current = null;
          setListening(false);
        }
      }, 1500);
    });
  }, [listening]);

  useEffect(() => () => ref.current?.abort(), []);

  return { listening, transcript, interim, error, start, stop, setTranscript };
}

/* ───────────────────────── Text-to-speech ───────────────────────── */

const FEMALE = /(female|samantha|karen|moira|tessa|victoria|serena|fiona|veena|zira|hazel|susan|catherine|allison|ava|kate|martha|nicky|lekha|aria|jenny|sonia|natasha|libby|neerja)/i;
const MALE = /(male|daniel|alex|fred|rishi|david|george|lee|oliver|arthur|aaron|tom|guy|ryan|william|prabhat|james)/i;

export const ACCENT_LANG: Record<string, string> = { US: "en-US", UK: "en-GB", AU: "en-AU", IN: "en-IN" };

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

export function pickVoice(voices: SpeechSynthesisVoice[], accent: string, gender?: "female" | "male") {
  const lang = ACCENT_LANG[accent] ?? "en-US";
  const norm = (l: string) => l.replace("_", "-").toLowerCase();
  const sameLang = voices.filter((v) => norm(v.lang) === lang.toLowerCase());
  const english = voices.filter((v) => norm(v.lang).startsWith("en"));
  const pool = sameLang.length ? sameLang : english;
  const byGender = gender ? pool.filter((v) => (gender === "female" ? FEMALE : MALE).test(v.name)) : [];
  return byGender[0] ?? pool[0] ?? null;
}

export function browserTtsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export interface SpeakOptions {
  accent?: string;
  gender?: "female" | "male";
  rate?: number;
  signal?: AbortSignal;
  /** "openai" uses the server TTS endpoint (cached); "browser" uses speechSynthesis. */
  provider?: "openai" | "browser";
}

let sharedAudio: HTMLAudioElement | null = null;
/** iOS requires audio playback to be unlocked by a user gesture; call from a click handler. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!sharedAudio) sharedAudio = new Audio();
  sharedAudio.muted = true;
  sharedAudio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
  sharedAudio.play().then(() => sharedAudio && (sharedAudio.muted = false)).catch(() => {});
  if (browserTtsSupported()) {
    // Priming speechSynthesis inside a gesture is needed on iOS Safari.
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

const audioCache = new Map<string, string>();

async function speakServer(text: string, opts: SpeakOptions) {
  const voice = opts.gender ?? "neutral";
  const speed = opts.rate ?? 1;
  const key = `${voice}|${speed}|${text}`;
  let url = audioCache.get(key);
  if (!url) {
    const res = await fetch("/api/ai/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, voice, speed }),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error("tts_failed");
    url = URL.createObjectURL(await res.blob());
    audioCache.set(key, url);
  }
  if (!sharedAudio) sharedAudio = new Audio();
  const audio = sharedAudio;
  audio.muted = false;
  audio.src = url;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
      opts.signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      audio.pause();
      cleanup();
      resolve();
    };
    audio.onended = () => (cleanup(), resolve());
    audio.onerror = () => (cleanup(), reject(new Error("playback_failed")));
    opts.signal?.addEventListener("abort", onAbort);
    audio.play().catch((e) => (cleanup(), reject(e)));
  });
}

async function speakBrowser(text: string, opts: SpeakOptions) {
  if (!browserTtsSupported()) throw new Error("no_tts");
  const voices = voicesCache.length ? voicesCache : await loadVoices();
  speechSynthesis.cancel();
  await new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(voices, opts.accent ?? "US", opts.gender);
    if (v) u.voice = v;
    u.lang = v?.lang ?? ACCENT_LANG[opts.accent ?? "US"] ?? "en-US";
    u.rate = opts.rate ?? 1;
    // Chrome sometimes stalls long utterances; a watchdog prevents hanging forever.
    const watchdog = setTimeout(resolve, Math.max(8000, text.length * 120 / (opts.rate ?? 1)));
    u.onend = () => (clearTimeout(watchdog), resolve());
    u.onerror = (e) => (clearTimeout(watchdog), e.error === "interrupted" || e.error === "canceled" ? resolve() : reject(new Error(e.error)));
    opts.signal?.addEventListener("abort", () => {
      speechSynthesis.cancel();
      resolve();
    });
    speechSynthesis.speak(u);
  });
}

/** Speak text with the configured provider, falling back to browser speech. */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<"openai" | "browser"> {
  if (opts.provider === "openai") {
    try {
      await speakServer(text, opts);
      return "openai";
    } catch (err) {
      if (opts.signal?.aborted) return "openai";
      if ((err as DOMException)?.name === "NotAllowedError") throw new Error("Tap play to allow audio (your browser blocked autoplay).");
      // fall through to browser TTS
    }
  }
  try {
    await speakBrowser(text, opts);
  } catch {
    throw new Error("Audio isn't available on this device. Read the text instead.");
  }
  return "browser";
}

export function stopSpeaking() {
  if (browserTtsSupported()) speechSynthesis.cancel();
  sharedAudio?.pause();
}
