import type { SpeakingScores, TurnFeedback, WritingFeedback, WritingScores } from "../ai/schemas";
import { sentences, wordCount, words } from "../text";
import { applyRules } from "./rules";

/**
 * Transparent, deterministic scoring used in demo mode. Every band is computed
 * from measurable text features using the same rubric bands as the AI scorer.
 * These are estimates — the UI labels them as such.
 */

const STOP = new Set(
  "the a an and or but to of in on at for with is are was were be been i you he she it we they my your his her our their me him us them this that these those do does did have has had will would can could so very not no yes just".split(" "),
);

const LINKERS = [
  "however", "because", "although", "therefore", "also", "first", "firstly", "then", "finally", "so",
  "but", "while", "for example", "for instance", "in addition", "moreover", "on the other hand",
  "as a result", "after that", "in conclusion", "overall", "besides", "since", "unless", "whereas",
];

function clampBand(n: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(n))) as 1 | 2 | 3 | 4 | 5;
}

/** Guiraud's index (types / sqrt(tokens)) — a length-robust lexical diversity measure. */
export function lexicalDiversity(text: string) {
  const w = words(text);
  if (w.length === 0) return 0;
  return new Set(w).size / Math.sqrt(w.length);
}

function grammarBand(errors: number, nWords: number) {
  if (nWords === 0) return 1;
  const per100 = (errors / nWords) * 100;
  if (per100 === 0) return nWords >= 12 ? 5 : 4;
  if (per100 <= 3) return 4;
  if (per100 <= 7) return 3;
  if (per100 <= 12) return 2;
  return 1;
}

function vocabularyBand(text: string, targetWords: string[] = []) {
  const g = lexicalDiversity(text);
  const lower = text.toLowerCase();
  const used = targetWords.filter((t) => lower.includes(t.toLowerCase())).length;
  const content = words(text).filter((w) => !STOP.has(w));
  const longWords = content.filter((w) => w.length >= 7).length;
  let band = g < 3 ? 1 : g < 4 ? 2 : g < 5.2 ? 3 : g < 6.5 ? 4 : 5;
  if (longWords >= 3) band += 0.5;
  if (used > 0) band += Math.min(1, used * 0.5);
  // Diversity is inflated in very short texts, so cap the band until there is enough evidence.
  const n = words(text).length;
  if (n < 25) band = Math.min(band, 3);
  else if (n < 60) band = Math.min(band, 4);
  return clampBand(band);
}

function fluencyBand(nWords: number, durationSec?: number) {
  let band = nWords < 6 ? 1 : nWords < 15 ? 2 : nWords < 30 ? 3 : nWords < 55 ? 4 : 5;
  if (durationSec && durationSec > 2) {
    const wpm = (nWords / durationSec) * 60;
    // Very slow, halting delivery lowers the band; natural pace (90–170 wpm) keeps it.
    if (wpm < 60) band -= 1;
  }
  return clampBand(band);
}

function relevance(answer: string, question: string) {
  const q = new Set(words(question).filter((w) => !STOP.has(w) && w.length > 3));
  if (q.size === 0) return 1;
  const a = new Set(words(answer));
  let hit = 0;
  for (const w of q) if (a.has(w) || [...a].some((x) => x.startsWith(w.slice(0, 5)))) hit++;
  return hit / q.size;
}

export function scoreSpeaking(
  text: string,
  opts: { question?: string; errors: number; targetWords?: string[]; durationSec?: number },
): SpeakingScores {
  const n = wordCount(text);
  const rel = opts.question ? relevance(text, opts.question) : 1;
  const task = n < 4 ? 1 : n < 10 ? 2 : rel > 0.2 || n >= 25 ? (n >= 35 ? 5 : 4) : 3;
  return {
    grammar: clampBand(grammarBand(opts.errors, n)),
    vocabulary: vocabularyBand(text, opts.targetWords),
    fluency: fluencyBand(n, opts.durationSec),
    taskCompletion: clampBand(task),
  };
}

