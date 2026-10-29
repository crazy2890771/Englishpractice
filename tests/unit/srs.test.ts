import { describe, expect, it } from "vitest";
import { familiarity, NEW_ITEM, prioritizeDue, reviewItem } from "@/engine/srs";

const now = new Date("2026-01-01T00:00:00Z");

describe("SM-2 spaced repetition", () => {
  it("schedules 1 day, then 3 days, then × ease", () => {
    const a = reviewItem(NEW_ITEM, 4, now);
    expect(a.intervalDays).toBe(1);
    const b = reviewItem(a, 4, now);
    expect(b.intervalDays).toBe(3);
    const c = reviewItem(b, 4, now);
    expect(c.intervalDays).toBeCloseTo(3 * b.easeFactor, 0);
  });
  it("resets on a lapse and re-shows after 10 minutes", () => {
    const learned = reviewItem(reviewItem(NEW_ITEM, 5, now), 5, now);
    const lapse = reviewItem(learned, 1, now);
    expect(lapse.repetitions).toBe(0);
    expect(lapse.lapses).toBe(1);
    expect(lapse.dueAt.getTime() - now.getTime()).toBe(10 * 60_000);
  });
  it("never lets the ease factor drop below 1.3", () => {
    let s = { ...NEW_ITEM, dueAt: now };
    for (let i = 0; i < 20; i++) s = reviewItem(s, 0, now);
    expect(s.easeFactor).toBe(1.3);
  });
  it("derives familiarity from interval", () => {
    expect(familiarity({ intervalDays: 0, repetitions: 0 })).toBe(0);
    expect(familiarity({ intervalDays: 60, repetitions: 6 })).toBe(5);
  });
  it("prioritises the most overdue, then the most lapsed, and caps the queue", () => {
    const items = [
      { id: "a", dueAt: new Date("2025-12-30"), lapses: 0 },
      { id: "b", dueAt: new Date("2025-12-25"), lapses: 0 },
      { id: "c", dueAt: new Date("2026-02-01"), lapses: 5 },
    ];
    expect(prioritizeDue(items, now, 5).map((i) => i.id)).toEqual(["b", "a"]);
    expect(prioritizeDue(items, now, 1)).toHaveLength(1);
  });
});
