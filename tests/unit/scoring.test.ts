import { describe, expect, it } from "vitest";
import { align, normalizeEn, normalizeZh, responseLength, scoreObjective, stripTones, tokens } from "@/engine/scoring";
import type { Exercise } from "@/content/types";

const base = { id: "t", skill: "reading", level: "A1", tags: [], prompt: "p", explanation: "e" } as const;

describe("normalisation", () => {
  it("treats contractions, case and punctuation as equal in English", () => {
    expect(normalizeEn("I'm GOING home!")).toBe(normalizeEn("i am going home"));
    expect(normalizeEn("can't")).toBe(normalizeEn("cannot"));
    expect(normalizeEn("won't")).toBe(normalizeEn("will not"));
  });
  it("ignores Chinese punctuation and spaces", () => {
    expect(normalizeZh("我是 学生。")).toBe(normalizeZh("我是学生"));
  });
  it("strips pinyin tone marks", () => {
    expect(stripTones("nǐ hǎo")).toBe("ni hao");
  });
  it("tokenises Chinese per character", () => {
    expect(tokens("zh", "你好吗")).toEqual(["你", "好", "吗"]);
  });
});

describe("align", () => {
  it("scores identical sequences 1", () => {
    expect(align(["a", "b", "c"], ["a", "b", "c"]).accuracy).toBe(1);
  });
  it("penalises missing and extra words", () => {
    const r = align(["i", "like", "green", "tea"], ["i", "like", "tea", "very"]);
    expect(r.accuracy).toBeLessThan(1);
    expect(r.accuracy).toBeGreaterThan(0);
  });
});

describe("scoreObjective", () => {
  it("scores multiple choice deterministically", () => {
    const ex = { ...base, type: "mcq", options: ["a", "b"], answer: 1 } as unknown as Exercise;
    expect(scoreObjective("en", ex, { choice: 1 })!.correct).toBe(true);
    expect(scoreObjective("en", ex, { choice: 0 })!.score).toBe(0);
  });
  it("accepts any listed answer for fill-blank, ignoring case", () => {
    const ex = { ...base, type: "fill_blank", text: "I ___ tea.", answers: ["like", "love"] } as unknown as Exercise;
    expect(scoreObjective("en", ex, { text: "Love" })!.correct).toBe(true);
    expect(scoreObjective("en", ex, { text: "" })!.correct).toBe(false);
  });
  it("gives partial credit for sentence order prefixes", () => {
    const ex = { ...base, type: "sentence_order", tokens: ["I", "am", "a", "student"] } as unknown as Exercise;
    expect(scoreObjective("en", ex, { order: ["I", "am", "a", "student"] })!.score).toBe(1);
    const partial = scoreObjective("en", ex, { order: ["I", "am", "student", "a"] })!;
    expect(partial.correct).toBe(false);
    expect(partial.score).toBe(0.5);
  });
  it("scores match pairs proportionally", () => {
    const ex = { ...base, type: "match_pairs", pairs: [["a", "1"], ["b", "2"]] } as unknown as Exercise;
    expect(scoreObjective("en", ex, { pairs: { a: "1", b: "1" } })!.score).toBe(0.5);
  });
  it("returns null for open tasks (rubric evaluation)", () => {
    const ex = { ...base, type: "open_writing", minLength: 20, requirements: [] } as unknown as Exercise;
    expect(scoreObjective("en", ex, { text: "hello" })).toBeNull();
  });
});

describe("responseLength", () => {
  it("counts words in English and Han characters in Chinese", () => {
    expect(responseLength("en", "I like green tea")).toBe(4);
    expect(responseLength("zh", "我喜欢喝茶。ok")).toBe(5);
  });
});
