/**
 * Spaced repetition — SM-2 (Wozniak, 1987) with small, documented adjustments.
 *
 * quality (q): 0 = forgot · 2 = wrong but familiar · 3 = correct with effort · 4 = correct · 5 = easy
 * - q < 3  → lapse: repetitions reset, interval = 0 (due again in 10 minutes), lapses + 1
 * - q ≥ 3  → interval: 1 day, then 3 days, then previous × ease factor (rounded)
 * - ease factor: EF' = EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02)), never below 1.3
 * - "hard" (q = 3) grows the interval more slowly (× 1.2 instead of × EF) to avoid over-spacing.
 * Familiarity 0–5 is derived for display; it is not used for scheduling.
 */
export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export const NEW_ITEM: SrsState = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 };
const LAPSE_DELAY_MS = 10 * 60_000;

export function reviewItem(s: SrsState, quality: number, now = new Date()) {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { easeFactor, intervalDays, repetitions, lapses } = s;
  if (q < 3) {
    repetitions = 0;
    intervalDays = 0;
    lapses += 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.round(intervalDays * (q === 3 ? 1.2 : easeFactor) * 10) / 10;
  }
  easeFactor = Math.max(1.3, Math.round((easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))) * 100) / 100);
  const dueAt = new Date(now.getTime() + (q < 3 ? LAPSE_DELAY_MS : intervalDays * 86_400_000));
  return { easeFactor, intervalDays, repetitions, lapses, dueAt, correct: q >= 3 };
}

/** 0 (new) … 5 (well known) — for display only. */
export function familiarity(s: Pick<SrsState, "intervalDays" | "repetitions">) {
  if (s.repetitions === 0) return 0;
  if (s.intervalDays < 2) return 1;
  if (s.intervalDays < 5) return 2;
  if (s.intervalDays < 14) return 3;
  if (s.intervalDays < 45) return 4;
  return 5;
}

/**
 * Orders a review queue: overdue first (most overdue first), then items with more lapses
 * (recurring difficulty), capped at `max`.
 */
export function prioritizeDue<T extends { dueAt: Date; lapses: number }>(items: T[], now: Date, max: number): T[] {
  return items
    .filter((i) => i.dueAt.getTime() <= now.getTime())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || b.lapses - a.lapses)
    .slice(0, max);
}
