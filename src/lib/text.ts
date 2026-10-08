/** Text utilities shared by client and server. */

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ""))
    .filter(Boolean);
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6",
  seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12",
};

function norm(w: string) {
  const x = w.replace(/'/g, "");
  return NUMBER_WORDS[x] ?? x;
}

export type DiffToken =
  | { kind: "match"; ref: string }
  | { kind: "missed"; ref: string }
  | { kind: "wrong"; ref: string; said: string }
  | { kind: "extra"; said: string };

/**
 * Word-level alignment (Levenshtein) between a reference sentence and what the learner said.
 * Returns aligned tokens plus word accuracy (matched / reference words).
 */
export function compareWords(reference: string, spoken: string) {
  const a = words(reference);
  const b = words(spoken);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i]![0] = i;
  for (let j = 0; j <= m; j++) dp[0]![j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = norm(a[i - 1]!) === norm(b[j - 1]!);
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (same ? 0 : 1));
    }
  }
  const out: DiffToken[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = norm(a[i - 1]!) === norm(b[j - 1]!);
      if (dp[i]![j] === dp[i - 1]![j - 1]! + (same ? 0 : 1)) {
        out.push(same ? { kind: "match", ref: a[i - 1]! } : { kind: "wrong", ref: a[i - 1]!, said: b[j - 1]! });
        i--; j--; continue;
      }
    }
    if (i > 0 && dp[i]![j] === dp[i - 1]![j]! + 1) {
      out.push({ kind: "missed", ref: a[i - 1]! });
      i--;
    } else {
      out.push({ kind: "extra", said: b[j - 1]! });
      j--;
    }
  }
  out.reverse();
  const matched = out.filter((t) => t.kind === "match").length;
  const accuracy = n === 0 ? 0 : Math.round((matched / n) * 100);
  return { tokens: out, accuracy, referenceWords: n, spokenWords: m };
}

/** Case/punctuation-insensitive answer comparison for fill-in-the-blank. */
export function answersMatch(given: string, expected: string, accept: string[] = []) {
  const g = words(given).map(norm).join(" ");
  return [expected, ...accept].some((e) => words(e).map(norm).join(" ") === g);
}
