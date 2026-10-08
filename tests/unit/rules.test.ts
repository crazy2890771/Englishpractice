import { describe, expect, it } from "vitest";
import { applyRules } from "@/lib/feedback/rules";

const fix = (s: string, spoken = false) => applyRules(s, { spoken });

describe("rule-based corrector", () => {
  it.each([
    ["She don't like coffee.", "She doesn't like coffee."],
    ["I am agree with you.", "I agree with you."],
    ["I didn't went to work.", "I didn't go to work."],
    ["I have been to London last year.", "I went to London last year."],
    ["I have lived here since 5 years.", "I have lived here for 5 years."],
    ["We discussed about the plan.", "We discussed the plan."],
    ["I look forward to meet you.", "I look forward to meeting you."],
    ["Can you give me some informations?", "Can you give me some information?"],
    ["There is many people here.", "There are many people here."],
    ["My brother work in Paris.", "My brother works in Paris."],
    ["I made a photo of a apple.", "I took a photo of an apple."],
    ["I did a mistake.", "I made a mistake."],
    ["It is more easier now.", "It is easier now."],
    ["An university course.", "A university course."],
  ])("corrects %s", (input, expected) => {
    expect(fix(input).corrected).toBe(expected);
  });

  it.each([
    "I agree with you.",
    "Does he have a car?",
    "She has to go now.",
    "I have lived here since 2019.",
    "I've been to London twice.",
    "It was an honest mistake and took an hour.",
    "A one-way ticket and a European city, please.",
    "I need an MBA.",
    "Everyday life is busy.",
    "Could you recommend a hotel?",
  ])("does not over-correct acceptable English: %s", (input) => {
    const r = fix(input);
    expect(r.items).toHaveLength(0);
    expect(r.corrected).toBe(input);
  });

  it("returns explanations and categories for every item", () => {
    const r = fix("She don't discuss about informations.");
    expect(r.items.length).toBeGreaterThanOrEqual(3);
    for (const it of r.items) {
      expect(it.explanation.length).toBeGreaterThan(5);
      expect(["grammar", "vocabulary", "pronunciation", "expression"]).toContain(it.category);
    }
  });

  it("offers a more natural spoken version without counting it as an error", () => {
    const r = fix("I will stay in Tokyo for five days. Can you suggest some places to visit?", true);
    expect(r.items).toHaveLength(0);
    expect(r.natural).toBe("I'll stay in Tokyo for five days. Could you suggest some places to visit?");
  });

  it("fixes lowercase i silently in speech but flags it in writing", () => {
    expect(fix("yesterday i went home", true).items).toHaveLength(0);
    expect(fix("yesterday i went home", true).corrected).toBe("Yesterday I went home");
    expect(fix("Yesterday i went home").items.map((i) => i.original)).toContain("i");
  });
});
