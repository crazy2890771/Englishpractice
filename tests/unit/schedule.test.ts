import { describe, expect, it } from "vitest";
import { addDays, DEFAULT_SCHEDULE, localDay, missedLessons, slotsFor, weeklyConsistency } from "@/engine/schedule";

describe("weekly schedule", () => {
  it("matches the required default week", () => {
    const day = (w: number) => slotsFor(DEFAULT_SCHEDULE, w).map((s) => `${s.languageId}:${s.skills.join("+")}`);
    expect(day(0)).toEqual(["en:listening+speaking"]);
    expect(day(1)).toEqual(["en:reading+writing"]);
    expect(day(2)).toEqual(["zh:listening+speaking"]);
    expect(day(3)).toEqual(["zh:reading+writing"]);
    expect(day(4)).toEqual(["en:listening+speaking"]);
    expect(day(5)).toEqual(["en:reading+writing"]);
    expect(day(6)).toEqual(["en:vocabulary", "zh:vocabulary"]);
  });
  it("computes the local day in Asia/Bangkok, not UTC", () => {
    // 2026-03-01 18:30 UTC is already Monday 01:30 in Bangkok.
    const d = localDay(new Date("2026-03-01T18:30:00Z"), "Asia/Bangkok");
    expect(d.date).toBe("2026-03-02");
    expect(d.weekday).toBe(1);
  });
  it("falls back to Asia/Bangkok for an invalid time zone", () => {
    expect(localDay(new Date("2026-03-01T18:30:00Z"), "Not/AZone").date).toBe("2026-03-02");
  });
  it("lists missed scheduled lessons as make-ups, excluding completed ones", () => {
    const today = "2026-03-04"; // Wednesday
    const missed = missedLessons(DEFAULT_SCHEDULE, [{ kind: "scheduled", status: "completed", scheduledDate: "2026-03-03", languageId: "zh", skills: ["listening", "speaking"] }], today, 2);
    expect(missed.map((m) => `${m.date}:${m.slot.languageId}`)).toEqual(["2026-03-02:en"]);
  });
  it("practice sessions do not count as the scheduled lesson", () => {
    const missed = missedLessons(DEFAULT_SCHEDULE, [{ kind: "practice", status: "completed", scheduledDate: "2026-03-03", languageId: "zh", skills: ["listening", "speaking"] }], "2026-03-04", 1);
    expect(missed).toHaveLength(1);
  });
  it("counts active days per week", () => {
    const w = weeklyConsistency(["2026-03-01", "2026-03-02", addDays("2026-03-01", -7)], "2026-03-04", 2);
    expect(w.map((x) => x.days)).toEqual([1, 2]);
  });
});
