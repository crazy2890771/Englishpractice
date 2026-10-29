import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import type { LanguageId, Skill, Unit } from "@/content/types";
import { SKILLS } from "@/content/types";
import { getUnit, levelsWithContent, unitsFor } from "@/content";
import { lang } from "@/languages";
import { UNIT_PRACTICE_MIN_ACCURACY, UNIT_PRACTICE_MIN_ITEMS, unitReadyForAssessment } from "@/engine/progression";

export type SkillProgressRow = typeof schema.skillProgress.$inferSelect;

/** Levels that have teaching content, in framework order. */
export function contentLevels(language: LanguageId) {
  const have = new Set(levelsWithContent(language));
  return lang(language).levels.map((l) => l.code).filter((c) => have.has(c));
}

/** Clamp a placement estimate to the levels the curriculum currently covers. */
export function startingLevel(language: LanguageId, estimate: string | null) {
  const content = contentLevels(language);
  const all = lang(language).levels.map((l) => l.code);
  if (!estimate) return content[0]!;
  const idx = all.indexOf(estimate);
  let best = content[0]!;
  for (const c of content) if (all.indexOf(c) <= idx) best = c;
  return best;
}

export async function getSkillProgress(tx: Tx, userId: string, language: LanguageId) {
  return tx.select().from(schema.skillProgress).where(and(eq(schema.skillProgress.userId, userId), eq(schema.skillProgress.languageId, language)));
}

/** Creates/updates the per-skill tracks after placement (or "start from the beginning"). */
export async function initSkillTracks(tx: Tx, userId: string, language: LanguageId, estimates: Partial<Record<Skill, string | null>>) {
  for (const skill of SKILLS) {
    const est = estimates[skill] ?? null;
    const level = startingLevel(language, est);
    const first = unitsFor(language, level)[0]!;
    await tx
      .insert(schema.skillProgress)
      .values({ userId, languageId: language, skill, levelCode: level, placementLevel: est, currentUnitId: first.id })
      .onConflictDoUpdate({
        target: [schema.skillProgress.userId, schema.skillProgress.languageId, schema.skillProgress.skill],
        set: { levelCode: level, placementLevel: est, currentUnitId: first.id, updatedAt: new Date() },
      });
    await tx.insert(schema.unitProgress).values({ userId, unitId: first.id, skill }).onConflictDoNothing();
  }
}

export function currentUnits(progress: SkillProgressRow[]) {
  const out: Partial<Record<Skill, Unit>> = {};
  for (const p of progress) {
    const u = p.currentUnitId ? getUnit(p.currentUnitId) : null;
    if (u) out[p.skill as Skill] = u;
  }
  return out;
}

/** Units before the current one (same level first, then the previous level), most recent first. */
export function previousUnits(language: LanguageId, unit: Unit | undefined, max = 3): Unit[] {
  if (!unit) return [];
  const levels = contentLevels(language);
  const ordered = levels.flatMap((l) => unitsFor(language, l));
  const idx = ordered.findIndex((u) => u.id === unit.id);
  return ordered.slice(Math.max(0, idx - max), idx).reverse();
}

/** Recomputes a unit/skill practice record from attempts and returns whether the unit test is unlocked. */
export async function refreshUnitPractice(tx: Tx, userId: string, unitId: string, skill: Skill) {
  const unit = getUnit(unitId);
  if (!unit) return null;
  const ids = unit.exercises.filter((e) => e.skill === skill).map((e) => e.id);
  if (!ids.length) return null;
  const attempts = await tx
    .select({ exerciseId: schema.exerciseAttempts.exerciseId, score: schema.exerciseAttempts.score })
    .from(schema.exerciseAttempts)
    .where(and(eq(schema.exerciseAttempts.userId, userId), inArray(schema.exerciseAttempts.exerciseId, ids)));
  const best = new Map<string, number>();
  for (const a of attempts) best.set(a.exerciseId, Math.max(best.get(a.exerciseId) ?? 0, a.score));
  const r = unitReadyForAssessment({ bestScores: [...best.values()] });
  const [existing] = await tx.select().from(schema.unitProgress).where(and(eq(schema.unitProgress.userId, userId), eq(schema.unitProgress.unitId, unitId), eq(schema.unitProgress.skill, skill)));
  const status = existing?.status === "completed" ? "completed" : r.ready ? "ready" : "active";
  await tx
    .insert(schema.unitProgress)
    .values({ userId, unitId, skill, status, practiceAttempts: r.attempted, practiceCorrect: r.accuracy })
    .onConflictDoUpdate({
      target: [schema.unitProgress.userId, schema.unitProgress.unitId, schema.unitProgress.skill],
      set: { status, practiceAttempts: r.attempted, practiceCorrect: r.accuracy, updatedAt: new Date() },
    });
  return { ...r, status, required: { items: UNIT_PRACTICE_MIN_ITEMS, accuracy: UNIT_PRACTICE_MIN_ACCURACY } };
}

/** After a passed unit assessment: mark completed and move the skill track to the next unit in the level. */
export async function completeUnit(tx: Tx, userId: string, unitId: string, skill: Skill, score: number) {
  const unit = getUnit(unitId)!;
  await tx
    .insert(schema.unitProgress)
    .values({ userId, unitId, skill, status: "completed", bestAssessment: score, completedAt: new Date() })
    .onConflictDoUpdate({
      target: [schema.unitProgress.userId, schema.unitProgress.unitId, schema.unitProgress.skill],
      set: { status: "completed", bestAssessment: score, completedAt: new Date(), updatedAt: new Date() },
    });
  const units = unitsFor(unit.language, unit.level);
  const next = units.find((u) => u.order > unit.order);
  if (next) {
    await tx
      .update(schema.skillProgress)
      .set({ currentUnitId: next.id, updatedAt: new Date() })
      .where(and(eq(schema.skillProgress.userId, userId), eq(schema.skillProgress.languageId, unit.language), eq(schema.skillProgress.skill, skill)));
    await tx.insert(schema.unitProgress).values({ userId, unitId: next.id, skill }).onConflictDoNothing();
  }
  return { next: next?.id ?? null, levelUnitsDone: !next };
}

/** Moves a skill to the next level after a passed level exam. */
export async function advanceLevel(tx: Tx, userId: string, language: LanguageId, skill: Skill, fromLevel: string) {
  const all = lang(language).levels.map((l) => l.code);
  const nextLevel = all[all.indexOf(fromLevel) + 1] ?? fromLevel;
  const firstUnit = unitsFor(language, nextLevel)[0] ?? null;
  await tx
    .update(schema.skillProgress)
    .set({ levelCode: nextLevel, currentUnitId: firstUnit?.id ?? null, updatedAt: new Date() })
    .where(and(eq(schema.skillProgress.userId, userId), eq(schema.skillProgress.languageId, language), eq(schema.skillProgress.skill, skill)));
  if (firstUnit) await tx.insert(schema.unitProgress).values({ userId, unitId: firstUnit.id, skill }).onConflictDoNothing();
  return { nextLevel, hasContent: !!firstUnit };
}
