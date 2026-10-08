/** Date helpers. Dates are stored as YYYY-MM-DD in the learner's local calendar. */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** Current streak: consecutive active days ending today (or yesterday, if today not yet studied). */
export function computeStreak(activeDates: Iterable<string>, today: string): { current: number; longest: number } {
  const set = new Set(activeDates);
  let start = today;
  if (!set.has(today)) start = addDays(today, -1);
  let current = 0;
  for (let d = start; set.has(d); d = addDays(d, -1)) current++;

  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest };
}

export function isValidIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
