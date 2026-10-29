import { z } from "zod";
import { eq } from "drizzle-orm";
import { asUser, schema } from "@/db";
import { readJson, route } from "@/server/http";
import { DURATIONS } from "@/engine/schedule";

const TOPICS = ["daily", "travel", "business", "aviation", "interviews", "news", "mixed"] as const;

const body = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    uiLanguage: z.enum(["th", "en"]),
    explanationLanguage: z.enum(["th", "en"]),
    timezone: z.string().min(1).max(64),
    dailyMinutes: z.number().int().refine((n) => (DURATIONS as readonly number[]).includes(n)),
    correctionMode: z.enum(["immediate", "after_each", "end"]),
    showPinyin: z.boolean(),
    playbackSpeed: z.number().min(0.5).max(1.5),
    reviewNewPerDay: z.number().int().min(0).max(50),
    reviewMaxPerDay: z.number().int().min(5).max(300),
    reminderEnabled: z.boolean(),
    reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    topics: z.array(z.enum(TOPICS)).min(1),
    goals: z.array(z.string().max(60)).max(8),
    aiProvider: z.enum(["auto", "anthropic", "openai", "none"]),
    saveRecordings: z.boolean(),
    recordingRetentionDays: z.number().int().min(7).max(365),
    languages: z.array(z.enum(["en", "zh"])).min(1),
  })
  .partial();

/** Updates learner preferences (any subset). */
export const PATCH = route(async (req, learner) => {
  const { languages, timezone, ...b } = await readJson(req, body);
  let tz = timezone;
  if (tz) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
    } catch {
      tz = undefined;
    }
  }
  await asUser(learner.id, async (tx) => {
    await tx
      .update(schema.profiles)
      .set({ ...b, ...(tz ? { timezone: tz } : {}), updatedAt: new Date() })
      .where(eq(schema.profiles.id, learner.id));
    if (languages) {
      for (const l of ["en", "zh"] as const) {
        await tx
          .insert(schema.userLanguages)
          .values({ userId: learner.id, languageId: l, active: languages.includes(l) })
          .onConflictDoUpdate({ target: [schema.userLanguages.userId, schema.userLanguages.languageId], set: { active: languages.includes(l) } });
      }
    }
  });
  return { ok: true };
});
