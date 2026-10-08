import { describe, expect, it } from "vitest";
import { answersMatch, compareWords, wordCount } from "@/lib/text";
import { computeStreak, addDays } from "@/lib/dates";
import { rateLimit, _resetRateLimits } from "@/lib/rate-limit";

describe("shadowing comparison", () => {
  it("is 100% for an exact repeat (ignoring case and punctuation)", () => {
    const r = compareWords("I'm going to Tokyo for five days.", "i'm going to tokyo for five days");
    expect(r.accuracy).toBe(100);
  });
  it("treats digits and number words as equal", () => {
    expect(compareWords("I stayed for five days", "I stayed for 5 days").accuracy).toBe(100);
  });
  it("marks missed and substituted words", () => {
    const r = compareWords("Could you recommend some good places", "could you recommend good place");
    expect(r.tokens.filter((t) => t.kind === "missed").map((t) => (t as { ref: string }).ref)).toContain("some");
    expect(r.tokens.some((t) => t.kind === "wrong" && t.ref === "places" && t.said === "place")).toBe(true);
    expect(r.accuracy).toBe(67);
  });
  it("reports extra words without lowering accuracy below matched share", () => {
    const r = compareWords("See you soon", "see you very soon");
    expect(r.tokens.some((t) => t.kind === "extra")).toBe(true);
    expect(r.accuracy).toBe(100);
  });
});

describe("text helpers", () => {
  it("counts words", () => {
    expect(wordCount("  Hello   there, friend ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
  it("matches fill-in answers flexibly", () => {
    expect(answersMatch(" Four ", "four", ["4"])).toBe(true);
    expect(answersMatch("4", "four")).toBe(true);
    expect(answersMatch("five", "four")).toBe(false);
  });
});

describe("streaks", () => {
  it("counts consecutive days ending today or yesterday", () => {
    const today = "2026-10-08";
    expect(computeStreak([today, addDays(today, -1), addDays(today, -2)], today).current).toBe(3);
    expect(computeStreak([addDays(today, -1), addDays(today, -2)], today).current).toBe(2);
    expect(computeStreak([addDays(today, -3)], today).current).toBe(0);
  });
  it("tracks the longest streak", () => {
    expect(computeStreak(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-10"], "2026-01-10").longest).toBe(3);
  });
  it("handles month boundaries", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("rate limiter", () => {
  it("blocks after the limit within the window", () => {
    _resetRateLimits();
    const t = 1_000_000;
    expect(rateLimit("k", 2, 60_000, t).ok).toBe(true);
    expect(rateLimit("k", 2, 60_000, t + 1).ok).toBe(true);
    expect(rateLimit("k", 2, 60_000, t + 2).ok).toBe(false);
    expect(rateLimit("k", 2, 60_000, t + 61_000).ok).toBe(true);
  });
});
