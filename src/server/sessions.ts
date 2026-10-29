import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import type { Exercise, LanguageId, Skill } from "@/content/types";
import { EXAMS, getExam, getExercise, getUnit, unitsFor } from "@/content";
import { buildSessionPlan, planExerciseIds, type ExerciseStat, type PlanActivity, type SessionPlan } from "@/engine/planner";
import { scoreObjective, type Response as AnswerResponse } from "@/engine/scoring";
import { drawItems, gradeLevelExam, gradeUnitAssessment, remediationPlan, seededRng, type RemediationPlan, type SectionResult } from "@/engine/progression";
import { localDay } from "@/engine/schedule";
import type { OpenEvaluation } from "@/engine/open-eval";
import { evaluateOpen } from "@/ai/teacher";
import { advanceLevel, completeUnit, contentLevels, currentUnits, getSkillProgress, previousUnits, refreshUnitPractice } from "./curriculum";
import { addUnitVocabulary, dueVocabulary } from "./vocab";
import { focusTagsFor, refreshWeaknesses } from "./weakness";
import { modelAnswerOf, toClientExercise, toClientMaterial, transcriptOf } from "./dto";
import { HttpError } from "./http";
import { assertAiAllowed, usageRecorder } from "./ai-usage";
import { explanationLang, providerFor, type Learner } from "./learner";

export type SessionRow = typeof schema.studySessions.$inferSelect;
export type SessionKind = "scheduled" | "practice" | "makeup" | "review" | "unit_assessment" | "level_exam" | "remediation";

export interface AnswerRecord {
  score: number;
  correct: boolean;
  attemptId: string;
  retried?: boolean;
}

export interface SessionState {
  pos?: { a: number; i: number };
  answered?: Record<string, AnswerRecord>;
  retryQueue?: string[];
  drafts?: Record<string, string>;
  paused?: boolean;
  vocabDone?: Record<string, boolean>;
}

const EXAM_KINDS = new Set(["unit_assessment", "level_exam"]);
const clip = (t: string, max = 90) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);

export const isExamKind = (kind: string) => EXAM_KINDS.has(kind);

/* ───────────────────────── Creation ───────────────────────── */

async function exerciseStats(tx: Tx, userId: string, language: LanguageId) {
  const rows = await tx
    .select({ exerciseId: schema.exerciseAttempts.exerciseId, score: schema.exerciseAttempts.score, at: schema.exerciseAttempts.createdAt })
    .from(schema.exerciseAttempts)
    .where(and(eq(schema.exerciseAttempts.userId, userId), eq(schema.exerciseAttempts.languageId, language)));
  const stats = new Map<string, ExerciseStat>();
  for (const r of rows) {
    const s = stats.get(r.exerciseId) ?? { lastAt: 0, best: 0, attempts: 0 };
    s.lastAt = Math.max(s.lastAt, r.at.getTime());
    s.best = Math.max(s.best, r.score);
    s.attempts++;
    stats.set(r.exerciseId, s);
  }
  return stats;
}

