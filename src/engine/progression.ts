/**
 * Unit completion, unit assessments and level examinations.
 * Internal app criteria — NOT official CEFR or HSK certification standards.
 */
import type { Skill } from "@/content/types";

/** Practice needed before a unit assessment unlocks (per skill). */
export const UNIT_PRACTICE_MIN_ITEMS = 4;
export const UNIT_PRACTICE_MIN_ACCURACY = 0.6;
export const UNIT_ASSESSMENT_PASS = 0.7;

export const EXAM_OVERALL_PASS = 0.8;
export const EXAM_SECTION_PASS = 0.7;

export interface PracticeStats {
  /** Best score per distinct practice exercise of this skill in the unit. */
  bestScores: number[];
}

export function unitReadyForAssessment(stats: PracticeStats) {
  const n = stats.bestScores.length;
  const acc = n ? stats.bestScores.reduce((a, b) => a + b, 0) / n : 0;
  return { ready: n >= UNIT_PRACTICE_MIN_ITEMS && acc >= UNIT_PRACTICE_MIN_ACCURACY, attempted: n, accuracy: acc };
}

export function gradeUnitAssessment(scores: number[]) {
  const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return { score, passed: score >= UNIT_ASSESSMENT_PASS };
}

export interface SectionResult {
  sectionId: string;
  required: boolean;
  /** Mandatory performance task (open writing/speaking). */
  performance: boolean;
  scores: number[];
  /** For performance tasks: did the learner actually complete the task (meets minimum length)? */
  completed: boolean;
  tags: string[];
}

export interface ExamGrade {
  overall: number;
  passed: boolean;
  sections: { sectionId: string; score: number; required: boolean; passed: boolean; performanceCompleted: boolean }[];
  criteria: { overall: boolean; sections: boolean; performance: boolean };
  failedSections: string[];
}

/**
 * Pass rules: overall ≥ 80 %, every required section ≥ 70 %, every mandatory performance
 * task completed. Overall = mean of section means (each section weighs the same).
 */
export function gradeLevelExam(results: SectionResult[]): ExamGrade {
  const sections = results.map((r) => {
    const score = r.scores.length ? r.scores.reduce((a, b) => a + b, 0) / r.scores.length : 0;
    return {
      sectionId: r.sectionId,
      score,
      required: r.required,
      passed: score >= EXAM_SECTION_PASS,
      performanceCompleted: !r.performance || r.completed,
    };
  });
  const overall = sections.length ? sections.reduce((a, s) => a + s.score, 0) / sections.length : 0;
  const criteria = {
    overall: overall >= EXAM_OVERALL_PASS,
    sections: sections.filter((s) => s.required).every((s) => s.passed),
    performance: sections.every((s) => s.performanceCompleted),
  };
  const failedSections = sections.filter((s) => (s.required && !s.passed) || !s.performanceCompleted).map((s) => s.sectionId);
  return { overall, passed: criteria.overall && criteria.sections && criteria.performance, sections, criteria, failedSections };
}

export interface RemediationPlan {
  failedSections: string[];
  focusTags: string[];
  /** Remediation sessions to complete (with ≥ 70 %) before re-taking the exam. */
  requiredSessions: number;
}

export function remediationPlan(grade: ExamGrade, results: SectionResult[]): RemediationPlan {
  const tags = new Map<string, number>();
  for (const r of results) if (grade.failedSections.includes(r.sectionId)) for (const t of r.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
  return {
    failedSections: grade.failedSections,
    focusTags: [...tags.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 4),
    requiredSessions: grade.failedSections.length > 1 ? 2 : 1,
  };
}

/** Draws exam items: unseen items first, then least-recently seen; deterministic for a given rng. */
export function drawItems<T extends { id: string }>(pool: T[], n: number, seen: Map<string, number>, rng: () => number): T[] {
  return [...pool]
    .map((p) => ({ p, last: seen.get(p.id) ?? -1, r: rng() }))
    .sort((a, b) => a.last - b.last || a.r - b.r)
    .slice(0, n)
    .map((x) => x.p);
}

/** Small deterministic PRNG (mulberry32) for reproducible plans in tests. */
export function seededRng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SKILL_ORDER: Skill[] = ["listening", "speaking", "reading", "writing", "vocabulary"];
