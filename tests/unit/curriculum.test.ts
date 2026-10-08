import { describe, expect, it } from "vitest";
import { lessons, TOTAL_DAYS } from "@/content/curriculum";
import { roleplays } from "@/content/roleplays";
import { topicBanks } from "@/content/topics";
import { assessment } from "@/content/assessment";
import type { ListeningExercise } from "@/content/types";
import { gradeListening, chooseVariant } from "@/lib/listening";
import { answersMatch } from "@/lib/text";

const allExercises: ListeningExercise[] = [...lessons.flatMap((l) => [l.listening.standard, l.listening.challenge]), assessment.listening];

describe("30-day curriculum", () => {
  it("has exactly 30 sequential lessons across 4 weeks", () => {
    expect(lessons).toHaveLength(TOTAL_DAYS);
    lessons.forEach((l, i) => expect(l.day).toBe(i + 1));
    expect(new Set(lessons.map((l) => l.week))).toEqual(new Set([1, 2, 3, 4]));
  });

  it("every lesson has all required parts", () => {
    for (const l of lessons) {
      expect(l.objectives.length).toBeGreaterThan(0);
      expect(l.speaking.openingQuestion).toBeTruthy();
      expect(l.speaking.followUps.length).toBeGreaterThanOrEqual(5);
      expect(l.writing.prompt).toBeTruthy();
      expect(l.shadowing.length).toBeGreaterThanOrEqual(l.completion.shadowingSentences);
      expect(l.vocabulary.length).toBeGreaterThan(0);
      expect(l.review.length).toBeGreaterThan(0);
      expect(l.completion.speakingTurns).toBeLessThanOrEqual(l.speaking.followUps.length + 1);
    }
  });

  it("every day has unique content", () => {
    const uniq = (xs: string[]) => new Set(xs.map((x) => x.toLowerCase().trim())).size === xs.length;
    expect(uniq(lessons.map((l) => l.title))).toBe(true);
    expect(uniq(lessons.map((l) => l.writing.prompt))).toBe(true);
    expect(uniq(lessons.map((l) => l.speaking.openingQuestion))).toBe(true);
    expect(uniq(lessons.flatMap((l) => l.shadowing.map((s) => s.text)))).toBe(true);
    expect(uniq(lessons.flatMap((l) => l.vocabulary.map((v) => v.word)))).toBe(true);
    expect(uniq(allExercises.map((e) => e.id))).toBe(true);
  });

  it("Day 8 is Travel Plans and Arrangements", () => {
    expect(lessons[7]!.title).toBe("Travel Plans and Arrangements");
  });
});

describe("listening content integrity", () => {
  it.each(allExercises.map((e) => [e.id, e] as const))("%s has answerable questions", (_id, ex) => {
    const transcript = ex.lines.map((l) => l.text).join(" ").toLowerCase();
    expect(new Set(ex.questions.map((q) => q.id)).size).toBe(ex.questions.length);
    for (const q of ex.questions) {
      if (q.type === "fill") {
        expect(transcript).toContain(String(q.answer).toLowerCase());
      } else {
        expect(q.options).toBeDefined();
        expect(Number(q.answer)).toBeGreaterThanOrEqual(0);
        expect(Number(q.answer)).toBeLessThan(q.options!.length);
      }
      expect(q.explanation.length).toBeGreaterThan(5);
    }
  });

  it("grades a perfect answer sheet as 100%", () => {
    const ex = lessons[0]!.listening.standard;
    const answers = Object.fromEntries(ex.questions.map((q) => [q.id, q.answer]));
    const r = gradeListening(ex, answers);
    expect(r.percent).toBe(100);
    expect(r.results.every((x) => x.correct)).toBe(true);
  });

  it("grades blanks as wrong and explains them", () => {
    const ex = lessons[0]!.listening.standard;
    const r = gradeListening(ex, {});
    expect(r.score).toBe(0);
    expect(r.results.every((x) => !x.correct && x.explanation)).toBe(true);
  });

  it("accepts alternative fill answers", () => {
    for (const ex of allExercises)
      for (const q of ex.questions) if (q.type === "fill") for (const a of q.accept ?? []) expect(answersMatch(a, String(q.answer), q.accept)).toBe(true);
  });

  it("adapts difficulty to recent accuracy", () => {
    expect(chooseVariant([], "B1")).toBe("standard");
    expect(chooseVariant([], "B2")).toBe("challenge");
    expect(chooseVariant([90, 80, 85], "B1")).toBe("challenge");
    expect(chooseVariant([40, 60, 100], "B2")).toBe("standard");
  });
});

describe("other content", () => {
  it("has roleplays in every required category", () => {
    const cats = new Set(roleplays.map((r) => r.category));
    for (const c of ["interview", "hotel", "airport", "workplace", "customer-service", "aviation"]) expect(cats.has(c as never)).toBe(true);
    for (const r of roleplays) {
      expect(r.objectives.length).toBeGreaterThan(0);
      expect(r.demoTurns.length).toBeGreaterThan(0);
    }
  });
  it("has the six free-conversation topic banks", () => {
    expect(topicBanks.map((t) => t.id).sort()).toEqual(["aviation", "daily-life", "hobbies", "interviews", "travel", "work"]);
  });
  it("assessment has comparable speaking, listening and writing parts", () => {
    expect(assessment.speaking.length).toBe(3);
    expect(assessment.listening.questions.length).toBe(8);
    expect(assessment.writing.minWords).toBe(100);
  });
});