export async function createLessonSession(
  tx: Tx,
  learner: Learner,
  opts: { language: LanguageId; skills: Skill[]; minutes: number; kind: "scheduled" | "practice" | "makeup" | "review" | "remediation"; scheduledDate?: string | null; remediationFor?: string; unitId?: string },
) {
  const userId = learner.id;
  const progress = await getSkillProgress(tx, userId, opts.language);
  if (!progress.length) throw new HttpError(409, "needs_placement");
  const current = currentUnits(progress);
  const prev: Partial<Record<Skill, ReturnType<typeof previousUnits>>> = {};
  for (const s of ["listening", "speaking", "reading", "writing", "vocabulary"] as Skill[]) prev[s] = previousUnits(opts.language, current[s]);

  if (opts.unitId) {
    // Practice a specific unit: allowed for units up to the learner's current unit (no skipping ahead).
    const target = getUnit(opts.unitId);
    if (!target || target.language !== opts.language) throw new HttpError(404, "not_found");
    for (const s of opts.skills) {
      const cur = current[s];
      const seq = contentLevels(opts.language).flatMap((l) => unitsFor(opts.language, l));
      const curIdx = cur ? seq.findIndex((u) => u.id === cur.id) : seq.length;
      if (seq.findIndex((u) => u.id === target.id) > curIdx) throw new HttpError(403, "unit_locked");
      current[s] = target;
      prev[s] = previousUnits(opts.language, target);
    }
  }
  let skills = opts.skills;
  let remediationTags: string[] | undefined;
  if (opts.kind === "remediation") {
    const [res] = await tx.select().from(schema.assessmentResults).where(and(eq(schema.assessmentResults.id, opts.remediationFor!), eq(schema.assessmentResults.userId, userId)));
    if (!res || res.passed) throw new HttpError(404, "not_found");
    const plan = res.remediation as RemediationPlan | null;
    skills = [res.skill as Skill];
    remediationTags = plan?.focusTags?.length ? plan.focusTags : undefined;
    // Practise across the whole level of the failed exam.
    const levelUnits = unitsFor(opts.language, res.levelCode);
    current[res.skill as Skill] = levelUnits[levelUnits.length - 1];
    prev[res.skill as Skill] = levelUnits.slice(0, -1).reverse();
  }

  for (const s of skills) {
    const u = current[s];
    if (u) await addUnitVocabulary(tx, userId, u);
  }
  const [stats, focusTags, due] = await Promise.all([
    exerciseStats(tx, userId, opts.language),
    focusTagsFor(tx, userId, opts.language),
    skills.includes("vocabulary") ? dueVocabulary(tx, userId, opts.language, learner.profile.reviewMaxPerDay) : Promise.resolve([]),
  ]);
  const rng = seededRng(`${userId}:${Date.now()}`);
  const plan = buildSessionPlan({
    language: opts.language,
    skills,
    minutes: opts.minutes,
    currentUnit: current,
    previousUnits: prev,
    stats,
    focusTags,
    dueVocabIds: due.map((d) => d.id),
    rng,
    now: Date.now(),
    remediationTags,
  });
  const [row] = await tx
    .insert(schema.studySessions)
    .values({
      userId,
      languageId: opts.language,
      kind: opts.kind,
      scheduledDate: opts.scheduledDate ?? null,
      skills,
      durationMinutes: opts.minutes,
      plan,
      state: { pos: { a: 0, i: 0 }, answered: {}, retryQueue: [], drafts: {} } satisfies SessionState,
      status: "planned",
      unitId: current[skills[0]!]?.id ?? null,
      remediationFor: opts.remediationFor ?? null,
    })
    .returning();
  return row!;
}

export async function createUnitAssessment(tx: Tx, learner: Learner, unitId: string, skill: Skill) {
  const unit = getUnit(unitId);
  if (!unit) throw new HttpError(404, "not_found");
  const [up] = await tx.select().from(schema.unitProgress).where(and(eq(schema.unitProgress.userId, learner.id), eq(schema.unitProgress.unitId, unitId), eq(schema.unitProgress.skill, skill)));
  if (!up || (up.status !== "ready" && up.status !== "completed")) throw new HttpError(409, "unit_not_ready");
  const stats = await exerciseStats(tx, learner.id, unit.language);
  const assessmentItems = unit.assessment.filter((e) => e.skill === skill);
  // Two practice items the learner found hardest (lowest best score) complete the test.
  const practice = unit.exercises
    .filter((e) => e.skill === skill && e.type !== "open_writing" && e.type !== "speaking_response")
    .sort((a, b) => (stats.get(a.id)?.best ?? 0) - (stats.get(b.id)?.best ?? 0))
    .slice(0, 2);
  const plan: SessionPlan = {
    version: 1,
    activities: [{ id: "a1", type: "unit_assessment", skill, minutes: 10, items: [...assessmentItems, ...practice].map((e) => ({ kind: "exercise" as const, exerciseId: e.id, reason: "assessment" as const })) }],
  };
  const [row] = await tx
    .insert(schema.studySessions)
    .values({ userId: learner.id, languageId: unit.language, kind: "unit_assessment", skills: [skill], durationMinutes: 10, plan, state: { pos: { a: 0, i: 0 }, answered: {} }, unitId: unit.id })
    .returning();
  return row!;
}

