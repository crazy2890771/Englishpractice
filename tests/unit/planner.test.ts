import { describe, expect, it } from "vitest";
import { buildSessionPlan, itemCost, planExerciseIds, type PlannerInput } from "@/engine/planner";
import { seededRng } from "@/engine/progression";
import { getExercise, unitsFor } from "@/content";
import type { Skill, Unit } from "@/content/types";

function input(language: "en" | "zh", skills: Skill[], minutes: number, extra: Partial<PlannerInput> = {}): PlannerInput {
  const level = language === "en" ? "B1" : "HSK2";
  const [u1, u2] = unitsFor(language, level);
  const current: Partial<Record<Skill, Unit>> = {};
  const prev: Partial<Record<Skill, Unit[]>> = {};
  for (const s of ["listening", "speaking", "reading", "writing", "vocabulary"] as Skill[]) {
    current[s] = u2 ?? u1!;
    prev[s] = u2 ? [u1!] : [];
  }
  return { language, skills, minutes, currentUnit: current, previousUnits: prev, stats: new Map(), focusTags: [], dueVocabIds: [], rng: seededRng("t"), now: Date.parse("2026-03-01"), ...extra };
}

const types = (ids: string[]) => ids.map((id) => getExercise(id)!.exercise.type);

describe("session planner", () => {
  it.each([
    ["en", ["listening", "speaking"]],
    ["en", ["reading", "writing"]],
    ["zh", ["listening", "speaking"]],
    ["zh", ["reading", "writing"]],
  ] as const)("%s %j: warm-up → skills → corrections → mini assessment", (lang, skills) => {
    const plan = buildSessionPlan(input(lang, [...skills], 30));
    const t = plan.activities.map((a) => a.type);
    expect(t[0]).toBe("warmup");
    expect(t.filter((x) => x === "skill")).toHaveLength(2);
    expect(t.slice(-2)).toEqual(["corrections", "mini_assessment"]);
  });

  it("never repeats an exercise within a session", () => {
    const ids = planExerciseIds(buildSessionPlan(input("en", ["reading", "writing"], 45)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("always includes a production task in writing and speaking blocks", () => {
    for (const skills of [["reading", "writing"], ["listening", "speaking"]] as Skill[][]) {
      for (const minutes of [10, 30, 60]) {
        const plan = buildSessionPlan(input("en", skills, minutes));
        const block = plan.activities.find((a) => a.type === "skill" && a.skill === skills[1])!;
        const t = types(block.items.map((i) => (i as { exerciseId: string }).exerciseId));
        expect(t.some((x) => x === "open_writing" || x === "speaking_response"), `${skills} ${minutes}`).toBe(true);
      }
    }
  });

  it("scales the amount of practice with the chosen duration", () => {
    const cost = (m: number) => planExerciseIds(buildSessionPlan(input("en", ["listening", "speaking"], m))).reduce((s, id) => s + itemCost(getExercise(id)!.exercise), 0);
    expect(cost(60)).toBeGreaterThan(cost(15));
  });

  it("builds a vocabulary + review day from due cards and weaknesses", () => {
    const plan = buildSessionPlan(input("zh", ["vocabulary"], 30, { dueVocabIds: ["v1", "v2", "v3"] }));
    const review = plan.activities.find((a) => a.type === "vocab_review")!;
    expect(review.items.map((i) => (i as { vocabId: string }).vocabId)).toEqual(["v1", "v2", "v3"]);
    expect(plan.activities.map((a) => a.type)).toContain("weakness_review");
  });

  it("prioritises exercises tagged with active weaknesses", () => {
    const base = input("en", ["reading", "writing"], 30);
    const tag = base.currentUnit.reading!.exercises.find((e) => e.skill === "reading" && e.tags.length)!.tags[0]!;
    const plan = buildSessionPlan({ ...base, focusTags: [tag] });
    const reasons = plan.activities.flatMap((a) => a.items.map((i) => i.reason));
    expect(reasons).toContain("weakness");
  });
});
