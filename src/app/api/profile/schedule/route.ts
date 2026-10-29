import { z } from "zod";
import { asUser } from "@/db";
import { readJson, route } from "@/server/http";
import { replaceSchedule } from "@/server/today";

const SKILLS = ["listening", "speaking", "reading", "writing", "vocabulary"] as const;

const body = z.object({
  slots: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), languageId: z.enum(["en", "zh"]), skills: z.array(z.enum(SKILLS)).min(1).max(5) }))
    .max(14)
    .refine((s) => new Set(s.map((x) => `${x.weekday}:${x.languageId}`)).size === s.length, "duplicate weekday/language"),
});

/** Replaces the weekly schedule. */
export const PUT = route(async (req, learner) => {
  const { slots } = await readJson(req, body);
  const positioned = slots.map((s) => ({ ...s, skills: [...new Set(s.skills)], position: slots.filter((o) => o.weekday === s.weekday).indexOf(s) }));
  await asUser(learner.id, (tx) => replaceSchedule(tx, learner.id, positioned));
  return { ok: true };
});
