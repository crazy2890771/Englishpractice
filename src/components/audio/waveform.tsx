"use client";
import clsx from "clsx";

/** Animated bars driven by live microphone level (0–1). */
export function Waveform({ level, active, bars = 24, className }: { level: number; active: boolean; bars?: number; className?: string }) {
  return (
    <div className={clsx("flex h-12 items-center justify-center gap-[3px]", className)} aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        const shape = 0.35 + 0.65 * Math.abs(Math.sin((i + 1) * 1.7));
        const h = active ? Math.max(0.12, Math.min(1, level * 1.6 * shape + 0.08)) : 0.12;
        return (
          <span
            key={i}
            className={clsx("w-[3px] rounded-full transition-[height] duration-75", active ? "bg-gradient-to-t from-blue-500 to-violet-400" : "bg-border")}
            style={{ height: `${h * 100}%` }}
          />
        );
      })}
    </div>
  );
}
