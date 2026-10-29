/**
 * Open-response evaluation (writing tasks and spoken answers).
 * The same result shape is produced by the AI evaluator and by the clearly-labelled demo evaluator.
 *
 * Rubrics (bands 1–5):
 *   writing  — grammar · vocabulary · structure · clarity · task completion
 *   speaking — fluency · grammar · vocabulary · coherence · task completion
 * Pronunciation is only scored when a real audio pronunciation assessment exists. A text
 * transcript cannot measure pronunciation or tones, so `pronunciation` is null here.
 */
import type { LanguageId } from "@/content/types";
import { applyRules } from "./demo/en-rules";
import { applyZhRules } from "./demo/zh-rules";
import { responseLength } from "./scoring";

export type OpenKind = "writing" | "speaking";

export const RUBRIC_KEYS: Record<OpenKind, string[]> = {
  writing: ["grammar", "vocabulary", "structure", "clarity", "task_completion"],
  speaking: ["fluency", "grammar", "vocabulary", "coherence", "task_completion"],
};

/** Band descriptors (shown in the UI and embedded in AI prompts so scores stay comparable). */
export const RUBRIC: Record<string, { th: string; en: string; bands: Record<1 | 3 | 5, { th: string; en: string }> }> = {
  grammar: { th: "ไวยากรณ์", en: "Grammar", bands: { 1: { th: "ผิดบ่อยจนเข้าใจยาก", en: "Frequent errors block meaning" }, 3: { th: "มีข้อผิดพลาดบ้าง แต่เข้าใจได้", en: "Some errors; meaning clear" }, 5: { th: "ถูกต้อง ใช้โครงสร้างหลากหลาย", en: "Accurate with varied structures" } } },
  vocabulary: { th: "คำศัพท์", en: "Vocabulary", bands: { 1: { th: "คำศัพท์จำกัดมาก", en: "Very limited" }, 3: { th: "เพียงพอสำหรับหัวข้อ", en: "Adequate for the topic" }, 5: { th: "หลากหลาย แม่นยำ เป็นธรรมชาติ", en: "Wide, precise, natural" } } },
  structure: { th: "โครงสร้าง", en: "Structure", bands: { 1: { th: "ไม่มีลำดับ", en: "No organisation" }, 3: { th: "มีลำดับพื้นฐาน", en: "Basic organisation" }, 5: { th: "เรียบเรียงดี เชื่อมความลื่นไหล", en: "Well organised, smooth linking" } } },
  clarity: { th: "ความชัดเจน", en: "Clarity", bands: { 1: { th: "อ่านเข้าใจยาก", en: "Hard to follow" }, 3: { th: "ส่วนใหญ่ชัดเจน", en: "Mostly clear" }, 5: { th: "ชัดเจนและกระชับ", en: "Clear and concise" } } },
  fluency: { th: "ความคล่อง", en: "Fluency", bands: { 1: { th: "คำเดี่ยว ๆ หยุดบ่อย", en: "Single words, frequent pauses" }, 3: { th: "ตอบเป็นประโยคต่อเนื่องได้", en: "Connected sentences" }, 5: { th: "พูดยาว ต่อเนื่อง เป็นธรรมชาติ", en: "Extended, natural flow" } } },
  coherence: { th: "ความสอดคล้อง", en: "Coherence", bands: { 1: { th: "ความคิดไม่ต่อเนื่อง", en: "Ideas not connected" }, 3: { th: "เชื่อมความคิดได้พื้นฐาน", en: "Basic linking" }, 5: { th: "เชื่อมโยงความคิดได้ดี", en: "Well-linked ideas" } } },
  task_completion: { th: "ทำตามโจทย์", en: "Task completion", bands: { 1: { th: "ไม่ตรงโจทย์", en: "Does not address the task" }, 3: { th: "ตอบโจทย์บางส่วน", en: "Partly addresses the task" }, 5: { th: "ตอบครบทุกข้อกำหนด", en: "Fully addresses every requirement" } } },
};

export interface OpenMistake {
  original: string;
  corrected: string;
  explanation: string;
  /** Weakness category id */
  tag: string;
}

export interface OpenEvaluation {
  evaluator: "ai" | "demo_rules";
  provider?: string;
  kind: OpenKind;
  criteria: Record<string, number>;
  /** 0..1 = mean band / 5 */
  score: number;
  mistakes: OpenMistake[];
  /** Learner's answer with only the errors fixed (revealed after a retry, not before). */
  correctedVersion: string;
  comment: string;
  retryPrompt: string;
  /** Always null unless a real audio pronunciation assessment is available. */
  pronunciation: null;
  limitations: string[];
  /** Did the learner meet the minimum length (mandatory performance tasks)? */
  meetsLength: boolean;
}

export function scoreFromCriteria(criteria: Record<string, number>, keys: string[]) {
  const vals = keys.map((k) => criteria[k] ?? 1);
  return Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 5)) * 100) / 100;
}

const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

const EN_LINKERS = ["because", "so", "but", "however", "although", "also", "then", "first", "finally", "for example", "as a result", "in addition", "moreover", "while", "whereas", "therefore"];
const ZH_LINKERS = ["因为", "所以", "但是", "可是", "然后", "而且", "虽然", "如果", "就", "还有", "不过", "首先", "最后", "比如"];

/** Quoted tokens inside a requirement, e.g. "use '了'" → ["了"]. */
export function requiredTokens(requirements: string[]) {
  const out: string[] = [];
  for (const r of requirements) for (const m of r.matchAll(/["“'‘「]([^"”'’」]{1,20})["”'’」]/g)) out.push(m[1]!);
  return out;
}

