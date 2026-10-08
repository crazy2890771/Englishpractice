import { describe, expect, it } from "vitest";
import { heuristicTurnFeedback, heuristicWritingFeedback, lexicalDiversity, scoreSpeaking, scoreWriting } from "@/lib/feedback/heuristics";
import { turnFeedbackSchema, writingFeedbackSchema } from "@/lib/ai/schemas";
import { estimatedLevel, overallPercent, sectionPercent } from "@/lib/assessment";

describe("heuristic scoring", () => {
  it("gives higher grammar bands to error-free answers", () => {
    const clean = scoreSpeaking("I usually get up at seven, have a quick coffee and walk to the station.", { errors: 0 });
    const messy = scoreSpeaking("I usually get up at seven, have a quick coffee and walk to the station.", { errors: 3 });
    expect(clean.grammar).toBeGreaterThan(messy.grammar);
  });

  it("rewards longer, developed answers for fluency", () => {
    const short = scoreSpeaking("Yes, I like it.", { errors: 0 });
    const long = scoreSpeaking(
      "Yes, I really like it because it helps me relax after work. Usually I go running in the park near my flat, and at weekends I sometimes join a group of friends for a longer run along the river.",
      { errors: 0 },
    );
    expect(long.fluency).toBeGreaterThan(short.fluency);
    expect(long.taskCompletion).toBeGreaterThanOrEqual(short.taskCompletion);
  });

  it("is deterministic (same input → same scores)", () => {
    const t = "Last summer I travelled to Japan with my sister and we visited Kyoto.";
    expect(scoreSpeaking(t, { errors: 0 })).toEqual(scoreSpeaking(t, { errors: 0 }));
  });

  it("lexical diversity is 0 for empty text", () => {
    expect(lexicalDiversity("")).toBe(0);
  });

  it("writing: under-length text gets lower task completion", () => {
    const shortText = "Hi Tom, I am fine. See you soon.";
    const s = scoreWriting(shortText, { errors: 0, minWords: 100, maxWords: 150, type: "email" });
    expect(s.taskCompletion).toBe(1);
  });

  it("produces schema-valid feedback objects", () => {
    expect(turnFeedbackSchema.safeParse(heuristicTurnFeedback("She don't like it.", { question: "Does your sister like coffee?" })).success).toBe(true);
    expect(
      writingFeedbackSchema.safeParse(heuristicWritingFeedback("Dear Sir, I am writing to ask about the room. However, I have a question.", { minWords: 100, maxWords: 150, type: "email" })).success,
    ).toBe(true);
  });
});

describe("assessment aggregation", () => {
  it("converts bands to percentages consistently", () => {
    expect(sectionPercent({ a: 5, b: 5 })).toBe(100);
    expect(sectionPercent({ a: 3, b: 2 })).toBe(50);
    expect(overallPercent({ speaking: 60, listening: 75, writing: 45 })).toBe(60);
  });
  it("maps overall percentages to rough levels", () => {
    expect(estimatedLevel(30)).toBe("A2");
    expect(estimatedLevel(50)).toBe("B1");
    expect(estimatedLevel(65)).toBe("B1+");
    expect(estimatedLevel(80)).toBe("B2");
  });
});