/** Whether the level exam for a skill is available, and why not. */
export async function levelExamEligibility(tx: Tx, userId: string, language: LanguageId, skill: Skill) {
  const progress = (await getSkillProgress(tx, userId, language)).find((p) => p.skill === skill);
  if (!progress) return { eligible: false, reason: "needs_placement" as const, level: null };
  const level = progress.levelCode;
  const units = unitsFor(language, level);
  if (!units.length || !getExam(language, level, skill)) return { eligible: false, reason: "no_content" as const, level };
  const done = await tx
    .select()
    .from(schema.unitProgress)
    .where(and(eq(schema.unitProgress.userId, userId), eq(schema.unitProgress.skill, skill), inArray(schema.unitProgress.unitId, units.map((u) => u.id))));
  const completed = done.filter((d) => d.status === "completed").length;
  if (completed < units.length) return { eligible: false, reason: "units_incomplete" as const, level, completed, total: units.length };
  const [last] = await tx
    .select()
    .from(schema.assessmentResults)
    .where(and(eq(schema.assessmentResults.userId, userId), eq(schema.assessmentResults.languageId, language), eq(schema.assessmentResults.skill, skill), eq(schema.assessmentResults.kind, "level_exam"), eq(schema.assessmentResults.levelCode, level)))
    .orderBy(desc(schema.assessmentResults.createdAt))
    .limit(1);
  if (last && !last.passed && !last.remediationDone) return { eligible: false, reason: "remediation_pending" as const, level, resultId: last.id };
  return { eligible: true as const, reason: null, level };
}

export async function createLevelExam(tx: Tx, learner: Learner, language: LanguageId, skill: Skill) {
  const elig = await levelExamEligibility(tx, learner.id, language, skill);
  if (!elig.eligible) throw new HttpError(409, elig.reason ?? "not_eligible");
  const exam = getExam(language, elig.level!, skill)!;
  const seenRows = await tx
    .select({ exerciseId: schema.exerciseAttempts.exerciseId, at: schema.exerciseAttempts.createdAt })
    .from(schema.exerciseAttempts)
    .where(and(eq(schema.exerciseAttempts.userId, learner.id), inArray(schema.exerciseAttempts.exerciseId, exam.sections.flatMap((s) => s.pool.map((p) => p.id)))));
  const seen = new Map<string, number>();
  for (const r of seenRows) seen.set(r.exerciseId, Math.max(seen.get(r.exerciseId) ?? 0, r.at.getTime()));
  const rng = seededRng(`${learner.id}:${exam.id}:${Date.now()}`);
  const activities: PlanActivity[] = exam.sections.map((s, i) => ({
    id: `s${i + 1}`,
    type: "exam_section",
    skill,
    sectionId: s.id,
    minutes: 5,
    items: drawItems(s.pool, s.draw, seen, rng).map((e) => ({ kind: "exercise" as const, exerciseId: e.id, reason: "assessment" as const })),
  }));
  const [row] = await tx
    .insert(schema.studySessions)
    .values({ userId: learner.id, languageId: language, kind: "level_exam", skills: [skill], durationMinutes: 20, plan: { version: 1, activities }, state: { pos: { a: 0, i: 0 }, answered: {} }, levelExamId: exam.id })
    .returning();
  return row!;
}

/* ───────────────────────── Reading ───────────────────────── */

export async function getOwnSession(tx: Tx, userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "not_found");
  const [s] = await tx.select().from(schema.studySessions).where(and(eq(schema.studySessions.id, id), eq(schema.studySessions.userId, userId)));
  if (!s) throw new HttpError(404, "not_found");
  return s;
}

/** Corrections & retry are built from the exercises answered wrongly so far. */
export function effectiveActivities(s: SessionRow): PlanActivity[] {
  const plan = s.plan as SessionPlan;
  const st = (s.state ?? {}) as SessionState;
  return plan.activities.map((a) =>
    a.type === "corrections" ? { ...a, items: (st.retryQueue ?? []).map((id) => ({ kind: "exercise" as const, exerciseId: id, reason: "consolidation" as const })) } : a,
  );
}

