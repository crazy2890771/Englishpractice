/**
 * Adaptive placement — one independent estimate per skill.
 *
 * Objective skills (listening, reading, vocabulary): a staircase over framework levels.
 *  - Start at a moderate level (language module `placementStart`).
 *  - At each level ask 2 items; 2/2 correct → level PASSED (move up), 0/2 → FAILED (move down),
 *    1/2 → ask a 3rd item and decide by majority (≥ 2/3).
 *  - Stop when a passed level sits directly below a failed one (bracketed), at the top/bottom
 *    of the scale, or after MAX_ITEMS. Items are never repeated within an assessment.
 *  - An item counts as correct when its score ≥ 0.75 (listen-and-type is partially scored).
 *
 * Open skills (speaking, writing): two rubric-scored tasks. The first is at the start level;
 * a strong answer (band ≥ 4) moves the second task up a level, a weak one (≤ 2.5) moves it down.
 *
 * Confidence reflects how much evidence we have; results are unofficial estimates.
 */
import type { Skill } from "@/content/types";

export const MAX_ITEMS = 12;
const CORRECT = 0.75;

export interface PlacementAnswer {
  itemId: string;
  level: string;
  score: number; // 0..1 (objective) or band/5 (open tasks)
  tags: string[];
}

export interface PlacementState {
  levelIdx: number;
  answers: PlacementAnswer[];
  decided: Record<string, "pass" | "fail">;
  done?: boolean;
}

export interface PlacementEstimate {
  level: string;
  /** True when even the first level was not passed (true beginner). */
  belowFirstLevel: boolean;
  /** True when the top tested level was passed (real level may be higher). */
  atCeiling: boolean;
  confidence: "low" | "medium" | "high";
  itemsAnswered: number;
  strengths: string[];
  weaknesses: string[];
  limitations: string[];
}

export function initialState(levels: string[], startLevel: string): PlacementState {
  const idx = Math.max(0, levels.indexOf(startLevel));
  return { levelIdx: idx, answers: [], decided: {} };
}

interface Item {
  id: string;
  level: string;
}

/** Picks the next unseen item at the current level, preferring a different type/objective than the last one. */
export function nextItem<T extends Item & { type?: string }>(items: T[], levels: string[], state: PlacementState): T | null {
  if (state.done) return null;
  const level = levels[state.levelIdx]!;
  const seen = new Set(state.answers.map((a) => a.itemId));
  const pool = items.filter((i) => i.level === level && !seen.has(i.id));
  if (!pool.length) return null;
  const lastType = state.answers.length ? items.find((i) => i.id === state.answers[state.answers.length - 1]!.itemId)?.type : undefined;
  return pool.find((i) => i.type !== lastType) ?? pool[0]!;
}

function levelOutcome(answers: PlacementAnswer[], remainingAtLevel: number): "pass" | "fail" | "more" {
  const k = answers.length;
  const right = answers.filter((a) => a.score >= CORRECT).length;
  if (k >= 3) return right >= 2 ? "pass" : "fail";
  if (k === 2) {
    if (right === 2) return "pass";
    if (right === 0) return "fail";
    return remainingAtLevel > 0 ? "more" : "pass"; // 1/2 with nothing left → benefit of the doubt
  }
  if (k === 1 && remainingAtLevel === 0) return right ? "pass" : "fail";
  return "more";
}

/** Decides the current level from the answers so far and moves the staircase. */
function advance(state: PlacementState, levels: string[], remainingAtLevel: number): PlacementState {
  const s: PlacementState = { ...state, decided: { ...state.decided } };
  const level = levels[s.levelIdx]!;
  const outcome = levelOutcome(s.answers.filter((a) => a.level === level), remainingAtLevel);
  if (outcome === "more") {
    if (s.answers.length >= MAX_ITEMS || remainingAtLevel === 0) s.done = true;
    return s;
  }
  s.decided[level] = outcome;
  const up = levels[s.levelIdx + 1];
  const down = levels[s.levelIdx - 1];
  if (outcome === "pass") {
    if (!up || s.decided[up] === "fail") s.done = true;
    else s.levelIdx += 1;
  } else {
    if (!down || s.decided[down] === "pass") s.done = true;
    else s.levelIdx -= 1;
  }
  if (s.answers.length >= MAX_ITEMS) s.done = true;
  return s;
}

/**
 * Records an answer and advances the staircase. `remainingAtLevel` = unseen items left at the
 * answered level (after this answer).
 */
export function recordObjectiveAnswer(state: PlacementState, levels: string[], answer: PlacementAnswer, remainingAtLevel: number): PlacementState {
  return advance({ ...state, answers: [...state.answers, answer] }, levels, remainingAtLevel);
}

