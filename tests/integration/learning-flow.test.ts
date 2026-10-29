import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { asUser, schema } from "@/db";
import { getExercise } from "@/content";
import type { Skill } from "@/content/types";
import type { Learner } from "@/server/learner";
import { nextPlacementItem, startFromBeginning, startPlacement } from "@/server/placement";
import { completeSession, createLessonSession, createLevelExam, createUnitAssessment, effectiveActivities, levelExamEligibility, sessionView, submitAnswer } from "@/server/sessions";
import { getSkillProgress } from "@/server/curriculum";
import { todayView } from "@/server/today";
import { dueVocabulary, reviewVocabulary } from "@/server/vocab";
import { answerFor, createUser, dbAvailable, deleteUser } from "./helpers";

const up = await dbAvailable();

/** Answers every exercise in a session (correctly unless `correct` is false), then completes it. */
async function runSession(learner: Learner, sessionId: string, correct = true) {
  const s = await asUser(learner.id, async (tx) => (await tx.select().from(schema.studySessions).where(eq(schema.studySessions.id, sessionId)))[0]!);
  const ids = effectiveActivities(s).flatMap((a) => a.items.filter((i) => i.kind === "exercise").map((i) => (i as { exerciseId: string }).exerciseId));
  for (const id of new Set(ids)) {
    const ex = getExercise(id)!.exercise;
    await asUser(learner.id, (tx) => submitAnswer(tx, learner, sessionId, { exerciseId: id, response: answerFor(ex, correct) }));
  }
  return asUser(learner.id, (tx) => completeSession(tx, learner, sessionId));
}

async function level(learner: Learner, language: "en" | "zh", skill: Skill) {
  return asUser(learner.id, async (tx) => (await getSkillProgress(tx, learner.id, language)).find((p) => p.skill === skill)!);
}

/** Practises the current unit until its test unlocks, then passes the test. */
async function passCurrentUnit(learner: Learner, skill: Skill) {
  const p = await level(learner, "en", skill);
  const unitId = p.currentUnitId!;
  for (let i = 0; i < 6; i++) {
    const [u] = await asUser(learner.id, (tx) => tx.select().from(schema.unitProgress).where(and(eq(schema.unitProgress.userId, learner.id), eq(schema.unitProgress.unitId, unitId), eq(schema.unitProgress.skill, skill))));
    if (u?.status === "ready") break;
    const s = await asUser(learner.id, (tx) => createLessonSession(tx, learner, { language: "en", skills: [skill], minutes: 30, kind: "practice", unitId }));
    await runSession(learner, s.id);
  }
  const test = await asUser(learner.id, (tx) => createUnitAssessment(tx, learner, unitId, skill));
  const { summary } = await runSession(learner, test.id);
  return { unitId, summary: summary as { assessment: { passed: boolean } } };
}