export async function sessionView(tx: Tx, s: SessionRow) {
  const activities = effectiveActivities(s);
  const st = (s.state ?? {}) as SessionState;
  const exam = isExamKind(s.kind);
  const exerciseIds = new Set(activities.flatMap((a) => a.items.filter((i) => i.kind === "exercise").map((i) => (i as { exerciseId: string }).exerciseId)));
  const exercises: Record<string, ReturnType<typeof toClientExercise>> = {};
  const materials: Record<string, NonNullable<ReturnType<typeof toClientMaterial>>> = {};
  for (const id of exerciseIds) {
    const ix = getExercise(id) ?? (await generatedExercise(tx, s.userId, id));
    if (!ix) continue;
    exercises[id] = toClientExercise(ix.exercise);
    if (ix.exercise.source && !materials[ix.exercise.source]) {
      const m = toClientMaterial(ix.exercise.source);
      if (m) materials[m.id] = m;
    }
  }
  const vocabIds = activities.flatMap((a) => a.items.filter((i) => i.kind === "vocab").map((i) => (i as { vocabId: string }).vocabId));
  const vocab = vocabIds.length ? await tx.select().from(schema.vocabularyItems).where(and(eq(schema.vocabularyItems.userId, s.userId), inArray(schema.vocabularyItems.id, vocabIds))) : [];
  // Previously answered items (resume): results are only revealed outside exam mode.
  const results: Record<string, unknown> = {};
  if (!exam) {
    const answeredIds = Object.keys(st.answered ?? {});
    if (answeredIds.length) {
      const attempts = await tx.select().from(schema.exerciseAttempts).where(and(eq(schema.exerciseAttempts.sessionId, s.id), eq(schema.exerciseAttempts.userId, s.userId)));
      for (const a of [...attempts].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) {
        const ix = getExercise(a.exerciseId) ?? (await generatedExercise(tx, s.userId, a.exerciseId));
        if (!ix) continue;
        const key = a.isRetry ? `retry:${a.exerciseId}` : a.exerciseId;
        if (a.isRetry || !results[key]) results[key] = buildResult(ix.exercise, a.score, a.isCorrect, a.feedback as ResultFeedback | null);
      }
    }
  }
  const exam_ = s.levelExamId ? EXAMS.find((x) => x.id === s.levelExamId) : null;
  const sectionTitles = exam_ ? Object.fromEntries(exam_.sections.map((x) => [x.id, { th: x.titleTh, en: x.titleEn }])) : {};
  const unit = s.unitId ? getUnit(s.unitId) : null;
  return {
    sectionTitles,
    unitTitle: unit ? { th: unit.titleTh, en: unit.title, level: unit.level } : null,
    session: {
      id: s.id,
      kind: s.kind,
      languageId: s.languageId,
      skills: s.skills,
      status: s.status,
      durationMinutes: s.durationMinutes,
      activeSeconds: s.activeSeconds,
      summary: s.summary,
      exam,
      unitId: s.unitId,
      levelExamId: s.levelExamId,
    },
    activities,
    state: { pos: st.pos ?? { a: 0, i: 0 }, answered: Object.fromEntries(Object.entries(st.answered ?? {}).map(([k, v]) => [k, exam ? { done: true } : { done: true, correct: v.correct, score: v.score }])), drafts: st.drafts ?? {}, vocabDone: st.vocabDone ?? {} },
    exercises,
    materials,
    vocab: vocab.map((v) => ({ id: v.id, word: v.word, pronunciation: v.pronunciation, meaningTh: v.meaningTh, meaningEn: v.meaningEn, example: v.example, exampleTranslation: v.exampleTranslation })),
    results,
  };
}

async function generatedExercise(tx: Tx, userId: string, id: string) {
  const [row] = await tx.select().from(schema.exercises).where(and(eq(schema.exercises.id, id), eq(schema.exercises.ownerId, userId)));
  if (!row) return null;
  return { exercise: row.content as Exercise, language: row.languageId as LanguageId, level: row.levelCode, unitId: row.unitId, purpose: "practice" as const };
}

/* ───────────────────────── Answering ───────────────────────── */

interface ResultFeedback {
  expected?: string;
  diff?: unknown;
  evaluation?: OpenEvaluation;
}