export function scoreWriting(
  text: string,
  opts: { errors: number; minWords: number; maxWords: number; type?: string; targetWords?: string[] },
): WritingScores {
  const n = wordCount(text);
  const sents = sentences(text);
  const avgLen = sents.length ? n / sents.length : n;
  const lower = text.toLowerCase();
  const linkers = LINKERS.filter((l) => new RegExp(`\\b${l}\\b`).test(lower)).length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;

  let clarity = avgLen >= 8 && avgLen <= 22 ? 4 : avgLen < 5 || avgLen > 32 ? 2 : 3;
  if (opts.errors === 0 && clarity === 4 && n >= opts.minWords) clarity = 5;

  let coherence = linkers === 0 ? 2 : linkers <= 2 ? 3 : linkers <= 4 ? 4 : 5;
  if (sents.length < 3) coherence = Math.min(coherence, 2);

  let task = n < opts.minWords * 0.5 ? 1 : n < opts.minWords * 0.8 ? 2 : n < opts.minWords ? 3 : 4;
  if (task === 4 && n <= opts.maxWords * 1.2 && (paragraphs >= 2 || opts.type !== "email")) task = 5;
  if (opts.type === "email" && !/^(hi|hello|dear|good (morning|afternoon))/i.test(text.trim())) task = Math.min(task, 4);

  return {
    grammar: clampBand(grammarBand(opts.errors, n)),
    vocabulary: vocabularyBand(text, opts.targetWords),
    clarity: clampBand(clarity),
    coherence: clampBand(coherence),
    taskCompletion: clampBand(task),
  };
}

function vocabSuggestions(text: string, targetWords: string[]) {
  const lower = text.toLowerCase();
  return targetWords.filter((t) => !lower.includes(t.toLowerCase())).slice(0, 4);
}

export function heuristicTurnFeedback(
  text: string,
  ctx: { question?: string; targetWords?: string[]; durationSec?: number },
): TurnFeedback {
  const { corrected, natural, items } = applyRules(text, { spoken: true });
  const scores = scoreSpeaking(text, { question: ctx.question, errors: items.length, targetWords: ctx.targetWords, durationSec: ctx.durationSec });
  const n = wordCount(text);
  const followUpExercise = items[0]
    ? `Say two new sentences using “${items[0].corrected}” correctly.`
    : n < 15
      ? "Try answering again with two more details: when, where, or why."
      : "Rephrase your answer using one of the suggested words.";
  return {
    original: text,
    corrected,
    natural,
    items: items.slice(0, 6),
    suggestedVocabulary: vocabSuggestions(text, ctx.targetWords ?? []),
    followUpExercise,
    scores,
  };
}

export function heuristicWritingFeedback(
  text: string,
  ctx: { minWords: number; maxWords: number; type?: string; targetWords?: string[] },
): WritingFeedback {
  const { corrected, natural, items } = applyRules(text);
  const scores = scoreWriting(text, { errors: items.length, ...ctx });
  const n = wordCount(text);
  const weaknesses: string[] = [];
  if (scores.grammar <= 3) weaknesses.push("Grammar accuracy");
  if (scores.coherence <= 3) weaknesses.push("Linking ideas (however, because, as a result…)");
  if (scores.vocabulary <= 3) weaknesses.push("Vocabulary range");
  if (n < ctx.minWords) weaknesses.push(`Length: aim for ${ctx.minWords}–${ctx.maxWords} words`);
  if (scores.clarity <= 3) weaknesses.push("Sentence length and clarity");

  const parts: string[] = [];
  parts.push(n >= ctx.minWords ? `You wrote ${n} words — good length.` : `You wrote ${n} words; the target is ${ctx.minWords}–${ctx.maxWords}.`);
  parts.push(items.length === 0 ? "The demo checker found no common errors." : `The demo checker found ${items.length} common error${items.length > 1 ? "s" : ""} to fix.`);
  if (scores.coherence <= 3) parts.push("Add a few linking words to connect your ideas.");

  return {
    overall: parts.join(" "),
    corrected,
    natural,
    items,
    scores,
    weaknesses,
    suggestedVocabulary: vocabSuggestions(text, ctx.targetWords ?? []),
    followUpExercise: items[0]
      ? `Write two sentences that use “${items[0].corrected}” correctly.`
      : "Rewrite your first sentence in a more formal and a more casual way.",
    tip: scores.coherence <= 3
      ? "Use linkers like “however”, “as a result” and “for example” to guide the reader."
      : "Try more precise verbs (e.g. “arrange” instead of “make”, “recommend” instead of “say”).",
  };
}
