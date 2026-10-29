import { z } from "zod";
import { asUser } from "@/db";
import { readJson, route, HttpError } from "@/server/http";
import { createLessonSession, createLevelExam, createUnitAssessment } from "@/server/sessions";
import { DURATIONS, localDay } from "@/engine/schedule";

const skill = z.enum(["listening", "speaking", "reading", "writing", "vocabulary"]);
const body = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(["scheduled", "practice", "makeup", "review"]),
    language: z.enum(["en", "zh"]),
    skills: z.array(skill).min(1).max(5),
    minutes: z.number().int().refine((n) => (DURATIONS as readonly number[]).includes(n)),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    unitId: z.string().max(40).optional(),
  }),
  z.object({ kind: z.literal("remediation"), language: z.enum(["en", "zh"]), resultId: z.string().uuid(), minutes: z.number().int().optional() }),
  z.object({ kind: z.literal("unit_assessment"), unitId: z.string().max(40), skill }),
  z.object({ kind: z.literal("level_exam"), language: z.enum(["en", "zh"]), skill }),
]);

/** Creates a lesson / practice / review / remediation session, a unit assessment or a level exam. */
export const POST = route(async (req, learner) => {
  const b = await readJson(req, body);
  const session = await asUser(learner.id, async (tx) => {
    if (b.kind === "unit_assessment") return createUnitAssessment(tx, learner, b.unitId, b.skill);
    if (b.kind === "level_exam") return createLevelExam(tx, learner, b.language, b.skill);
    if (b.kind === "remediation") return createLessonSession(tx, learner, { language: b.language, skills: ["listening"], minutes: b.minutes ?? 15, kind: "remediation", remediationFor: b.resultId });
    const today = localDay(new Date(), learner.profile.timezone).date;
    if (b.kind === "makeup" && (!b.scheduledDate || b.scheduledDate >= today)) throw new HttpError(400, "invalid_input");
    return createLessonSession(tx, learner, {
      language: b.language,
      skills: b.skills,
      minutes: b.minutes,
      kind: b.kind,
      scheduledDate: b.kind === "scheduled" || b.kind === "review" ? today : b.kind === "makeup" ? b.scheduledDate : null,
      unitId: b.kind === "practice" ? b.unitId : undefined,
    });
  });
  return { id: session.id };
});
