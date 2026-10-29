/**
 * Runtime validation for exercises (used for AI-generated exercises and in tests).
 * Shape is checked with zod; answer validity is checked with explicit rules.
 */
import { z } from "zod";
import type { Exercise, LanguageId } from "./types";
import { TAG_IDS } from "./tags";

const base = {
  id: z.string().min(3).max(120),
  skill: z.enum(["listening", "speaking", "reading", "writing", "vocabulary"]),
  objective: z.string().min(1).max(120),
  tags: z.array(z.string()).min(1).max(4),
  source: z.string().optional(),
  prompt: z.string().min(1).max(600),
  promptPinyin: z.string().max(800).optional(),
  promptTh: z.string().max(600).optional(),
  explanationTh: z.string().min(1).max(600),
  explanationEn: z.string().max(600).optional(),
};

export const exerciseSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("mcq"), subtype: z.string().optional(), options: z.array(z.string().min(1).max(200)).min(3).max(5), answer: z.number().int() }),
  z.object({ ...base, type: z.literal("true_false"), answer: z.boolean() }),
  z.object({ ...base, type: z.literal("fill_blank"), answers: z.array(z.string().min(1).max(120)).min(1).max(8) }),
  z.object({ ...base, type: z.literal("word_recall"), answers: z.array(z.string().min(1).max(120)).min(1).max(8) }),
  z.object({ ...base, type: z.literal("sentence_correction"), answers: z.array(z.string().min(1).max(300)).min(1).max(8) }),
  z.object({ ...base, type: z.literal("sentence_order"), tokens: z.array(z.string().min(1).max(60)).min(3).max(12) }),
  z.object({ ...base, type: z.literal("match_pairs"), pairs: z.array(z.tuple([z.string().min(1), z.string().min(1)])).min(3).max(6) }),
  z.object({ ...base, type: z.literal("listen_type"), audio: z.string().min(1).max(200), audioPinyin: z.string().optional() }),
  z.object({ ...base, type: z.literal("repeat_sentence"), text: z.string().min(1).max(200), pinyin: z.string().optional() }),
  z.object({ ...base, type: z.literal("open_writing"), minLength: z.number().int().positive(), maxLength: z.number().int().positive(), requirements: z.array(z.string()).min(1), modelAnswer: z.string().min(1) }),
  z.object({ ...base, type: z.literal("speaking_response"), minLength: z.number().int().positive(), requirements: z.array(z.string()).min(1), modelAnswer: z.string().min(1) }),
]);

const HAN = /[㐀-鿿]/;

/** Returns a list of problems (empty = valid). */
export function exerciseProblems(e: Exercise, language: LanguageId): string[] {
  const p: string[] = [];
  const parsed = exerciseSchema.safeParse(e);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  if (e.tags.some((t) => !TAG_IDS.has(t) || !t.startsWith(`${language}.`))) p.push("unknown or wrong-language tag");
  if (language === "zh" && HAN.test(e.prompt) && !e.promptPinyin && e.type !== "listen_type") p.push("Chinese prompt needs promptPinyin");
  switch (e.type) {
    case "mcq":
      if (e.answer < 0 || e.answer >= e.options.length) p.push("answer index out of range");
      if (new Set(e.options).size !== e.options.length) p.push("duplicate options");
      break;
    case "fill_blank":
      if (!e.prompt.includes("___")) p.push('prompt must contain "___"');
      break;
    case "match_pairs":
      if (new Set(e.pairs.map((x) => x[0])).size !== e.pairs.length || new Set(e.pairs.map((x) => x[1])).size !== e.pairs.length) p.push("pair sides must be unique");
      break;
    case "open_writing":
      if (e.maxLength < e.minLength) p.push("maxLength < minLength");
      break;
  }
  return p;
}
