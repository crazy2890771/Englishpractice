import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import type { LanguageId, PlacementItem, Skill } from "@/content/types";
import { SKILLS } from "@/content/types";
import { PLACEMENT, placementItems, unitsFor } from "@/content";
import { lang } from "@/languages";
import {
  OPEN_TASKS,
  estimateObjective,
  estimateOpen,
  forceDecide,
  initialState,
  nextItem,
  nextOpenLevelIdx,
  recordObjectiveAnswer,
  type PlacementEstimate,
  type PlacementState,
} from "@/engine/placement";
import { scoreObjective, type Response as AnswerResponse } from "@/engine/scoring";
import { evaluateOpen } from "@/ai/teacher";
import { toClientExercise, toClientMaterial, transcriptOf } from "./dto";
import { HttpError } from "./http";
import { initSkillTracks, startingLevel } from "./curriculum";
import { assertAiAllowed, usageRecorder } from "./ai-usage";
import { explanationLang, providerFor, type Learner } from "./learner";

/** Placement levels = framework levels that have placement items, in order. */
export function placementLevels(language: LanguageId) {
  const have = new Set(PLACEMENT[language].items.map((i) => i.level));
  return lang(language).levels.map((l) => l.code).filter((c) => have.has(c));
}

interface OpenState {
  levelIdx: number;
  tasks: { itemId: string; levelIdx: number; band: number; tags: string[] }[];
  current?: string;
  done?: boolean;
}

type SkillState = (PlacementState & { current?: string }) | OpenState;

const isOpenSkill = (s: Skill) => s === "speaking" || s === "writing";

export async function getOrStartPlacement(tx: Tx, userId: string, language: LanguageId) {
  const [existing] = await tx
    .select()
    .from(schema.placementAssessments)
    .where(and(eq(schema.placementAssessments.userId, userId), eq(schema.placementAssessments.languageId, language)))
    .orderBy(desc(schema.placementAssessments.startedAt))
    .limit(1);
  if (existing && existing.status === "in_progress") return existing;
  return null;
}

export type SelfReport = "none" | "basic" | "conversational" | "confident";

/**
 * Starting level from the learner's own description, so a beginner doesn't open on a long B1
 * article. The staircase still moves up or down from here; this only picks the first question.
 */
export function startLevelFromSelf(language: LanguageId, self: SelfReport | undefined) {
  const levels = placementLevels(language);
  const fallback = lang(language).placementStart;
  if (!self) return fallback;
  const idx = { none: 0, basic: 1, conversational: 2, confident: 3 }[self];
  return levels[Math.min(idx, levels.length - 1)] ?? fallback;
}

export async function startPlacement(tx: Tx, userId: string, language: LanguageId, self?: SelfReport) {
  const open = await getOrStartPlacement(tx, userId, language);
  if (open) return open;
  const levels = placementLevels(language);
  const start = startLevelFromSelf(language, self);
  const startIdx = Math.max(0, levels.indexOf(start));
  const [a] = await tx.insert(schema.placementAssessments).values({ userId, languageId: language }).returning();
  await tx.insert(schema.placementSkillResults).values(
    SKILLS.map((skill) => ({ assessmentId: a!.id, userId, skill, state: (isOpenSkill(skill) ? { levelIdx: startIdx, tasks: [] } : initialState(levels, start)) as object })),
  );
  return a!;
}

export async function latestPlacement(tx: Tx, userId: string, language: LanguageId) {
  const [a] = await tx
    .select()
    .from(schema.placementAssessments)
    .where(and(eq(schema.placementAssessments.userId, userId), eq(schema.placementAssessments.languageId, language)))
    .orderBy(desc(schema.placementAssessments.startedAt))
    .limit(1);
  if (!a) return null;
  const skills = await tx.select().from(schema.placementSkillResults).where(eq(schema.placementSkillResults.assessmentId, a.id));
  return { assessment: a, skills };
}

async function ownAssessment(tx: Tx, userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "not_found");
  const [a] = await tx.select().from(schema.placementAssessments).where(and(eq(schema.placementAssessments.id, id), eq(schema.placementAssessments.userId, userId)));
  if (!a) throw new HttpError(404, "not_found");
  const skills = await tx.select().from(schema.placementSkillResults).where(eq(schema.placementSkillResults.assessmentId, a.id));
  return { a, skills };
}

function pickItem(language: LanguageId, skill: Skill, st: SkillState): PlacementItem | null {
  const levels = placementLevels(language);
  const items = placementItems(language, skill);
  if (isOpenSkill(skill)) {
    const o = st as OpenState;
    const used = new Set(o.tasks.map((t) => t.itemId));
    const level = levels[o.levelIdx];
    return items.find((i) => i.level === level && !used.has(i.id)) ?? items.find((i) => !used.has(i.id) && Math.abs(levels.indexOf(i.level) - o.levelIdx) <= 1) ?? null;
  }
  return nextItem(items, levels, st as PlacementState);
}

