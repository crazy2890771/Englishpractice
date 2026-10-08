import type { ListeningExercise, ListeningQuestion } from "@/content/types";
import { answersMatch } from "./text";

export type AnswerMap = Record<string, string | number | null | undefined>;

export function isCorrect(q: ListeningQuestion, given: string | number | null | undefined) {
  if (given === null || given === undefined || given === "") return false;
  if (q.type === "fill") return answersMatch(String(given), String(q.answer), q.accept);
  return Number(given) === Number(q.answer);
}

/** Grades a listening attempt. Grading happens server-side so answers can't be spoofed. */
export function gradeListening(ex: ListeningExercise, answers: AnswerMap) {
  const results = ex.questions.map((q) => {
    const given = answers[q.id];
    const correct = isCorrect(q, given);
    return {
      id: q.id,
      correct,
      given: given ?? null,
      expected: q.type === "fill" ? String(q.answer) : q.options?.[Number(q.answer)] ?? String(q.answer),
      explanation: q.explanation,
    };
  });
  const score = results.filter((r) => r.correct).length;
  return { score, max: ex.questions.length, percent: Math.round((score / ex.questions.length) * 100), results };
}

/** Adaptive difficulty: use the challenge variant when recent accuracy is high. */
export function chooseVariant(recentPercents: number[], level: string): "standard" | "challenge" {
  if (recentPercents.length === 0) return level === "B2" ? "challenge" : "standard";
  const recent = recentPercents.slice(0, 3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return avg >= 80 ? "challenge" : "standard";
}