function buildResult(e: Exercise, score: number, correct: boolean, fb: ResultFeedback | null) {
  return {
    score,
    correct,
    expected: fb?.expected ?? null,
    diff: fb?.diff ?? null,
    evaluation: fb?.evaluation ?? null,
    explanationTh: e.explanationTh,
    explanationEn: e.explanationEn ?? null,
    transcript: e.skill === "listening" ? transcriptOf(e.source) : null,
    audioText: e.type === "listen_type" ? e.audio : null,
    modelAnswer: modelAnswerOf(e),
  };
}

export async function submitAnswer(
  tx: Tx,
  learner: Learner,
  sessionId: string,
  input: { exerciseId: string; response: AnswerResponse; durationMs?: number; retry?: boolean; signal?: AbortSignal },
) {
  const s = await getOwnSession(tx, learner.id, sessionId);
  if (s.status === "completed") throw new HttpError(409, "session_completed");
  const inPlan = effectiveActivities(s).some((a) => a.items.some((i) => i.kind === "exercise" && i.exerciseId === input.exerciseId));
  if (!inPlan) throw new HttpError(400, "not_in_session");
  const ix = getExercise(input.exerciseId) ?? (await generatedExercise(tx, learner.id, input.exerciseId));
  if (!ix) throw new HttpError(404, "not_found");
  const ex = ix.exercise;
  const language = s.languageId as LanguageId;
  const st = (s.state ?? {}) as SessionState;
  const exam = isExamKind(s.kind);
  const isRetry = !!input.retry || !!st.answered?.[ex.id];
  if (exam && st.answered?.[ex.id]) throw new HttpError(409, "already_answered");

  let score: number;
  let correct: boolean;
  let feedback: ResultFeedback;
  let evaluator: "deterministic" | "ai" | "demo_rules" = "deterministic";
  let provider: string | null = null;
  const mistakes: { original: string; corrected: string; explanation: string; tag: string }[] = [];

  const objective = scoreObjective(language, ex, input.response);
  if (objective) {
    score = objective.score;
    correct = objective.correct;
    feedback = { expected: objective.expected, diff: objective.diff };
    if (!correct) {
      const r = input.response;
      const joiner = language === "zh" ? "" : " ";
      const given =
        "text" in r ? r.text
        : "transcript" in r ? r.transcript
        : "choice" in r && ex.type === "mcq" ? (ex.options[r.choice] ?? "")
        : "bool" in r ? (r.bool ? "True" : "False")
        : "order" in r ? r.order.join(joiner)
        : "pairs" in r ? Object.entries(r.pairs).map(([l, v]) => `${l} → ${v}`).join(", ")
        : "";
      mistakes.push({ original: given || "—", corrected: objective.expected, explanation: ex.explanationTh, tag: ex.tags[0]! });
    }
  } else {
    const text = "text" in input.response ? input.response.text : "transcript" in input.response ? input.response.transcript : "";
    if (!text.trim()) throw new HttpError(400, "empty_answer");
    const prov = providerFor(learner.profile);
    if (prov) await assertAiAllowed(tx, learner.id);
    const usage = prov ? usageRecorder(tx, learner.id, "llm", prov) : null;
    const unit = ix.unitId ? getUnit(ix.unitId) : null;
    const evaluation = await evaluateOpen({
      language,
      level: ix.level,
      kind: ex.type === "open_writing" ? "writing" : "speaking",
      task: ex.prompt,
      requirements: ex.type === "open_writing" || ex.type === "speaking_response" ? ex.requirements : [],
      minLength: ex.type === "open_writing" || ex.type === "speaking_response" ? ex.minLength : 1,
      text,
      durationSec: input.durationMs ? input.durationMs / 1000 : undefined,
      targetWords: unit?.vocabulary.map((v) => v.word),
      explanationLanguage: explanationLang(learner.profile),
      provider: prov,
      signal: input.signal,
      onUsage: usage?.onUsage,
    });
    await usage?.flush();
    evaluator = evaluation.evaluator;
    provider = evaluation.provider ?? null;
    score = evaluation.score;
    correct = score >= 0.6;
    feedback = { evaluation };
    mistakes.push(...evaluation.mistakes);
  }

  const [attempt] = await tx
    .insert(schema.exerciseAttempts)
    .values({ userId: learner.id, sessionId: s.id, exerciseId: ex.id, languageId: language, skill: ex.skill, response: input.response, score, isCorrect: correct, feedback, evaluator, aiProvider: provider, isRetry })
    .returning();

  if (mistakes.length) {
    await tx.insert(schema.mistakeRecords).values(
      mistakes.slice(0, 8).map((m) => ({ userId: learner.id, languageId: language, skill: ex.skill, categoryId: m.tag, exerciseId: ex.id, attemptId: attempt!.id, original: m.original.slice(0, 500), corrected: m.corrected.slice(0, 500), explanation: m.explanation.slice(0, 600) })),
    );
  }
  await refreshWeaknesses(tx, learner.id, language, [...ex.tags, ...mistakes.map((m) => m.tag)]);
  if (ix.unitId && ix.purpose === "practice") await refreshUnitPractice(tx, learner.id, ix.unitId, ex.skill);

  // Session state: record the answer; wrong answers go to the corrections & retry queue.
  const answered = { ...(st.answered ?? {}) };
  const prev = answered[ex.id];
  answered[ex.id] = { score: Math.max(score, prev?.score ?? 0), correct: correct || !!prev?.correct, attemptId: attempt!.id, retried: isRetry || undefined };
  const retryQueue = [...(st.retryQueue ?? [])];
  if (!exam && !correct && !retryQueue.includes(ex.id) && !isRetry) retryQueue.push(ex.id);
  await tx
    .update(schema.studySessions)
    .set({ state: { ...st, answered, retryQueue }, status: "in_progress", startedAt: s.startedAt ?? new Date() })
    .where(eq(schema.studySessions.id, s.id));

  if (exam) return { saved: true as const };
  return { saved: true as const, result: buildResult(ex, score, correct, feedback) };
}

