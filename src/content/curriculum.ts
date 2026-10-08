import type { Lesson } from "./types";
import { week1 } from "./lessons/week1";
import { week2 } from "./lessons/week2";
import { week3 } from "./lessons/week3";
import { week4 } from "./lessons/week4";

export const lessons: Lesson[] = [...week1, ...week2, ...week3, ...week4].sort((a, b) => a.day - b.day);

export const TOTAL_DAYS = 30;

export const WEEKS = [
  { week: 1, title: "Foundation", subtitle: "Days 1–7" },
  { week: 2, title: "Natural Communication", subtitle: "Days 8–14" },
  { week: 3, title: "Real-World English", subtitle: "Days 15–21" },
  { week: 4, title: "Fluency Challenge", subtitle: "Days 22–30" },
] as const;

export function getLesson(day: number): Lesson | undefined {
  return lessons.find((l) => l.day === day);
}

/** Daily flow — 60 minutes. Order matters. */
export const LESSON_STEPS = [
  { id: "speaking", label: "Speaking", minutes: 20 },
  { id: "listening", label: "Listening", minutes: 15 },
  { id: "writing", label: "Writing", minutes: 10 },
  { id: "shadowing", label: "Shadowing", minutes: 10 },
  { id: "review", label: "Mistake review", minutes: 5 },
] as const;

export type StepId = (typeof LESSON_STEPS)[number]["id"];
export const STEP_IDS: StepId[] = LESSON_STEPS.map((s) => s.id);
