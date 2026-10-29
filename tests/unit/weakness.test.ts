import { describe, expect, it } from "vitest";
import { evaluateWeakness, focusCategories } from "@/engine/weakness";

const now = new Date("2026-03-01T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe("weakness tracker", () => {
  it("never marks a weakness from a single mistake", () => {
    expect(evaluateWeakness({ mistakes: [{ at: daysAgo(1), exerciseId: "e1" }], taggedAttempts: [] }, now).status).toBe("watching");
  });
  it("requires repeated mistakes across at least two exercises", () => {
    const sameExercise = [1, 2, 3].map((d) => ({ at: daysAgo(d), exerciseId: "e1" }));
    expect(evaluateWeakness({ mistakes: sameExercise, taggedAttempts: [] }, now).status).toBe("watching");
    const spread = [1, 2, 3].map((d, i) => ({ at: daysAgo(d), exerciseId: `e${i % 2}` }));
    expect(evaluateWeakness({ mistakes: spread, taggedAttempts: [] }, now).status).toBe("active");
  });
  it("one bad lesson (all mistakes on the same day) is not a weakness yet", () => {
    const sameDay = [1, 2, 3, 4].map((i) => ({ at: new Date(now.getTime() - 86_400_000 - i * 60_000), exerciseId: `e${i}` }));
    expect(evaluateWeakness({ mistakes: sameDay, taggedAttempts: [] }, now).status).toBe("watching");
  });
  it("ignores mistakes older than 21 days for activation", () => {
    const old = [30, 31, 32].map((d, i) => ({ at: daysAgo(d), exerciseId: `e${i}` }));
    expect(evaluateWeakness({ mistakes: old, taggedAttempts: [] }, now).status).toBe("watching");
  });
  it("moves active → improving → resolved with evidence", () => {
    const mistakes = [20, 19, 18].map((d, i) => ({ at: daysAgo(d), exerciseId: `e${i}` }));
    const good = [1, 2, 3].map((d) => ({ at: daysAgo(d), score: 0.9 }));
    expect(evaluateWeakness({ mistakes, taggedAttempts: good, previousStatus: "active" }, now).status).toBe("improving");
    const many = [1, 2, 3, 4, 5].map((d) => ({ at: daysAgo(d), score: 0.95 }));
    expect(evaluateWeakness({ mistakes, taggedAttempts: many, previousStatus: "improving" }, now).status).toBe("resolved");
  });
  it("focuses on active weaknesses first", () => {
    const list = [
      { categoryId: "a", status: "improving" as const, mastery: 0.7, recentOccurrences: 5 },
      { categoryId: "b", status: "active" as const, mastery: 0.3, recentOccurrences: 3 },
      { categoryId: "c", status: "resolved" as const, mastery: 0.9, recentOccurrences: 0 },
    ];
    expect(focusCategories(list)).toEqual(["b", "a"]);
  });
});
