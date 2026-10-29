/**
 * Client-safe views of exercises and materials.
 * Answers, model answers and listening transcripts are NOT included before the learner answers.
 * Listening audio text is sent only as opaque speech segments (needed for in-browser TTS);
 * the UI never displays it until the learner has answered.
 */
import type { Dialogue, Exercise, LanguageId, Passage } from "@/content/types";
import { getMaterial, isDialogue } from "@/content";
import { seededRng } from "@/engine/progression";

export interface SpeechSegment {
  voice: "female" | "male";
  /** base64 of the text — decoded only for speaking it aloud */
  t: string;
}

export interface ClientExercise {
  id: string;
  type: Exercise["type"];
  skill: Exercise["skill"];
  subtype?: string;
  prompt: string;
  promptPinyin?: string;
  promptTh?: string;
  source?: string;
  options?: string[];
  tokens?: string[];
  left?: string[];
  right?: string[];
  speech?: SpeechSegment[];
  /** repeat_sentence: the sentence to repeat is shown */
  text?: string;
  pinyin?: string;
  minLength?: number;
  maxLength?: number;
  requirements?: string[];
  open: boolean;
}

export interface ClientDialogue {
  id: string;
  kind: "dialogue";
  title: string;
  speech: SpeechSegment[];
  lineCount: number;
}

export interface ClientPassage {
  id: string;
  kind: "passage";
  title: string;
  lines: Passage["lines"];
  glossary: Passage["glossary"];
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

function shuffle<T>(list: T[], seed: string): T[] {
  const rng = seededRng(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  // Never present a sentence-order task already solved.
  if (out.length > 1 && out.every((x, i) => x === list[i])) out.push(out.shift()!);
  return out;
}

export function toClientExercise(e: Exercise): ClientExercise {
  const base: ClientExercise = {
    id: e.id,
    type: e.type,
    skill: e.skill,
    prompt: e.prompt,
    promptPinyin: e.promptPinyin,
    promptTh: e.promptTh,
    source: e.source,
    open: e.type === "open_writing" || e.type === "speaking_response",
  };
  switch (e.type) {
    case "mcq":
      return { ...base, subtype: e.subtype, options: e.options };
    case "sentence_order":
      return { ...base, tokens: shuffle(e.tokens, e.id) };
    case "match_pairs":
      return { ...base, left: e.pairs.map((p) => p[0]), right: shuffle(e.pairs.map((p) => p[1]), e.id) };
    case "listen_type":
      return { ...base, speech: [{ voice: "female", t: b64(e.audio) }] };
    case "repeat_sentence":
      return { ...base, text: e.text, pinyin: e.pinyin, speech: [{ voice: "female", t: b64(e.text) }] };
    case "open_writing":
      return { ...base, minLength: e.minLength, maxLength: e.maxLength, requirements: e.requirements };
    case "speaking_response":
      return { ...base, minLength: e.minLength, requirements: e.requirements };
    default:
      return base;
  }
}

export function toClientMaterial(id: string): ClientDialogue | ClientPassage | null {
  const m = getMaterial(id);
  if (!m) return null;
  if (isDialogue(m)) {
    const voices = new Map(m.speakers.map((s) => [s.name, s.voice]));
    return { id: m.id, kind: "dialogue", title: m.title, lineCount: m.lines.length, speech: m.lines.map((l) => ({ voice: voices.get(l.speaker ?? "") ?? "female", t: b64(l.text) })) };
  }
  return { id: m.id, kind: "passage", title: m.title, lines: m.lines, glossary: m.glossary };
}

/** Transcript revealed after answering a listening item. */
export function transcriptOf(id: string | undefined): Dialogue["lines"] | null {
  const m = getMaterial(id);
  return m && isDialogue(m) ? m.lines : null;
}

/** Human-readable reference answer shown after answering. */
export function modelAnswerOf(e: Exercise): string | null {
  if (e.type === "open_writing" || e.type === "speaking_response") return e.modelAnswer;
  return null;
}

export type { LanguageId };