/** Called when no unseen item exists at the current level: decide with what we have (or stop). */
export function forceDecide(state: PlacementState, levels: string[]): PlacementState {
  return advance(state, levels, 0);
}

function summarizeTags(answers: PlacementAnswer[]) {
  const right = new Map<string, number>();
  const wrong = new Map<string, number>();
  for (const a of answers) for (const t of a.tags) (a.score >= CORRECT ? right : wrong).set(t, ((a.score >= CORRECT ? right : wrong).get(t) ?? 0) + 1);
  const weaknesses = [...wrong.entries()].filter(([t, n]) => n > (right.get(t) ?? 0)).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 4);
  const strengths = [...right.entries()].filter(([t, n]) => n >= 2 && !wrong.has(t)).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 4);
  return { strengths, weaknesses };
}

export function estimateObjective(state: PlacementState, levels: string[]): PlacementEstimate {
  const passed = levels.filter((l) => state.decided[l] === "pass");
  const highestPassedIdx = passed.length ? Math.max(...passed.map((l) => levels.indexOf(l))) : -1;
  const belowFirstLevel = highestPassedIdx < 0;
  const atCeiling = highestPassedIdx === levels.length - 1;
  const bracketed = !belowFirstLevel && !atCeiling && state.decided[levels[highestPassedIdx + 1]!] === "fail";
  const decisive = (l: string) => {
    const at = state.answers.filter((a) => a.level === l);
    return at.length === 2; // 2/2 or 0/2 decisions are the clearest
  };
  let confidence: PlacementEstimate["confidence"] = "low";
  if (bracketed) confidence = decisive(levels[highestPassedIdx]!) && decisive(levels[highestPassedIdx + 1]!) ? "high" : "medium";
  else if ((belowFirstLevel || atCeiling) && state.answers.length >= 2) confidence = "medium";
  const limitations: string[] = ["unofficial"];
  if (state.answers.length >= MAX_ITEMS && !bracketed) limitations.push("item_limit");
  if (atCeiling) limitations.push("ceiling");
  if (belowFirstLevel) limitations.push("floor");
  if (state.answers.length < 4) limitations.push("few_items");
  return {
    level: levels[Math.max(0, highestPassedIdx)]!,
    belowFirstLevel,
    atCeiling,
    confidence,
    itemsAnswered: state.answers.length,
    ...summarizeTags(state.answers),
    limitations,
  };
}

/* ───────────────────────── Open tasks (speaking / writing) ───────────────────────── */

export const OPEN_TASKS = 2;

/** Level index for the next open task given previous bands (1–5). */
export function nextOpenLevelIdx(startIdx: number, levelsCount: number, bands: number[]) {
  if (!bands.length) return startIdx;
  const last = bands[bands.length - 1]!;
  if (last >= 4) return Math.min(levelsCount - 1, startIdx + 1);
  if (last <= 2.5) return Math.max(0, startIdx - 1);
  return startIdx;
}

export function estimateOpen(
  levels: string[],
  tasks: { levelIdx: number; band: number; tags: string[] }[],
  evaluator: "ai" | "demo_rules",
): PlacementEstimate {
  // Each task gives evidence: band ≥ 3 → can perform at that level; band < 2.5 → below that level.
  let best = -1;
  let below = Infinity;
  for (const t of tasks) {
    if (t.band >= 3) best = Math.max(best, t.levelIdx);
    else if (t.band < 2.5) below = Math.min(below, t.levelIdx);
    else best = Math.max(best, t.levelIdx - 1);
  }
  let idx = best;
  if (idx >= below) idx = below - 1;
  const belowFirstLevel = idx < 0;
  const limitations = ["unofficial", "open_task_estimate"];
  if (evaluator === "demo_rules") limitations.push("demo_evaluator");
  limitations.push("no_pronunciation_assessment");
  const answers: PlacementAnswer[] = tasks.map((t, i) => ({ itemId: String(i), level: levels[t.levelIdx]!, score: t.band / 5, tags: t.tags }));
  return {
    level: levels[Math.max(0, idx)]!,
    belowFirstLevel,
    atCeiling: idx === levels.length - 1,
    confidence: evaluator === "demo_rules" ? "low" : tasks.length >= 2 ? "medium" : "low",
    itemsAnswered: tasks.length,
    ...summarizeTags(answers),
    limitations,
  };
}

export const OBJECTIVE_PLACEMENT_SKILLS: Skill[] = ["listening", "reading", "vocabulary"];
export const OPEN_PLACEMENT_SKILLS: Skill[] = ["speaking", "writing"];
