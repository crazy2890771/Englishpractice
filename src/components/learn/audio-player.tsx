"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { speakSegments, stopSpeaking, unlockAudio, hasVoiceFor, type Segment } from "@/lib/client/speech";
import { useL, usePrefs } from "@/components/app/ui-context";

const SPEEDS = [0.75, 0.9, 1, 1.15];

/** Plays listening audio (TTS). The text itself is never displayed here. */
export function AudioPlayer({ segments, lang, label, compact = false, onPlayed }: { segments: Segment[]; lang: string; label?: string; compact?: boolean; onPlayed?: (plays: number) => void }) {
  const L = useL();
  const { playbackSpeed, ttsServer } = usePrefs();
  const [speed, setSpeed] = useState(playbackSpeed);
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState(-1);
  const [plays, setPlays] = useState(0);
  const [noVoice, setNoVoice] = useState(false);
  const [error, setError] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!ttsServer) hasVoiceFor(lang).then((ok) => setNoVoice(!ok));
    return () => {
      ctrl.current?.abort();
      stopSpeaking();
    };
  }, [lang, ttsServer]);

  async function play() {
    unlockAudio();
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPlaying(true);
    setError(false);
    try {
      await speakSegments(segments, { lang, rate: speed, server: ttsServer, signal: c.signal, onLine: setLine });
      if (!c.signal.aborted) {
        setPlays((p) => {
          onPlayed?.(p + 1);
          return p + 1;
        });
      }
    } catch {
      setError(true);
    } finally {
      if (ctrl.current === c) {
        setPlaying(false);
        setLine(-1);
      }
    }
  }

  function pause() {
    ctrl.current?.abort();
    stopSpeaking();
    setPlaying(false);
  }

  const pct = line < 0 ? 0 : ((line + 1) / segments.length) * 100;
  return (
    <div className={cn("rounded-2xl border bg-secondary/50 p-3", compact && "p-2")}>
      <div className="flex items-center gap-3">
        <Button type="button" size="icon" className="rounded-full" onClick={playing ? pause : play} aria-label={playing ? L("หยุด", "Pause") : L("เล่นเสียง", "Play audio")}>
          {playing ? <Pause /> : <Play className="translate-x-px" />}
        </Button>
        <div className="min-w-0 flex-1">
          <Progress value={pct} className="h-1.5" aria-label={L("ความคืบหน้าเสียง", "Audio progress")} />
          <p className="mt-1.5 truncate text-xs text-muted-foreground" aria-live="polite">
            {label ?? L("ไฟล์เสียง", "Audio")} · {segments.length > 1 ? (line >= 0 ? `${line + 1}/${segments.length}` : L(`${segments.length} ประโยค`, `${segments.length} lines`)) : ""} {plays > 0 && `· ${L("ฟังแล้ว", "played")} ${plays}×`}
          </p>
        </div>
        <Button type="button" size="icon" variant="ghost" onClick={play} aria-label={L("เล่นซ้ำ", "Replay")}>
          <RotateCcw />
        </Button>
        <label className="sr-only" htmlFor="speed">
          {L("ความเร็ว", "Speed")}
        </label>
        <select id="speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="h-9 rounded-lg border bg-background px-2 text-sm">
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </div>
      {(noVoice || error) && (
        <p className="mt-2 text-xs text-amber-800">
          {L(
            `อุปกรณ์นี้อาจไม่มีเสียงอ่าน${lang.startsWith("zh") ? "ภาษาจีน" : "ภาษาอังกฤษ"} ลองติดตั้งเสียงในการตั้งค่าเครื่อง หรือเปิดใช้เสียงจากเซิร์ฟเวอร์`,
            `This device may not have a ${lang.startsWith("zh") ? "Chinese" : "English"} voice. Install one in system settings or enable server voices.`,
          )}
        </p>
      )}
    </div>
  );
}
