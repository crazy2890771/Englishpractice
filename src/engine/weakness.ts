/**
 * Weakness tracker — evidence-based, never from a single mistake.
 *
 * Inputs per category: mistake timestamps (with the exercise they came from) and recent
 * attempts on exercises tagged with that category (score 0..1).
 *
 * Rules (documented, tested):
 * - watching:  at least one mistake, but not enough evidence yet.
 * - active:    ≥ 3 mistakes in the last 21 days, from ≥ 2 different exercises,
 *              AND recent mastery < 70 % (or fewer than 3 tagged attempts to judge).
 * - improving: was active, recent mastery ≥ 70 % over ≥ 3 tagged attempts, but not yet resolved.
 * - resolved:  mastery ≥ 80 % over the last ≥ 5 tagged attempts AND no mistake in the last 14 days.
 * mastery = mean score of the last 8 tagged attempts.
 */
export type WeaknessStatus = "watching" | "active" | "improving" | "resolved";

export interface WeaknessEvidence {
  mistakes: { at: Date; exerciseId: string | null }[];
  taggedAttempts: { at: Date; score: number }[];
  previousStatus?: WeaknessStatus | null;
}

const DAY = 86_400_000;

export function evaluateWeakness(e: WeaknessEvidence, now = new Date()) {
  const recent = e.mistakes.filter((m) => now.getTime() - m.at.getTime() <= 21 * DAY);
  const distinct = new Set(recent.map((m) => m.exerciseId ?? `x${m.at.getTime()}`)).size;
  const lastMistake = e.mistakes.reduce<Date | null>((a, m) => (!a || m.at > a ? m.at : a), null);
  const attempts = [...e.taggedAttempts].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 8);
  const mastery = attempts.length ? attempts.reduce((s, a) => s + a.score, 0) / attempts.length : 0;
  const quietDays = lastMistake ? (now.getTime() - lastMistake.getTime()) / DAY : Infinity;

  let status: WeaknessStatus;
  const wasActive = e.previousStatus === "active" || e.previousStatus === "improving";
  if (attempts.length >= 5 && mastery >= 0.8 && quietDays >= 14) status = "resolved";
  else if (recent.length >= 3 && distinct >= 2 && (attempts.length < 3 || mastery < 0.7)) status = "active";
  else if (wasActive && attempts.length >= 3 && mastery >= 0.7) status = "improving";
  else if (wasActive) status = e.previousStatus!; // keep until there is evidence either way
  else status = "watching";
  return {
    status,
    mastery: Math.round(mastery * 100) / 100,
    occurrences: e.mistakes.length,
    recentOccurrences: recent.length,
    lastSeenAt: lastMistake,
  };
}

/** Weaknesses that should drive lesson selection (most urgent first). */
export function focusCategories<T extends { status: WeaknessStatus; mastery: number; recentOccurrences: number; categoryId: string }>(list: T[], max = 3) {
  return list
    .filter((w) => w.status === "active" || w.status === "improving")
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1) || b.recentOccurrences - a.recentOccurrences || a.mastery - b.mastery)
    .slice(0, max)
    .map((w) => w.categoryId);
}
