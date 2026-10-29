import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import type { LanguageId, Skill } from "@/content/types";
import { SKILLS } from "@/content/types";
import { getUnit, unitsFor } from "@/content";
import { lang } from "@/languages";
import { contentLevels, getSkillProgress } from "./curriculum";
import { levelExamEligibility } from "./sessions";

/** Curriculum overview for the Learn screen. */
export async function learnOverview(tx: Tx, userId: string, language: LanguageId) {
  const progress = await getSkillProgress(tx, userId, language);
  const levels = contentLevels(language);
  const ordered = levels.flatMap((l) => unitsFor(language, l));
  const unitIds = ordered.map((u) => u.id);
  const ups = unitIds.length ? await tx.select().from(schema.unitProgress).where(and(eq(schema.unitProgress.userId, userId), inArray(schema.unitProgress.unitId, unitIds))) : [];

  const currentIdx: Partial<Record<Skill, number>> = {};
  for (const p of progress) {
    const idx = p.currentUnitId ? ordered.findIndex((u) => u.id === p.currentUnitId) : ordered.length;
    currentIdx[p.skill as Skill] = idx;
  }

  const units = ordered.map((u, idx) => {
    const perSkill = SKILLS.map((s) => {
      const up = ups.find((x) => x.unitId === u.id && x.skill === s);
      const cur = currentIdx[s];
      const status = up?.status === "completed" ? "completed" : cur === undefined ? "locked" : idx < cur ? "completed" : idx === cur ? (up?.status ?? "active") : "locked";
      return { skill: s, status, practiceAttempts: up?.practiceAttempts ?? 0, practiceAccuracy: up?.practiceCorrect ?? 0, best: up?.bestAssessment ?? null };
    });
    return { id: u.id, level: u.level, order: u.order, title: u.title, titleTh: u.titleTh, topics: u.topics, perSkill, unlocked: perSkill.some((p) => p.status !== "locked") };
  });

  const exams = [];
  for (const p of progress) {
    const e = await levelExamEligibility(tx, userId, language, p.skill as Skill);
    exams.push({ skill: p.skill, ...e, level: e.level ?? p.levelCode });
  }
  const failed = await tx
    .select()
    .from(schema.assessmentResults)
    .where(and(eq(schema.assessmentResults.userId, userId), eq(schema.assessmentResults.languageId, language), eq(schema.assessmentResults.kind, "level_exam"), eq(schema.assessmentResults.passed, false), eq(schema.assessmentResults.remediationDone, false)))
    .orderBy(desc(schema.assessmentResults.createdAt));

  return {
    framework: lang(language).framework,
    tracks: SKILLS.map((s) => {
      const p = progress.find((x) => x.skill === s);
      const u = p?.currentUnitId ? getUnit(p.currentUnitId) : null;
      return { skill: s, level: p?.levelCode ?? null, placementLevel: p?.placementLevel ?? null, unit: u ? { id: u.id, title: u.title, titleTh: u.titleTh, level: u.level } : null };
    }),
    hasPlacement: progress.length > 0,
    levels,
    units,
    readyUnitTests: units.flatMap((u) => u.perSkill.filter((p) => p.status === "ready").map((p) => ({ unitId: u.id, title: u.title, titleTh: u.titleTh, level: u.level, skill: p.skill }))),
    exams,
    remediation: failed.map((f) => ({ id: f.id, skill: f.skill, level: f.levelCode, score: f.score })),
  };
}
