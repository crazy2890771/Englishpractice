"use client";
import { useEffect } from "react";
import { useStudyTime } from "@/lib/client/use-study-time";
import { localDate } from "@/lib/client/api";

/** Records active study time and shares the learner's local date with the server. */
export function StudyTracker({ day, active = true }: { day?: number; active?: boolean }) {
  useEffect(() => {
    const today = localDate();
    if (!document.cookie.includes(`efl_today=${today}`)) {
      document.cookie = `efl_today=${today}; path=/; max-age=86400; samesite=lax`;
    }
  }, []);
  useStudyTime({ day, active });
  return null;
}
