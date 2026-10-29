import { describe, expect, it } from "vitest";
import { demoEvaluate, requiredTokens, RUBRIC_KEYS, scoreFromCriteria } from "@/engine/open-eval";
import { applyRules } from "@/engine/demo/en-rules";
import { applyZhRules } from "@/engine/demo/zh-rules";

describe("English demo rules", () => {
  it("corrects common learner errors", () => {
    const r = applyRules("I have 25 years old and I am agree with you.");
    expect(r.corrected).toMatch(/I'm 25 years old and/);
    expect(r.corrected).toMatch(/I agree/);
    expect(r.items.length).toBeGreaterThan(0);
  });
  it("leaves a correct sentence untouched", () => {
    expect(applyRules("She works in Bangkok.").items).toHaveLength(0);
  });
});

describe("Chinese demo rules", () => {
  it("flags 是 + adjective and wrong measure words", () => {
    const r = applyZhRules("他是很高。我有三个书。");
    expect(r.items.length).toBe(2);
    expect(r.corrected).toContain("他很高");
    expect(r.corrected).toContain("三本书");
  });
});

describe("demo evaluator", () => {
  it("is always labelled demo and never scores pronunciation", () => {
    const e = demoEvaluate({ language: "en", kind: "speaking", text: "I like coffee because it is tasty.", minLength: 10, requirements: [], explanationLanguage: "th" });
    expect(e.evaluator).toBe("demo_rules");
    expect(e.pronunciation).toBeNull();
    expect(e.limitations).toEqual(expect.arrayContaining(["demo_evaluator", "no_pronunciation_assessment"]));
    expect(Object.keys(e.criteria)).toEqual(RUBRIC_KEYS.speaking);
  });
  it("reports whether the minimum length was met", () => {
    expect(demoEvaluate({ language: "en", kind: "writing", text: "Too short.", minLength: 40, requirements: [], explanationLanguage: "en" }).meetsLength).toBe(false);
  });
  it("scores Chinese by characters", () => {
    const e = demoEvaluate({ language: "zh", kind: "writing", text: "我每天早上七点起床，然后吃早饭。因为我喜欢运动，所以我常常跑步。", minLength: 20, requirements: [], explanationLanguage: "th" });
    expect(e.meetsLength).toBe(true);
    expect(e.score).toBeGreaterThan(0.4);
  });
  it("extracts quoted required tokens", () => {
    expect(requiredTokens(["use '了'", "include “because”"])).toEqual(["了", "because"]);
  });
  it("scores criteria as mean band / 5", () => {
    expect(scoreFromCriteria({ a: 5, b: 3 }, ["a", "b"])).toBe(0.8);
  });
});
