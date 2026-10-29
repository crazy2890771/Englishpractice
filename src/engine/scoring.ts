/**
 * Deterministic scoring for objective exercises.
 * Objective questions are NEVER scored by AI — results are reproducible and explainable.
 */
import type { Exercise, LanguageId } from "@/content/types";

const HAN = /[㐀-鿿]/;

/* ───────────────────────── Normalisation ───────────────────────── */

export function stripTones(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[1-5]/g, "")
    .replace(/ü/g, "v");
}

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
};

/** English: lowercase, unify quotes, drop punctuation, collapse spaces, expand common contractions. */
export function normalizeEn(s: string) {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\b(\w+)n't\b/g, "$1 not")
    .replace(/\bcan not\b/g, "cannot")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\b(you|we|they)'re\b/g, "$1 are")
    .replace(/\b(he|she|it|that|what|there)'s\b/g, "$1 is")
    .replace(/\b(i|you|we|they)'ve\b/g, "$1 have")
    .replace(/\b(i|you|he|she|we|they)'ll\b/g, "$1 will")
    .replace(/\b(i|you|he|she|we|they)'d\b/g, "$1 would")
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => NUMBER_WORDS[w] ?? w)
    .join(" ");
}

/** Chinese: remove punctuation/whitespace, full-width → half-width. If the text is pinyin, compare toneless. */
export function normalizeZh(s: string) {
  const half = s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (HAN.test(half)) return half.replace(/[\s\p{P}\p{S}]/gu, "");
  return stripTones(half.toLowerCase()).replace(/[^a-z0-9]/g, "");
}

export function normalize(lang: LanguageId, s: string) {
  return lang === "zh" ? normalizeZh(s) : normalizeEn(s);
}

/** Tokens for alignment: words (English) or characters (Chinese). */
export function tokens(lang: LanguageId, s: string): string[] {
  if (lang === "zh") return [...normalizeZh(s)];
  const n = normalizeEn(s);
  return n ? n.split(" ") : [];
}

/* ───────────────────────── Alignment ───────────────────────── */

export type DiffToken =
  | { kind: "match"; ref: string }
  | { kind: "missed"; ref: string }
  | { kind: "wrong"; ref: string; said: string }
  | { kind: "extra"; said: string };

/** Levenshtein alignment between reference and response tokens. accuracy = matched / reference tokens. */
export function align(ref: string[], hyp: string[]) {
  const n = ref.length;
  const m = hyp.length;
  const dp: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
  const out: DiffToken[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i]![j] === dp[i - 1]![j - 1]! + (ref[i - 1] === hyp[j - 1] ? 0 : 1)) {
      out.push(ref[i - 1] === hyp[j - 1] ? { kind: "match", ref: ref[i - 1]! } : { kind: "wrong", ref: ref[i - 1]!, said: hyp[j - 1]! });
      i--;
      j--;
    } else if (i > 0 && dp[i]![j] === dp[i - 1]![j]! + 1) {
      out.push({ kind: "missed", ref: ref[--i]! });
    } else {
      out.push({ kind: "extra", said: hyp[--j]! });
    }
  }
  out.reverse();
  const matched = out.filter((t) => t.kind === "match").length;
  return { tokens: out, accuracy: n ? matched / n : 0 };
}

/* ───────────────────────── Scoring ───────────────────────── */

export type Response =
  | { choice: number }
  | { bool: boolean }
  | { text: string }
  | { order: string[] }
  | { pairs: Record<string, string> }
  | { transcript: string; durationMs?: number; inputMode?: "voice" | "text" };

export interface ObjectiveResult {
  score: number; // 0..1
  correct: boolean;
  /** Human-readable correct answer. */
  expected: string;
  diff?: DiffToken[];
}

const PASS = 0.9;

function textOf(r: Response): string {
  if ("text" in r) return r.text ?? "";
  if ("transcript" in r) return r.transcript ?? "";
  return "";
}

export function matchesAny(lang: LanguageId, given: string, answers: string[]) {
  const g = normalize(lang, given);
  return g.length > 0 && answers.some((a) => normalize(lang, a) === g);
}

/** Returns null for open tasks (open_writing / speaking_response), which need rubric evaluation. */
export function scoreObjective(lang: LanguageId, ex: Exercise, r: Response): ObjectiveResult | null {
  switch (ex.type) {
    case "mcq": {
      const ok = "choice" in r && r.choice === ex.answer;
      return { score: ok ? 1 : 0, correct: ok, expected: ex.options[ex.answer]! };
    }
    case "true_false": {
      const ok = "bool" in r && r.bool === ex.answer;
      return { score: ok ? 1 : 0, correct: ok, expected: ex.answer ? "True" : "False" };
    }
    case "fill_blank":
    case "word_recall":
    case "sentence_correction": {
      const ok = matchesAny(lang, textOf(r), ex.answers);
      return { score: ok ? 1 : 0, correct: ok, expected: ex.answers[0]! };
    }
    case "listen_type": {
      const a = align(tokens(lang, ex.audio), tokens(lang, textOf(r)));
      return { score: a.accuracy, correct: a.accuracy >= PASS, expected: ex.audio, diff: a.tokens };
    }
    case "repeat_sentence": {
      const a = align(tokens(lang, ex.text), tokens(lang, textOf(r)));
      return { score: a.accuracy, correct: a.accuracy >= 0.8, expected: ex.text, diff: a.tokens };
    }
    case "sentence_order": {
      const given = "order" in r ? r.order : [];
      const ok = given.length === ex.tokens.length && given.every((t, i) => t === ex.tokens[i]);
      // Partial credit: longest prefix in correct order.
      let prefix = 0;
      while (prefix < given.length && given[prefix] === ex.tokens[prefix]) prefix++;
      const joiner = lang === "zh" ? "" : " ";
      return { score: ok ? 1 : Math.min(0.5, prefix / ex.tokens.length), correct: ok, expected: ex.tokens.join(joiner) };
    }
    case "match_pairs": {
      const given = "pairs" in r ? r.pairs : {};
      const right = ex.pairs.filter(([l, rr]) => given[l] === rr).length;
      return { score: right / ex.pairs.length, correct: right === ex.pairs.length, expected: ex.pairs.map(([l, rr]) => `${l} → ${rr}`).join(", ") };
    }
    case "open_writing":
    case "speaking_response":
      return null;
  }
}

/** Length of a response in the unit the task uses: words (en) or Han characters (zh). */
export function responseLength(lang: LanguageId, text: string) {
  if (lang === "zh") return [...text].filter((c) => HAN.test(c)).length;
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
