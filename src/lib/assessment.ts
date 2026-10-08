/** Shared, deterministic aggregation so Day 1 and Day 30 results are comparable. */
export interface AssessmentScores {
  speaking: { grammar: number; vocabulary: number; fluency: number; taskCompletion: number };
  listening: { score: number; max: number; percent: number };
  writing: { grammar: number; vocabulary: number; clarity: number; coherence: number; taskCompletion: number };
  /** 0–100 */
  sections: { speaking: number; listening: number; writing: number };
}

export function sectionPercent(bands: Record<string, number>) {
  const vals = Object.values(bands);
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 5)) * 100) : 0;
}

export function overallPercent(s: AssessmentScores["sections"]) {
  return Math.round((s.speaking + s.listening + s.writing) / 3);
}

/** Rough self-study guide only — NOT a certified CEFR result. */
export function estimatedLevel(overall: number) {
  if (overall < 40) return "A2";
  if (overall < 55) return "B1";
  if (overall < 70) return "B1+";
  if (overall < 85) return "B2";
  return "B2+";
}