/**
 * DEMO evaluator — transparent heuristics + conservative rule checks. Labelled in the UI as
 * "demo feedback (rule-based, not AI)". It never claims to assess pronunciation.
 */
export function demoEvaluate(input: {
  language: LanguageId;
  kind: OpenKind;
  text: string;
  minLength: number;
  requirements: string[];
  targetWords?: string[];
  durationSec?: number;
  explanationLanguage: "th" | "en";
}): OpenEvaluation {
  const { language, kind, text } = input;
  const rules = language === "zh" ? applyZhRules(text) : applyRules(text, { spoken: kind === "speaking" });
  const len = responseLength(language, text);
  const unitsPer = language === "zh" ? 50 : 100;
  const errRate = len ? (rules.items.length / len) * unitsPer : 10;

  const grammar = clamp(len === 0 ? 1 : errRate === 0 ? (len >= input.minLength ? 5 : 4) : errRate <= 3 ? 4 : errRate <= 7 ? 3 : errRate <= 12 ? 2 : 1);

  const lower = text.toLowerCase();
  const usedTargets = (input.targetWords ?? []).filter((w) => lower.includes(w.toLowerCase())).length;
  let vocab: number;
  if (language === "zh") {
    const chars = [...text].filter((c) => /[㐀-鿿]/.test(c));
    const ratio = chars.length ? new Set(chars).size / chars.length : 0;
    vocab = chars.length < 6 ? 1 : ratio > 0.75 ? 4 : ratio > 0.6 ? 3 : 2;
  } else {
    const words = lower.match(/[a-z']+/g) ?? [];
    const guiraud = words.length ? new Set(words).size / Math.sqrt(words.length) : 0;
    vocab = words.length < 4 ? 1 : guiraud < 3.5 ? 2 : guiraud < 5 ? 3 : guiraud < 6.5 ? 4 : 5;
    if (words.length < 25) vocab = Math.min(vocab, 3);
  }
  vocab = clamp(vocab + Math.min(1, usedTargets * 0.5));

  const linkers = (language === "zh" ? ZH_LINKERS : EN_LINKERS).filter((l) => (language === "zh" ? text.includes(l) : new RegExp(`\\b${l}\\b`).test(lower))).length;
  const sentences = text.split(language === "zh" ? /[。！？!?]/ : /[.!?]+\s|\n/).filter((s) => s.trim()).length;
  const organisation = clamp(sentences <= 1 ? 2 : linkers === 0 ? 2.5 : linkers <= 2 ? 3.5 : 4.5);

  const lengthRatio = input.minLength ? len / input.minLength : 1;
  const tokensReq = requiredTokens(input.requirements);
  const tokensHit = tokensReq.filter((t) => text.includes(t)).length;
  let task = lengthRatio >= 1 ? 4 : lengthRatio >= 0.7 ? 3 : lengthRatio >= 0.4 ? 2 : 1;
  if (tokensReq.length) task += tokensHit === tokensReq.length ? 1 : tokensHit === 0 ? -1 : 0;
  task = clamp(task);

  let criteria: Record<string, number>;
  if (kind === "writing") {
    criteria = { grammar, vocabulary: vocab, structure: organisation, clarity: clamp((grammar + organisation) / 2), task_completion: task };
  } else {
    let fluency = len < (language === "zh" ? 6 : 5) ? 1 : lengthRatio >= 1.3 ? 4 : lengthRatio >= 0.8 ? 3 : 2;
    if (input.durationSec && input.durationSec > 3) {
      const rate = (len / input.durationSec) * 60; // words or characters per minute
      if (rate < (language === "zh" ? 60 : 50)) fluency -= 1;
    }
    criteria = { fluency: clamp(fluency), grammar, vocabulary: vocab, coherence: organisation, task_completion: task };
  }
  const keys = RUBRIC_KEYS[kind];
  const th = input.explanationLanguage === "th";
  const first = rules.items[0];
  return {
    evaluator: "demo_rules",
    kind,
    criteria,
    score: scoreFromCriteria(criteria, keys),
    mistakes: rules.items,
    correctedVersion: rules.corrected,
    comment: th
      ? `ฟีดแบ็กโหมดเดโม (ตรวจด้วยกฎ ไม่ใช่ AI): ${len} ${language === "zh" ? "ตัวอักษร" : "คำ"} · พบข้อผิดพลาดที่พบบ่อย ${rules.items.length} จุด${lengthRatio < 1 ? ` · ควรยาวอย่างน้อย ${input.minLength}` : ""}`
      : `Demo feedback (rule-based, not AI): ${len} ${language === "zh" ? "characters" : "words"} · ${rules.items.length} common error(s) found${lengthRatio < 1 ? ` · aim for at least ${input.minLength}` : ""}`,
    retryPrompt: first
      ? th
        ? `ลองพูด/เขียนประโยคของคุณใหม่ โดยแก้ “${first.original}” ให้ถูกต้อง`
        : `Try again and fix “${first.original}”.`
      : th
        ? "ลองตอบอีกครั้งโดยเพิ่มรายละเอียดอีก 1–2 อย่าง"
        : "Try again and add one or two more details.",
    pronunciation: null,
    limitations: ["demo_evaluator", "rules_cover_common_errors_only", ...(kind === "speaking" ? ["no_pronunciation_assessment"] : [])],
    meetsLength: len >= input.minLength,
  };
}
