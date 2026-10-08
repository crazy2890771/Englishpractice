"use client";
import { useEffect, useRef } from "react";
import { localDate } from "./api";

/**
 * Logs real study time: counts seconds only while the page is visible, `active` is true,
 * and the learner interacted within the last 2 minutes. Sends heartbeats every 30s.
 */
export function useStudyTime({ active = true, day }: { active?: boolean; day?: number } = {}) {
  const pending = useRef(0);
  const lastInteraction = useRef(Date.now());

  useEffect(() => {
    const mark = () => (lastInteraction.current = Date.now());
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, mark));
  }, []);

  useEffect(() => {
    if (!active) return;
    const flush = (useBeacon = false) => {
      const seconds = Math.min(60, pending.current);
      if (seconds < 1) return;
      pending.current -= seconds;
      const body = JSON.stringify({ seconds, date: localDate(), day });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/study", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/study", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {
          pending.current += seconds; // retry later
        });
      }
    };
    const tick = setInterval(() => {
      const engaged = document.visibilityState === "visible" && Date.now() - lastInteraction.current < 120_000;
      if (engaged) pending.current += 1;
    }, 1000);
    const send = setInterval(() => flush(), 30_000);
    const onHide = () => document.visibilityState === "hidden" && flush(true);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(tick);
      clearInterval(send);
      document.removeEventListener("visibilitychange", onHide);
      flush(true);
    };
  }, [active, day]);
}
