import { describe, expect, it } from "vitest";
import { allExercises, EXAMS, getMaterial, levelsWithContent, PLACEMENT, UNITS, unitsFor } from "@/content";
import { exerciseProblems, exerciseSchema } from "@/content/validate";
import { TAG_IDS } from "@/content/tags";

describe("curriculum content", () => {
  const all = allExercises();
  it("has a substantial bank of exercises", () => {
    expect(all.length).toBeGreaterThan(1000);
  });
  it("has unique exercise ids", () => {
    const ids = [
      ...UNITS.flatMap((u) => [...u.exercises, ...u.assessment]),
      ...EXAMS.flatMap((x) => x.sections.flatMap((s) => s.pool)),
      ...Object.values(PLACEMENT).flatMap((b) => b.items),
    ].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every exercise is structurally valid", () => {
    const problems: string[] = [];
    for (const { exercise, language } of all) {
      const r = exerciseSchema.safeParse(exercise);
      if (!r.success) problems.push(`${exercise.id}: schema`);
      for (const p of exerciseProblems(exercise, language)) problems.push(`${exercise.id}: ${p}`);
    }
    expect(problems).toEqual([]);
  });
  it("uses only known weakness tags", () => {
    const unknown = all.flatMap(({ exercise }) => (exercise.tags ?? []).filter((t) => !TAG_IDS.has(t)).map((t) => `${exercise.id}:${t}`));
    expect(unknown).toEqual([]);
  });
  it("references existing materials", () => {
    const missing = all.filter(({ exercise }) => exercise.source && !getMaterial(exercise.source)).map(({ exercise }) => exercise.id);
    expect(missing).toEqual([]);
  });
  it.each(["en", "zh"] as const)("%s: every level with units has a level exam for each skill", (l) => {
    for (const level of levelsWithContent(l)) {
      expect(unitsFor(l, level).length).toBeGreaterThan(0);
      for (const skill of ["listening", "speaking", "reading", "writing", "vocabulary"]) {
        expect(EXAMS.some((x) => x.language === l && x.level === level && x.skill === skill), `${l} ${level} ${skill}`).toBe(true);
      }
    }
  });
  it("has units for both languages", () => {
    expect(UNITS.some((u) => u.language === "en")).toBe(true);
    expect(UNITS.some((u) => u.language === "zh")).toBe(true);
  });
});
