/**
 * SM-2–style spaced repetition.
 * quality: 0 = forgot, 3 = hard, 4 = good, 5 = easy.
 * An item is "mastered" only after MASTERY_STREAK consecutive successful reviews
 * spread over time (interval must have reached at least MASTERY_MIN_INTERVAL days).
 */
export const MASTERY_STREAK = 3;
export const MASTERY_MIN_INTERVAL = 3;

export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  successStreak: number;
  mastered: boolean;
}

export function review(state: SrsState, quality: number, now = new Date()): SrsState & { dueAt: Date } {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { easeFactor, intervalDays, repetitions, successStreak } = state;

  if (q < 3) {
    repetitions = 0;
    successStreak = 0;
    intervalDays = 0; // see again in this session / soon
  } else {
    repetitions += 1;
    successStreak += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.round(intervalDays * easeFactor);
  }
  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  // Failed items come back in 10 minutes; others after intervalDays.
  const dueAt = new Date(now.getTime() + (q < 3 ? 10 * 60_000 : intervalDays * 86400_000));
  // Mastery requires repeated successes; the interval condition is met by the 3rd success (1 → 3 → ~7 days).
  const mastered = successStreak >= MASTERY_STREAK && intervalDays >= MASTERY_MIN_INTERVAL;
  return { easeFactor: Math.round(easeFactor * 100) / 100, intervalDays, repetitions, successStreak, mastered, dueAt };
}