async function finalizeSkill(tx: Tx, rowId: string, estimate: PlacementEstimate | null, evaluator: string, state: unknown) {
  await tx
    .update(schema.placementSkillResults)
    .set({
      status: estimate ? "completed" : "skipped",
      state: state as object,
      estimatedLevel: estimate?.level ?? null,
      confidence: estimate?.confidence ?? null,
      detail: estimate ? { belowFirstLevel: estimate.belowFirstLevel, atCeiling: estimate.atCeiling, itemsAnswered: estimate.itemsAnswered } : null,
      strengths: estimate?.strengths ?? [],
      weaknesses: estimate?.weaknesses ?? [],
      limitations: estimate?.limitations ?? ["skipped"],
      evaluator,
      completedAt: new Date(),
    })
    .where(eq(schema.placementSkillResults.id, rowId));
}

/** Completes the assessment once every skill is completed or skipped, and builds the curriculum. */
async function maybeComplete(tx: Tx, userId: string, assessmentId: string, language: LanguageId) {
  const skills = await tx.select().from(schema.placementSkillResults).where(eq(schema.placementSkillResults.assessmentId, assessmentId));
  if (!skills.every((s) => s.status === "completed" || s.status === "skipped")) return false;
  const estimates: Partial<Record<Skill, string | null>> = {};
  // Skipped skills start at the lowest estimated skill level (or the first level).
  const fallback = skippedFallback(language, skills);
  for (const s of skills) estimates[s.skill as Skill] = s.estimatedLevel ?? fallback;
  await initSkillTracks(tx, userId, language, estimates);
  await tx.update(schema.placementAssessments).set({ status: "completed", completedAt: new Date() }).where(eq(schema.placementAssessments.id, assessmentId));
  return true;
}

/** Next placement question for a skill (or done). The current item id is stored so answers can't be forged. */
export async function nextPlacementItem(tx: Tx, userId: string, assessmentId: string, skill: Skill) {
  const { a, skills } = await ownAssessment(tx, userId, assessmentId);
  const language = a.languageId as LanguageId;
  const row = skills.find((s) => s.skill === skill);
  if (!row) throw new HttpError(404, "not_found");
  if (row.status === "completed" || row.status === "skipped") return { done: true as const };
  const levels = placementLevels(language);
  const startIdx = Math.max(0, levels.indexOf(lang(language).placementStart));
  let st = (row.state && Object.keys(row.state as object).length ? row.state : isOpenSkill(skill) ? { levelIdx: startIdx, tasks: [] } : initialState(levels, lang(language).placementStart)) as SkillState;

  let item = pickItem(language, skill, st);
  if (!item && !isOpenSkill(skill)) {
    // No unseen item at this level: decide with the evidence we have and move on.
    st = { ...forceDecide(st as PlacementState, levels), current: undefined };
    item = (st as PlacementState).done ? null : pickItem(language, skill, st);
  }
  const finished = isOpenSkill(skill) ? (st as OpenState).tasks.length >= OPEN_TASKS || !item : (st as PlacementState).done || !item;
  if (finished) {
    const est = isOpenSkill(skill)
      ? (st as OpenState).tasks.length
        ? estimateOpen(levels, (st as OpenState).tasks, row.evaluator === "ai" ? "ai" : "demo_rules")
        : null
      : estimateObjective(st as PlacementState, levels);
    await finalizeSkill(tx, row.id, est, row.evaluator ?? "deterministic", st);
    await maybeComplete(tx, userId, a.id, language);
    return { done: true as const };
  }
  await tx
    .update(schema.placementSkillResults)
    .set({ status: "in_progress", state: { ...st, current: item!.id } as object })
    .where(eq(schema.placementSkillResults.id, row.id));
  const answeredCount = isOpenSkill(skill) ? (st as OpenState).tasks.length : (st as PlacementState).answers.length;
  return {
    done: false as const,
    exercise: toClientExercise(item!),
    material: item!.source ? toClientMaterial(item!.source) : null,
    progress: { answered: answeredCount, max: isOpenSkill(skill) ? OPEN_TASKS : 12 },
  };
}

