/**
 * Content registry: indexes all bundled curriculum content for fast lookup.
 * To add a language: create src/content/<lang>/… files and register them here.
 */
import type { Dialogue, Exercise, LanguageId, LevelExam, Passage, PlacementBank, PlacementItem, Skill, Unit } from "./types";
import { unitsA1 } from "./en/a1";
import { unitsA2 } from "./en/a2";
import { unitsB1 } from "./en/b1";
import { unitsB2 } from "./en/b2";
import { unitsC1 } from "./en/c1";
import { placementEn } from "./en/placement";
import { examsA1, examsA2 } from "./en/exams-a1-a2";
import { examsB1, examsB2, examsC1 } from "./en/exams-b1-c1";
import { unitsHSK1 } from "./zh/hsk1";
import { unitsHSK2 } from "./zh/hsk2";
import { unitsHSK3 } from "./zh/hsk3";
import { unitsHSK4 } from "./zh/hsk4";
import { placementZh } from "./zh/placement";
import { examsHSK1, examsHSK2 } from "./zh/exams-hsk1-2";
import { examsHSK3, examsHSK4 } from "./zh/exams-hsk3-4";

export const UNITS: Unit[] = [
  ...unitsA1, ...unitsA2, ...unitsB1, ...unitsB2, ...unitsC1,
  ...unitsHSK1, ...unitsHSK2, ...unitsHSK3, ...unitsHSK4,
];
export const EXAMS: LevelExam[] = [...examsA1, ...examsA2, ...examsB1, ...examsB2, ...examsC1, ...examsHSK1, ...examsHSK2, ...examsHSK3, ...examsHSK4];
export const PLACEMENT: Record<LanguageId, PlacementBank> = { en: placementEn, zh: placementZh };

export type ExercisePurpose = "practice" | "unit_assessment" | "placement" | "level_exam";

export interface IndexedExercise {
  exercise: Exercise;
  language: LanguageId;
  level: string;
  unitId: string | null;
  purpose: ExercisePurpose;
}

const exerciseIndex = new Map<string, IndexedExercise>();
const materialIndex = new Map<string, Dialogue | Passage>();
const unitIndex = new Map<string, Unit>();

for (const u of UNITS) {
  unitIndex.set(u.id, u);
  for (const m of [...u.dialogues, ...u.passages]) materialIndex.set(m.id, m);
  for (const e of u.exercises) exerciseIndex.set(e.id, { exercise: e, language: u.language, level: u.level, unitId: u.id, purpose: "practice" });
  for (const e of u.assessment) exerciseIndex.set(e.id, { exercise: e, language: u.language, level: u.level, unitId: u.id, purpose: "unit_assessment" });
}
for (const x of EXAMS) {
  for (const m of [...x.dialogues, ...x.passages]) materialIndex.set(m.id, m);
  for (const s of x.sections) for (const e of s.pool) exerciseIndex.set(e.id, { exercise: e, language: x.language, level: x.level, unitId: null, purpose: "level_exam" });
}
for (const b of Object.values(PLACEMENT)) {
  for (const m of [...b.dialogues, ...b.passages]) materialIndex.set(m.id, m);
  for (const e of b.items) exerciseIndex.set(e.id, { exercise: e, language: b.language, level: e.level, unitId: null, purpose: "placement" });
}

export function getExercise(id: string) {
  return exerciseIndex.get(id) ?? null;
}
export function allExercises() {
  return [...exerciseIndex.values()];
}
export function getMaterial(id: string | undefined) {
  return id ? materialIndex.get(id) ?? null : null;
}
export function isDialogue(m: Dialogue | Passage): m is Dialogue {
  return "speakers" in m;
}
export function getUnit(id: string) {
  return unitIndex.get(id) ?? null;
}
export function unitsFor(language: LanguageId, level?: string) {
  return UNITS.filter((u) => u.language === language && (!level || u.level === level)).sort((a, b) => a.order - b.order);
}
export function levelsWithContent(language: LanguageId) {
  return [...new Set(UNITS.filter((u) => u.language === language).map((u) => u.level))];
}
export function getExam(language: LanguageId, level: string, skill: Skill) {
  return EXAMS.find((x) => x.language === language && x.level === level && x.skill === skill) ?? null;
}
export function placementItems(language: LanguageId, skill: Skill): PlacementItem[] {
  return PLACEMENT[language].items.filter((i) => i.skill === skill);
}