describe.skipIf(!up)("learning flow (server services against the real database)", () => {
  let learner: Learner;
  let other: Learner;

  beforeAll(async () => {
    learner = await createUser();
    other = await createUser();
  });
  afterAll(async () => {
    if (learner) await deleteUser(learner.id);
    if (other) await deleteUser(other.id);
  });

  it("refuses lessons before placement", async () => {
    await expect(asUser(learner.id, (tx) => createLessonSession(tx, learner, { language: "en", skills: ["reading"], minutes: 30, kind: "practice" }))).rejects.toMatchObject({ code: "needs_placement" });
  });

  it("a brand-new learner has no 'missed' lessons from before they joined, and sees goal + streak", async () => {
    await asUser(learner.id, (tx) => startFromBeginning(tx, learner.id, "en"));
    const view = await asUser(learner.id, (tx) => todayView(tx, learner));
    expect(view.missed).toEqual([]);
    expect(view.goal).toMatchObject({ minutes: 30, doneMinutes: 0, streak: 0 });
    expect(view.resume).toBeNull();
  });

  it("the self-report picks the first placement question's level", async () => {
    const a = await asUser(other.id, (tx) => startPlacement(tx, other.id, "en", "none"));
    const item = await asUser(other.id, (tx) => nextPlacementItem(tx, other.id, a.id, "reading"));
    expect((item as { exercise: { level?: string } }).exercise).toBeTruthy();
    const rows = await asUser(other.id, (tx) => tx.select().from(schema.placementSkillResults).where(eq(schema.placementSkillResults.assessmentId, a.id)));
    expect((rows.find((r) => r.skill === "reading")!.state as { levelIdx: number }).levelIdx).toBe(0);
    expect((rows.find((r) => r.skill === "writing")!.state as { levelIdx: number }).levelIdx).toBe(0);
    // Clean up so the later "start from the beginning" path isn't affected.
    await asUser(other.id, (tx) => tx.delete(schema.placementAssessments).where(eq(schema.placementAssessments.id, a.id)));
  });

  it("stores English and Chinese levels separately", async () => {
    await asUser(learner.id, (tx) => startFromBeginning(tx, learner.id, "en"));
    await asUser(learner.id, (tx) => startFromBeginning(tx, learner.id, "zh"));
    expect((await level(learner, "en", "reading")).levelCode).toBe("A1");
    expect((await level(learner, "zh", "reading")).levelCode).toBe("HSK1");
  });

  it("today's lesson follows the schedule in the learner's time zone", async () => {
    // 2026-03-02 18:00 UTC = Tuesday 01:00 in Bangkok → Chinese listening + speaking.
    const view = await asUser(learner.id, (tx) => todayView(tx, learner, new Date("2026-03-02T18:00:00Z")));
    expect(view.day.weekday).toBe(2);
    expect(view.items.map((i) => `${i.slot.languageId}:${i.slot.skills.join("+")}`)).toEqual(["zh:listening+speaking"]);
  });

  it("runs a full scheduled lesson: plan → answers → corrections → summary", async () => {
    const s = await asUser(learner.id, (tx) => createLessonSession(tx, learner, { language: "en", skills: ["reading", "writing"], minutes: 30, kind: "scheduled", scheduledDate: "2026-03-02" }));
    const view = await asUser(learner.id, (tx) => sessionView(tx, s));
    const types = view.activities.map((a) => a.type);
    expect(types[0]).toBe("warmup");
    expect(types).toEqual(expect.arrayContaining(["skill", "corrections", "mini_assessment"]));
    // Client DTOs never contain answers.
    for (const e of Object.values(view.exercises)) expect(JSON.stringify(e)).not.toMatch(/"answers?"\s*:/);

    // Answer the first objective item wrongly → it appears in "corrections & retry".
    const ids = effectiveActivities(s).flatMap((a) => a.items.map((i) => (i as { exerciseId: string }).exerciseId));
    const firstObjective = ids.find((id) => !["open_writing", "speaking_response"].includes(getExercise(id)!.exercise.type))!;
    const r = await asUser(learner.id, (tx) => submitAnswer(tx, learner, s.id, { exerciseId: firstObjective, response: answerFor(getExercise(firstObjective)!.exercise, false) }));
    expect(r.result?.correct).toBe(false);
    const after = await asUser(learner.id, async (tx) => (await tx.select().from(schema.studySessions).where(eq(schema.studySessions.id, s.id)))[0]!);
    expect(effectiveActivities(after).find((a) => a.type === "corrections")!.items.map((i) => (i as { exerciseId: string }).exerciseId)).toContain(firstObjective);

    const { summary } = await runSession(learner, s.id);
    const sum = summary as { answered: number; accuracy: number; retries: number; words: unknown[]; mistakesList: unknown[]; next: { type: string } };
    expect(sum.answered).toBeGreaterThan(3);
    expect(sum.words.length).toBeGreaterThan(0);
    expect(sum.mistakesList.length).toBeGreaterThanOrEqual(1);
    expect(["unit_test", "review", "done"]).toContain(sum.next.type);
    expect(sum.retries).toBeGreaterThanOrEqual(1);
    // The scheduled lesson is now done: it is not offered as a make-up.
    const view2 = await asUser(learner.id, (tx) => todayView(tx, learner, new Date("2026-03-03T03:00:00Z")));
    expect(view2.missed.some((m) => m.date === "2026-03-02" && m.slot.languageId === "en")).toBe(false);
  });

  it("open writing is evaluated by the labelled demo evaluator when no AI key is configured", async () => {
    const att = await asUser(learner.id, (tx) => tx.select().from(schema.exerciseAttempts).where(and(eq(schema.exerciseAttempts.userId, learner.id), eq(schema.exerciseAttempts.skill, "writing"))));
    const open = att.filter((a) => a.evaluator !== "deterministic");
    expect(open.length).toBeGreaterThan(0);
    for (const a of open) {
      expect(a.evaluator).toBe("demo_rules");
      expect((a.feedback as { evaluation: { pronunciation: null } }).evaluation.pronunciation).toBeNull();
    }
  });

  it("adds unit vocabulary and reviews it with spaced repetition", async () => {
    const due = await asUser(learner.id, (tx) => dueVocabulary(tx, learner.id, "en", 10));
    expect(due.length).toBeGreaterThan(0);
    const r = await asUser(learner.id, (tx) => reviewVocabulary(tx, learner.id, due[0]!.id, 4, "flashcard"));
    expect(r).toBeTruthy();
    const [item] = await asUser(learner.id, (tx) => tx.select().from(schema.vocabularyItems).where(eq(schema.vocabularyItems.id, due[0]!.id)));
    expect(item!.repetitions).toBe(1);
    expect(item!.dueAt.getTime()).toBeGreaterThan(Date.now() + 20 * 3600_000);
  });

  it("locks units ahead of the learner's current unit", async () => {
    const p = await level(learner, "en", "reading");
    expect(p.currentUnitId).toBeTruthy();
    await expect(asUser(learner.id, (tx) => createLessonSession(tx, learner, { language: "en", skills: ["reading"], minutes: 15, kind: "practice", unitId: "en-b2-u1" }))).rejects.toMatchObject({ code: "unit_locked" });
  });

  it("requires practice before a unit test, then advances to the next unit on a pass", async () => {
    const p = await level(other, "en", "reading").catch(() => null);
    expect(p).toBeFalsy();
    await asUser(other.id, (tx) => startFromBeginning(tx, other.id, "en"));
    const start = await level(other, "en", "reading");
    await expect(asUser(other.id, (tx) => createUnitAssessment(tx, other, start.currentUnitId!, "reading"))).rejects.toMatchObject({ code: "unit_not_ready" });
    const { unitId, summary } = await passCurrentUnit(other, "reading");
    expect(summary.assessment.passed).toBe(true);
    expect((await level(other, "en", "reading")).currentUnitId).not.toBe(unitId);
  });

  it("level exam: blocked until units are done; a fail requires remediation; a pass advances the level", async () => {
    expect((await asUser(other.id, (tx) => levelExamEligibility(tx, other.id, "en", "reading"))).reason).toBe("units_incomplete");
    // Finish the remaining A1 reading unit(s).
    for (let i = 0; i < 4; i++) {
      const e = await asUser(other.id, (tx) => levelExamEligibility(tx, other.id, "en", "reading"));
      if (e.reason !== "units_incomplete") break;
      await passCurrentUnit(other, "reading");
    }
    expect((await asUser(other.id, (tx) => levelExamEligibility(tx, other.id, "en", "reading"))).eligible).toBe(true);

    // Fail the exam deliberately.
    const exam1 = await asUser(other.id, (tx) => createLevelExam(tx, other, "en", "reading"));
    const failed = (await runSession(other, exam1.id, false)).summary as { exam: { passed: boolean; resultId: string; remediation: { requiredSessions: number } } };
    expect(failed.exam.passed).toBe(false);
    expect((await level(other, "en", "reading")).levelCode).toBe("A1");
    const elig = await asUser(other.id, (tx) => levelExamEligibility(tx, other.id, "en", "reading"));
    expect(elig.reason).toBe("remediation_pending");

    // Remediation sessions (≥ 70 %) unlock the retake.
    for (let i = 0; i < failed.exam.remediation.requiredSessions; i++) {
      const rem = await asUser(other.id, (tx) => createLessonSession(tx, other, { language: "en", skills: ["reading"], minutes: 20, kind: "remediation", remediationFor: failed.exam.resultId }));
      await runSession(other, rem.id);
    }
    expect((await asUser(other.id, (tx) => levelExamEligibility(tx, other.id, "en", "reading"))).eligible).toBe(true);

    const exam2 = await asUser(other.id, (tx) => createLevelExam(tx, other, "en", "reading"));
    const passed = (await runSession(other, exam2.id)).summary as { exam: { passed: boolean } };
    expect(passed.exam.passed).toBe(true);
    expect((await level(other, "en", "reading")).levelCode).toBe("A2");
    // Other skills and the other language are untouched.
    expect((await level(other, "en", "listening")).levelCode).toBe("A1");
  });

  it("a learner cannot open or answer another learner's session", async () => {
    const s = await asUser(learner.id, (tx) => createLessonSession(tx, learner, { language: "en", skills: ["reading"], minutes: 10, kind: "practice" }));
    const exId = effectiveActivities(s).flatMap((a) => a.items).find((i) => i.kind === "exercise") as { exerciseId: string };
    await expect(asUser(other.id, (tx) => submitAnswer(tx, other, s.id, { exerciseId: exId.exerciseId, response: { choice: 0 } }))).rejects.toMatchObject({ code: "not_found" });
  });
});