export async function saveSessionState(tx: Tx, userId: string, sessionId: string, patch: { pos?: { a: number; i: number }; draft?: { exerciseId: string; text: string }; paused?: boolean; vocabDone?: string }) {
  const s = await getOwnSession(tx, userId, sessionId);
  const st = (s.state ?? {}) as SessionState;
  const next: SessionState = { ...st };
  if (patch.pos) next.pos = patch.pos;
  if (patch.draft) next.drafts = { ...(st.drafts ?? {}), [patch.draft.exerciseId]: patch.draft.text.slice(0, 5000) };
  if (patch.paused !== undefined) next.paused = patch.paused;
  if (patch.vocabDone) next.vocabDone = { ...(st.vocabDone ?? {}), [patch.vocabDone]: true };
  await tx.update(schema.studySessions).set({ state: next, status: s.status === "planned" ? "in_progress" : s.status, startedAt: s.startedAt ?? new Date() }).where(eq(schema.studySessions.id, s.id));
}

/** Active study time (sent while the session screen is open and not paused). */
export async function addActiveTime(tx: Tx, userId: string, sessionId: string, seconds: number, timeZone: string) {
  const s = await getOwnSession(tx, userId, sessionId);
  const secs = Math.max(0, Math.min(60, Math.round(seconds)));
  await tx.update(schema.studySessions).set({ activeSeconds: s.activeSeconds + secs }).where(eq(schema.studySessions.id, s.id));
  const { date } = localDay(new Date(), timeZone);
  await tx
    .insert(schema.studyLog)
    .values({ userId, logDate: date, languageId: s.languageId, seconds: secs })
    .onConflictDoUpdate({ target: [schema.studyLog.userId, schema.studyLog.logDate, schema.studyLog.languageId], set: { seconds: sql`${schema.studyLog.seconds} + ${secs}` } });
}

/* ───────────────────────── Completion ───────────────────────── */