export async function answerPlacement(
  tx: Tx,
  learner: Learner,
  assessmentId: string,
  skill: Skill,
  input: { exerciseId: string; response: AnswerResponse; durationMs?: number; signal?: AbortSignal },
) {
  const { a, skills } = await ownAssessment(tx, learner.id, assessmentId);
  const language = a.languageId as LanguageId;
  const row = skills.find((s) => s.skill === skill)!;
  const st = row.state as SkillState & { current?: string };
  if (!st.current || st.current !== input.exerciseId) throw new HttpError(409, "stale_item");
  const item = placementItems(language, skill).find((i) => i.id === input.exerciseId)!;
  const levels = placementLevels(language);

  if (isOpenSkill(skill)) {
    const text = "text" in input.response ? input.response.text : "transcript" in input.response ? input.response.transcript : "";
    if (!text.trim()) throw new HttpError(400, "empty_answer");
    const prov = providerFor(learner.profile);
    if (prov) await assertAiAllowed(tx, learner.id);
    const usage = prov ? usageRecorder(tx, learner.id, "llm", prov) : null;
    const ev = await evaluateOpen({
      language,
      level: item.level,
      kind: skill === "writing" ? "writing" : "speaking",
      task: item.prompt,
      requirements: item.type === "open_writing" || item.type === "speaking_response" ? item.requirements : [],
      minLength: item.type === "open_writing" || item.type === "speaking_response" ? item.minLength : 1,
      text,
      durationSec: input.durationMs ? input.durationMs / 1000 : undefined,
      explanationLanguage: explanationLang(learner.profile),
      provider: prov,
      signal: input.signal,
      onUsage: usage?.onUsage,
    });
    await usage?.flush();
    const band = ev.score * 5;
    await tx.insert(schema.exerciseAttempts).values({ userId: learner.id, exerciseId: item.id, languageId: language, skill, response: input.response, score: ev.score, isCorrect: band >= 3, feedback: { evaluation: ev }, evaluator: ev.evaluator, aiProvider: ev.provider ?? null });
    const o = st as OpenState;
    const tasks = [...o.tasks, { itemId: item.id, levelIdx: levels.indexOf(item.level), band, tags: ev.mistakes.map((m) => m.tag) }];
    const levelIdx = nextOpenLevelIdx(o.levelIdx, levels.length, tasks.map((t) => t.band));
    await tx
      .update(schema.placementSkillResults)
      .set({ state: { levelIdx, tasks } as object, evaluator: ev.evaluator })
      .where(eq(schema.placementSkillResults.id, row.id));
    return { recorded: true };
  }

  const r = scoreObjective(language, item, input.response);
  if (!r) throw new HttpError(400, "invalid_input");
  await tx.insert(schema.exerciseAttempts).values({ userId: learner.id, exerciseId: item.id, languageId: language, skill, response: input.response, score: r.score, isCorrect: r.correct, feedback: { expected: r.expected }, evaluator: "deterministic" });
  const remaining = placementItems(language, skill).filter((i) => i.level === item.level && i.id !== item.id && !(st as PlacementState).answers.some((x) => x.itemId === i.id)).length;
  const next = recordObjectiveAnswer(st as PlacementState, levels, { itemId: item.id, level: item.level, score: r.score, tags: item.tags }, remaining);
  await tx
    .update(schema.placementSkillResults)
    .set({ state: { ...next, current: undefined } as object, evaluator: "deterministic" })
    .where(eq(schema.placementSkillResults.id, row.id));
  // Placement never reveals answers (it would bias the following items); transcripts stay hidden too.
  void transcriptOf;
  return { recorded: true };
}

export async function skipPlacementSkill(tx: Tx, userId: string, assessmentId: string, skill: Skill) {
  const { a, skills } = await ownAssessment(tx, userId, assessmentId);
  const row = skills.find((s) => s.skill === skill)!;
  if (row.status !== "completed") await finalizeSkill(tx, row.id, null, "none", row.state);
  await maybeComplete(tx, userId, a.id, a.languageId as LanguageId);
}

/** "Start from the beginning" without a placement test. */
export async function startFromBeginning(tx: Tx, userId: string, language: LanguageId) {
  await initSkillTracks(tx, userId, language, {});
}

/** Level used for skipped skills: the lowest level estimated for another skill (or null → first level). */
export function skippedFallback(language: LanguageId, skills: { estimatedLevel: string | null }[]) {
  const levels = lang(language).levels.map((l) => l.code);
  const known = skills.filter((s) => s.estimatedLevel).map((s) => s.estimatedLevel!);
  return known.length ? known.sort((a, b) => levels.indexOf(a) - levels.indexOf(b))[0]! : null;
}

export function recommendations(language: LanguageId, skills: { skill: string; estimatedLevel: string | null; weaknesses: string[] | null }[]) {
  const levels = lang(language).levels.map((l) => l.code);
  const fallback = skippedFallback(language, skills);
  const recs = skills.map((s) => {
    const level = startingLevel(language, s.estimatedLevel ?? fallback);
    return { skill: s.skill, level, unit: unitsFor(language, level)[0] ?? null, inferred: !s.estimatedLevel, fromOtherSkills: !s.estimatedLevel && !!fallback };
  });
  // Priorities: weakest skills first, then the most frequent weakness tags.
  const weakest = [...skills].filter((s) => s.estimatedLevel).sort((a, b) => levels.indexOf(a.estimatedLevel!) - levels.indexOf(b.estimatedLevel!)).slice(0, 2).map((s) => s.skill);
  const tagCounts = new Map<string, number>();
  for (const s of skills) for (const t of s.weaknesses ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 4);
  return { recs, priorities: { skills: weakest, tags } };
}
