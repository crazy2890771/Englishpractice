import { z } from "zod";
import { eq } from "drizzle-orm";
import { asUser, schema } from "@/db";
import { readJson, route } from "@/server/http";
import { DEFAULT_SCHEDULE, DURATIONS, type Slot } from "@/engine/schedule";
import { replaceSchedule } from "@/server/today";

const body = z.object({
  displayName: z.string().trim().min(1).max(60),
  uiLanguage: z.enum(["th", "en"]),
  explanationLanguage: z.enum(["th", "en"]),
  languages: z.array(z.enum(["en", "zh"])).min(1),
  goals: z.array(z.string().max(60)).max(8),
  topics: z.array(z.enum(["daily", "travel", "business", "aviation", "interviews", "news", "mixed"])).min(1),
  dailyMinutes: z.number().int().refine((n) => (DURATIONS as readonly number[]).includes(n)),
  correctionMode: z.enum(["immediate", "after_each", "end"]),
  showPinyin: z.boolean(),
  timezone: z.string().min(1).max(64),
});

/** Saves onboarding preferences and adapts the default schedule to the chosen languages. */
export const POST = route(async (req, learner) => {
  const b = await readJson(req, body);
  let tz = b.timezone;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    tz = "Asia/Bangkok";
  }
  const only = b.languages.length === 1 ? b.languages[0]! : null;
  const slots: Slot[] = only
    ? DEFAULT_SCHEDULE.filter((s) => !(s.weekday === 6 && s.languageId !== only)).map((s) => ({ ...s, languageId: only, position: 0 }))
    : DEFAULT_SCHEDULE;
  await asUser(learner.id, async (tx) => {
    await tx
      .update(schema.profiles)
      .set({ displayName: b.displayName, uiLanguage: b.uiLanguage, explanationLanguage: b.explanationLanguage, goals: b.goals, topics: b.topics, dailyMinutes: b.dailyMinutes, correctionMode: b.correctionMode, showPinyin: b.showPinyin, timezone: tz, onboarded: true, updatedAt: new Date() })
      .where(eq(schema.profiles.id, learner.id));
    for (const l of ["en", "zh"] as const) {
      await tx.insert(schema.userLanguages).values({ userId: learner.id, languageId: l, active: b.languages.includes(l) }).onConflictDoUpdate({ target: [schema.userLanguages.userId, schema.userLanguages.languageId], set: { active: b.languages.includes(l) } });
    }
    await replaceSchedule(tx, learner.id, slots);
  });
  return { ok: true, next: `/placement/${b.languages[0]}` };
});