export async function completeSession(tx: Tx, learner: Learner, sessionId: string) {
  const s = await getOwnSession(tx, learner.id, sessionId);
  if (s.status === "completed") return { summary: s.summary };
  const st = (s.state ?? {}) as SessionState;
  const activities = effectiveActivities(s);
  const ids = planExerciseIds({ version: 1, activities });
  const attempts = await tx.select().from(schema.exerciseAttempts).where(and(eq(schema.exerciseAttempts.sessionId, s.id), eq(schema.exerciseAttempts.userId, learner.id)));
  const firstTry = new Map<string, (typeof attempts)[number]>();
  for (const a of [...attempts].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) if (!firstTry.has(a.exerciseId)) firstTry.set(a.exerciseId, a);
  const bySkill: Record<string, { n: number; sum: number }> = {};
  for (const a of firstTry.values()) {
    bySkill[a.skill] ??= { n: 0, sum: 0 };
    bySkill[a.skill]!.n++;
    bySkill[a.skill]!.sum += a.score;
  }
  const answered = firstTry.size;
  const accuracy = answered ? [...firstTry.values()].reduce((x, a) => x + a.score, 0) / answered : 0;
  const retries = attempts.filter((a) => a.isRetry);
  const summary: Record<string, unknown> = {
    planned: new Set(ids).size,
    answered,
    accuracy,
    bySkill: Object.fromEntries(Object.entries(bySkill).map(([k, v]) => [k, v.sum / v.n])),
    retries: retries.length,
    retriesFixed: retries.filter((r) => r.isCorrect).length,
    mistakes: attempts.filter((a) => !a.isCorrect).length,
    vocabReviewed: Object.keys(st.vocabDone ?? {}).length,
    minutes: Math.round(s.activeSeconds / 60),
    seconds: s.activeSeconds,
  };
  // What to take away: the lesson's words and the mistakes worth remembering (exams excluded — no answers shown).
  if (!isExamKind(s.kind)) {
    const lessonUnit = s.unitId ? getUnit(s.unitId) : null;
    summary.words = (lessonUnit?.vocabulary ?? []).slice(0, 8).map((v) => ({ word: v.word, pronunciation: v.pronunciation ?? null, meaning: v.meaningTh }));
    const attemptIds = attempts.filter((a) => !a.isCorrect).map((a) => a.id);
    const mistakes = attemptIds.length
      ? await tx.select().from(schema.mistakeRecords).where(and(eq(schema.mistakeRecords.userId, learner.id), inArray(schema.mistakeRecords.attemptId, attemptIds))).limit(20)
      : [];
    const seen = new Set<string>();
    summary.mistakesList = mistakes
      .filter((m) => m.original !== "—" && !seen.has(m.corrected) && seen.add(m.corrected))
      .slice(0, 5)
      .map((m) => ({ original: clip(m.original), corrected: clip(m.corrected), explanation: m.explanation }));
  }

  const language = s.languageId as LanguageId;
  if (s.kind === "unit_assessment") {
    const scores = ids.map((id) => firstTry.get(id)?.score ?? 0);
    const g = gradeUnitAssessment(scores);
    const skill = s.skills[0] as Skill;
    const unit = getUnit(s.unitId!)!;
    const [res] = await tx
      .insert(schema.assessmentResults)
      .values({ userId: learner.id, languageId: language, skill, kind: "unit", unitId: unit.id, levelCode: unit.level, sessionId: s.id, score: g.score, sectionScores: { items: scores }, passed: g.passed, criteria: { passMark: 0.7, score: g.score } })
      .returning();
    let unlocked: unknown = null;
    if (g.passed) unlocked = await completeUnit(tx, learner.id, unit.id, skill, g.score);
    summary.assessment = { resultId: res!.id, score: g.score, passed: g.passed, unlocked, items: ids.map((id) => ({ id, score: firstTry.get(id)?.score ?? 0 })) };
  } else if (s.kind === "level_exam") {
    const exam = EXAMS.find((x) => x.id === s.levelExamId)!;
    const sectionResults: SectionResult[] = activities.map((a) => {
      const section = exam.sections.find((x) => x.id === a.sectionId)!;
      const items = a.items.map((i) => (i as { exerciseId: string }).exerciseId);
      const performance = section.pool.some((e) => e.type === "open_writing" || e.type === "speaking_response");
      const completed = items.every((id) => {
        const at = firstTry.get(id);
        const ev = (at?.feedback as ResultFeedback | null)?.evaluation;
        return !!at && (!ev || ev.meetsLength);
      });
      return {
        sectionId: section.id,
        required: section.required,
        performance,
        scores: items.map((id) => firstTry.get(id)?.score ?? 0),
        completed,
        tags: [...new Set(items.flatMap((id) => getExercise(id)?.exercise.tags ?? []))],
      };
    });
    const grade = gradeLevelExam(sectionResults);
    const plan = grade.passed ? null : remediationPlan(grade, sectionResults);
    const [res] = await tx
      .insert(schema.assessmentResults)
      .values({
        userId: learner.id,
        languageId: language,
        skill: exam.skill,
        kind: "level_exam",
        levelCode: exam.level,
        sessionId: s.id,
        score: grade.overall,
        sectionScores: grade.sections,
        passed: grade.passed,
        criteria: { overallPass: 0.8, sectionPass: 0.7, ...grade.criteria },
        remediation: plan,
      })
      .returning();
    let advanced: unknown = null;
    if (grade.passed) advanced = await advanceLevel(tx, learner.id, language, exam.skill, exam.level);
    summary.exam = { resultId: res!.id, ...grade, remediation: plan, advanced, sectionTitles: Object.fromEntries(exam.sections.map((x) => [x.id, { th: x.titleTh, en: x.titleEn }])) };
  } else if (s.kind === "remediation" && s.remediationFor) {
    const ok = accuracy >= 0.7;
    const [res] = await tx.select().from(schema.assessmentResults).where(and(eq(schema.assessmentResults.id, s.remediationFor), eq(schema.assessmentResults.userId, learner.id)));
    if (res && ok) {
      const done = await tx
        .select({ id: schema.studySessions.id, summary: schema.studySessions.summary })
        .from(schema.studySessions)
        .where(and(eq(schema.studySessions.userId, learner.id), eq(schema.studySessions.remediationFor, res.id), eq(schema.studySessions.status, "completed")));
      const passedBefore = done.filter((d) => ((d.summary as { accuracy?: number } | null)?.accuracy ?? 0) >= 0.7).length;
      const required = (res.remediation as RemediationPlan | null)?.requiredSessions ?? 1;
      if (passedBefore + 1 >= required) await tx.update(schema.assessmentResults).set({ remediationDone: true }).where(eq(schema.assessmentResults.id, res.id));
      summary.remediation = { counted: true, completed: passedBefore + 1, required };
    } else summary.remediation = { counted: false };
  }

  // Daily progress snapshot per skill (practice accuracy — not a proficiency score).
  const { date } = localDay(new Date(), learner.profile.timezone);
  const progress = await getSkillProgress(tx, learner.id, language);
  for (const [skill, v] of Object.entries(bySkill)) {
    const lvl = progress.find((p) => p.skill === skill)?.levelCode ?? "";
    const since = new Date(`${date}T00:00:00Z`).getTime() - 14 * 3600_000;
    const today = await tx
      .select({ score: schema.exerciseAttempts.score })
      .from(schema.exerciseAttempts)
      .where(and(eq(schema.exerciseAttempts.userId, learner.id), eq(schema.exerciseAttempts.languageId, language), eq(schema.exerciseAttempts.skill, skill), gte(schema.exerciseAttempts.createdAt, new Date(since))));
    const acc = today.length ? today.reduce((x, a) => x + a.score, 0) / today.length : v.sum / v.n;
    await tx
      .insert(schema.progressSnapshots)
      .values({ userId: learner.id, languageId: language, skill, snapshotDate: date, accuracy: acc, attempts: today.length || v.n, levelCode: lvl })
      .onConflictDoUpdate({
        target: [schema.progressSnapshots.userId, schema.progressSnapshots.languageId, schema.progressSnapshots.skill, schema.progressSnapshots.snapshotDate],
        set: { accuracy: acc, attempts: today.length || v.n, levelCode: lvl },
      });
  }

  // One concrete next step for the learner.
  if (!isExamKind(s.kind) && s.kind !== "remediation") {
    const readyRows = s.unitId
      ? await tx.select().from(schema.unitProgress).where(and(eq(schema.unitProgress.userId, learner.id), eq(schema.unitProgress.unitId, s.unitId), eq(schema.unitProgress.status, "ready")))
      : [];
    const ready = readyRows.find((r) => s.skills.includes(r.skill));
    const due = await dueVocabulary(tx, learner.id, language, 1);
    summary.next = ready ? { type: "unit_test", unitId: ready.unitId, skill: ready.skill } : due.length ? { type: "review" } : { type: "done" };
  }

  await tx.update(schema.studySessions).set({ status: "completed", completedAt: new Date(), summary }).where(eq(schema.studySessions.id, s.id));
  return { summary };
}
