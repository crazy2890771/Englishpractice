import { describe, expect, it } from "vitest";
import { review, type SrsState } from "@/lib/srs";

const fresh: SrsState = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, successStreak: 0, mastered: false };

describe("spaced repetition", () => {
  it("schedules growing intervals on success", () => {
    const a = review(fresh, 4);
    const b = review(a, 4);
    const c = review(b, 4);
    expect([a.intervalDays, b.intervalDays]).toEqual([1, 3]);
    expect(c.intervalDays).toBeGreaterThan(3);
  });

  it("only masters after repeated successful reviews", () => {
    const a = review(fresh, 5);
    expect(a.mastered).toBe(false);
    const b = review(a, 5);
    expect(b.mastered).toBe(false);
    const c = review(b, 5);
    expect(c.mastered).toBe(true);
  });

  it("resets the streak and brings the item back soon after a failure", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const a = review(review(fresh, 5, now), 5, now);
    const failed = review(a, 1, now);
    expect(failed.successStreak).toBe(0);
    expect(failed.mastered).toBe(false);
    expect(failed.dueAt.getTime() - now.getTime()).toBe(10 * 60_000);
  });

  it("never lets the ease factor drop below 1.3", () => {
    let s = { ...fresh };
    for (let i = 0; i < 20; i++) s = review(s, 0);
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
