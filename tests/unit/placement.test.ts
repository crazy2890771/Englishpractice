import { describe, expect, it } from "vitest";
import { estimateObjective, estimateOpen, initialState, MAX_ITEMS, nextItem, nextOpenLevelIdx, recordObjectiveAnswer, type PlacementState } from "@/engine/placement";
import { PLACEMENT, placementItems } from "@/content";
import { LANGUAGES } from "@/languages";

const bankLevels = (l: "en" | "zh") => {
  const have = new Set(PLACEMENT[l].items.map((i) => i.level));
  return LANGUAGES[l].levels.map((x) => x.code).filter((c) => have.has(c));
};

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const items = LEVELS.flatMap((l) => [1, 2, 3, 4].map((n) => ({ id: `${l}-${n}`, level: l, type: n % 2 ? "mcq" : "fill_blank" })));

/** Simulates a learner who answers everything at or below `trueIdx` correctly. */
function simulate(trueIdx: number, start = "B1") {
  let s: PlacementState = initialState(LEVELS, start);
  while (!s.done) {
    const it = nextItem(items, LEVELS, s);
    if (!it) break;
    const remaining = items.filter((i) => i.level === it.level && !s.answers.some((a) => a.itemId === i.id) && i.id !== it.id).length;
    s = recordObjectiveAnswer(s, LEVELS, { itemId: it.id, level: it.level, score: LEVELS.indexOf(it.level) <= trueIdx ? 1 : 0, tags: [] }, remaining);
  }
  return s;
}

describe("adaptive placement (objective)", () => {
  it.each([0, 1, 2, 3, 4])("brackets a learner whose true level is index %i", (idx) => {
    const s = simulate(idx);
    const est = estimateObjective(s, LEVELS);
    expect(est.level).toBe(LEVELS[idx]);
    expect(s.answers.length).toBeLessThanOrEqual(MAX_ITEMS);
  });
  it("flags a true beginner as below the first level", () => {
    const est = estimateObjective(simulate(-1), LEVELS);
    expect(est.belowFirstLevel).toBe(true);
    expect(est.limitations).toContain("floor");
  });
  it("flags a ceiling result", () => {
    const est = estimateObjective(simulate(5), LEVELS);
    expect(est.atCeiling).toBe(true);
    expect(est.limitations).toContain("ceiling");
  });
  it("always labels the result unofficial", () => {
    expect(estimateObjective(simulate(2), LEVELS).limitations).toContain("unofficial");
  });
  it("never repeats an item", () => {
    const s = simulate(3);
    expect(new Set(s.answers.map((a) => a.itemId)).size).toBe(s.answers.length);
  });
});

describe("adaptive placement (open tasks)", () => {
  it("moves the second task up after a strong answer and down after a weak one", () => {
    expect(nextOpenLevelIdx(2, 6, [4.5])).toBe(3);
    expect(nextOpenLevelIdx(2, 6, [2])).toBe(1);
    expect(nextOpenLevelIdx(2, 6, [3])).toBe(2);
  });
  it("marks demo-evaluated estimates as low confidence and never assesses pronunciation", () => {
    const est = estimateOpen(LEVELS, [{ levelIdx: 2, band: 4, tags: [] }, { levelIdx: 3, band: 2, tags: [] }], "demo_rules");
    expect(est.level).toBe("B1");
    expect(est.confidence).toBe("low");
    expect(est.limitations).toEqual(expect.arrayContaining(["demo_evaluator", "no_pronunciation_assessment"]));
  });
});

describe("placement banks", () => {
  it.each(["en", "zh"] as const)("%s has items for every objective skill at every placement level", (l) => {
    for (const skill of ["listening", "reading", "vocabulary"] as const) {
      const pool = placementItems(l, skill);
      for (const level of bankLevels(l)) expect(pool.filter((i) => i.level === level).length, `${l} ${skill} ${level}`).toBeGreaterThanOrEqual(2);
    }
    expect(bankLevels(l)).toContain(LANGUAGES[l].placementStart);
  });
});
