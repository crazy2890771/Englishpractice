import { describe, expect, it } from "vitest";
import { drawItems, gradeLevelExam, gradeUnitAssessment, remediationPlan, seededRng, unitReadyForAssessment, type SectionResult } from "@/engine/progression";

const section = (id: string, scores: number[], extra: Partial<SectionResult> = {}): SectionResult => ({ sectionId: id, required: true, performance: false, scores, completed: true, tags: [`tag_${id}`], ...extra });

describe("unit progression", () => {
  it("unlocks the unit test after ≥ 4 practice items at ≥ 60 %", () => {
    expect(unitReadyForAssessment({ bestScores: [1, 1, 1] }).ready).toBe(false);
    expect(unitReadyForAssessment({ bestScores: [1, 0.5, 0.5, 0.5] }).ready).toBe(true);
    expect(unitReadyForAssessment({ bestScores: [0.5, 0.5, 0.5, 0.5] }).ready).toBe(false);
  });
  it("passes a unit test at 70 %", () => {
    expect(gradeUnitAssessment([1, 0.5, 0.5]).passed).toBe(false);
    expect(gradeUnitAssessment([1, 1, 0.5, 0.5]).passed).toBe(true);
  });
});

describe("level exam rules", () => {
  it("passes with overall ≥ 80 %, every required section ≥ 70 % and performance done", () => {
    const g = gradeLevelExam([section("a", [0.9]), section("b", [0.8]), section("w", [0.75], { performance: true })]);
    expect(g.passed).toBe(true);
  });
  it("fails when one required section is below 70 % even if overall is high", () => {
    const g = gradeLevelExam([section("a", [1]), section("b", [1]), section("c", [1]), section("d", [0.6])]);
    expect(g.overall).toBeGreaterThanOrEqual(0.8);
    expect(g.passed).toBe(false);
    expect(g.failedSections).toEqual(["d"]);
  });
  it("fails when a mandatory performance task is not completed", () => {
    const g = gradeLevelExam([section("a", [1]), section("w", [1], { performance: true, completed: false })]);
    expect(g.criteria.performance).toBe(false);
    expect(g.passed).toBe(false);
  });
  it("fails when overall is below 80 %", () => {
    expect(gradeLevelExam([section("a", [0.75]), section("b", [0.75])]).passed).toBe(false);
  });
  it("builds a remediation plan from the failed sections", () => {
    const results = [section("a", [1]), section("b", [0.2]), section("c", [0.3])];
    const plan = remediationPlan(gradeLevelExam(results), results);
    expect(plan.failedSections).toEqual(["b", "c"]);
    expect(plan.focusTags).toEqual(expect.arrayContaining(["tag_b", "tag_c"]));
    expect(plan.requiredSessions).toBe(2);
  });
});

describe("item drawing", () => {
  it("prefers unseen items and is deterministic per seed", () => {
    const pool = ["a", "b", "c", "d"].map((id) => ({ id }));
    const seen = new Map([["a", 5], ["b", 6]]);
    const one = drawItems(pool, 2, seen, seededRng("x")).map((p) => p.id).sort();
    expect(one).toEqual(["c", "d"]);
    expect(drawItems(pool, 3, seen, seededRng("s")).map((p) => p.id)).toEqual(drawItems(pool, 3, seen, seededRng("s")).map((p) => p.id));
  });
});
