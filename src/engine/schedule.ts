/**
 * Weekly schedule logic. Days are computed in the learner's own timezone (default Asia/Bangkok).
 * Missed lessons are offered as optional make-ups — never penalised.
 */
import type { LanguageId, Skill } from "@/content/types";

export interface Slot {
  weekday: number; // 0 = Sunday
  languageId: LanguageId;
  skills: Skill[];
  position: number;
}

export const DEFAULT_SCHEDULE: Slot[] = [
  { weekday: 0, languageId: "en", skills: ["listening", "speaking"], position: 0 },
  { weekday: 1, languageId: "en", skills: ["reading", "writing"], position: 0 },
  { weekday: 2, languageId: "zh", skills: ["listening", "speaking"], position: 0 },
  { weekday: 3, languageId: "zh", skills: ["reading", "writing"], position: 0 },
  { weekday: 4, languageId: "en", skills: ["listening", "speaking"], position: 0 },
  { weekday: 5, languageId: "en", skills: ["reading", "writing"], position: 0 },
  { weekday: 6, languageId: "en", skills: ["vocabulary"], position: 0 },
  { weekday: 6, languageId: "zh", skills: ["vocabulary"], position: 1 },
];

export const DURATIONS = [10, 15, 20, 30, 45, 60] as const;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Local calendar date (YYYY-MM-DD) and weekday for `now` in `timeZone`. */
export function localDay(now: Date, timeZone = "Asia/Bangkok") {
  let tz = timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    tz = "Asia/Bangkok";
  }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday: WEEKDAYS.indexOf(get("weekday")), hour: Number(get("hour")) };
}

export function addDays(iso: string, delta: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(iso: string) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

export function slotsFor(schedule: Slot[], weekday: number) {
  return schedule.filter((s) => s.weekday === weekday).sort((a, b) => a.position - b.position);
}

export function slotKey(s: Pick<Slot, "languageId" | "skills">) {
  return `${s.languageId}:${[...s.skills].sort().join("+")}`;
}

export interface SessionLike {
  kind: string;
  status: string;
  scheduledDate: string | null;
  languageId: string;
  skills: string[];
}

/** Scheduled lessons from the previous `lookback` days that were not completed. */
export function missedLessons(schedule: Slot[], sessions: SessionLike[], today: string, lookback = 7) {
  const done = new Set(
    sessions
      .filter((s) => s.status === "completed" && s.scheduledDate && (s.kind === "scheduled" || s.kind === "makeup"))
      .map((s) => `${s.scheduledDate}|${slotKey({ languageId: s.languageId as LanguageId, skills: s.skills as Skill[] })}`),
  );
  const out: { date: string; slot: Slot }[] = [];
  for (let i = 1; i <= lookback; i++) {
    const date = addDays(today, -i);
    for (const slot of slotsFor(schedule, weekdayOf(date))) {
      if (!done.has(`${date}|${slotKey(slot)}`)) out.push({ date, slot });
    }
  }
  return out;
}

/** Consecutive weeks (ending this week) in which at least `minDays` days had study activity. */
export function weeklyConsistency(activeDates: string[], today: string, weeks = 8) {
  const set = new Set(activeDates);
  const result: { weekStart: string; days: number }[] = [];
  const startOfWeek = addDays(today, -weekdayOf(today));
  for (let w = weeks - 1; w >= 0; w--) {
    const ws = addDays(startOfWeek, -7 * w);
    let days = 0;
    for (let d = 0; d < 7; d++) if (set.has(addDays(ws, d))) days++;
    result.push({ weekStart: ws, days });
  }
  return result;
}
