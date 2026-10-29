import { z } from "zod";
import { asUser, schema } from "@/db";
import { readJson, route, HttpError } from "@/server/http";
import { generateExercises } from "@/ai/teacher";
import { providerFor } from "@/server/learner";
import { getSkillProgress, currentUnits } from "@/server/curriculum";
import { focusTagsFor } from "@/server/weakness";
import { assertAiAllowed, usageRecorder } from "@/server/ai-usage";
import type { SessionPlan } from "@/engine/planner";

const body = z.object({ language: z.enum(["en", "zh"]), skill: z.enum(["reading", "writing", "vocabulary"]) });

/**
 * AI-generated extra practice for the learner's current unit and weaknesses.
 * Every generated item is schema-validated and answer-checked before it is stored or shown.
 */
export const POST = route(async (req, learner) => {
  const b = await readJson(req, body);
  const provider = providerFor(learner.profile);
  if (!provider) throw new HttpError(409, "ai_required");
  const id = await asUser(learner.id, async (tx) => {
    await assertAiAllowed(tx, learner.id);
    const progress = await getSkillProgress(tx, learner.id, b.language);
    const unit = currentUnits(progress)[b.skill];
    if (!unit) throw new HttpError(409, "needs_placement");
    const focus = await focusTagsFor(tx, learner.id, b.language);
    const objective = unit.objectives.find((o) => o.skill === b.skill) ?? unit.objectives[0]!;
    const tags = focus.length ? focus : [...new Set(unit.exercises.filter((e) => e.skill === b.skill).flatMap((e) => e.tags))].slice(0, 3);
    const usage = usageRecorder(tx, learner.id, "llm", provider);
    const items = await generateExercises({ language: b.language, level: unit.level, skill: b.skill, objective: `${objective.textEn}`, tags, count: 6, idPrefix: `gen-${crypto.randomUUID().slice(0, 8)}`, provider, signal: req.signal, onUsage: usage.onUsage });
    await usage.flush();
    if (items.length < 2) throw new HttpError(502, "ai_unavailable");
    await tx.insert(schema.exercises).values(items.map((e) => ({ id: e.id, languageId: b.language, unitId: unit.id, levelCode: unit.level, skill: e.skill, type: e.type, objective: e.objective, purpose: "generated", tags: e.tags, content: e, ownerId: learner.id, validated: true })));
    const plan: SessionPlan = { version: 1, activities: [{ id: "a1", type: "skill", skill: b.skill, minutes: 10, items: items.map((e) => ({ kind: "exercise" as const, exerciseId: e.id, reason: "new" as const })) }, { id: "a2", type: "corrections", minutes: 3, items: [] }] };
    const [s] = await tx.insert(schema.studySessions).values({ userId: learner.id, languageId: b.language, kind: "practice", skills: [b.skill], durationMinutes: 15, plan, state: { pos: { a: 0, i: 0 }, answered: {}, retryQueue: [] }, unitId: unit.id }).returning();
    return s!.id;
  });
  return { id };
});
