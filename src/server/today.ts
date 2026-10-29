import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import type { LanguageId, Skill } from "@/content/types";
import { getUnit } from "@/content";
import { addDays, localDay, missedLessons, slotsFor, slotKey, weeklyConsistency, type Slot } from "@/engine/schedule";
import { getSkillProgress } from "./curriculum";
import { countDue } from "./vocab";
import type { Learner } from "./learner";

export async function getSchedule(tx: Tx, userId: string): Promise<Slot[]> {
  const rows = await tx.select().from(schema.scheduleSlots).where(eq(schema.scheduleSlots.userId, userId));
  return rows.map((r) => ({ weekday: r.weekday, languageId: r.languageId as LanguageId, skills: r.skills as Skill[], position: r.position }));
}

export async function todayView(tx: Tx, learner: Learner, now = new Date()) {
  const tz = learner.profile.timezone;
  const day = localDay(now, tz);
  const schedule = await getSchedule(tx, learner.id);
  const slots = slotsFor(schedule, day.weekday);

  const recent = await tx
    .select()
    .from(schema.studySessions)
    .where(and(eq(schema.studySessions.userId, learner.id), gte(schema.studySessions.createdAt, new Date(now.getTime() - 15 * 86_400_000))))
    .orderBy(desc(schema.studySessions.createdAt));

  const languages = [...new Set(slots.map((s) => s.languageId))];
  const progressByLang: Record<string, Awaited<ReturnType<typeof getSkillProgress>>> = {};
  for (const l of ["en", "zh"] as LanguageId[]) progressByLang[l] = await getSkillProgress(tx, learner.id, l);

  const items = slots.map((slot) => {
    const key = slotKey(slot);
    const sessions = recent.filter((r) => (r.kind === "scheduled" || r.kind === "review") && r.scheduledDate === day.date && slotKey({ languageId: r.languageId as LanguageId, skills: r.skills as Skill[] }) === key);
    const done = sessions.find((s) => s.status === "completed");
    const open = sessions.find((s) => s.status !== "completed" && s.status !== "abandoned");
    const progress = progressByLang[slot.languageId] ?? [];
    const units = slot.skills.map((sk) => {
      const p = progress.find((x) => x.skill === sk);
      const u = p?.currentUnitId ? getUnit(p.currentUnitId) : null;
      return { skill: sk, level: p?.levelCode ?? null, unit: u ? { id: u.id, title: u.title, titleTh: u.titleTh } : null };
    });
    return { slot, units, needsPlacement: progress.length === 0, completedSessionId: done?.id ?? null, openSessionId: open?.id ?? null };
  });

  const missed = missedLessons(
    schedule,
    recent.map((r) => ({ kind: r.kind, status: r.status, scheduledDate: r.scheduledDate, languageId: r.languageId, skills: r.skills })),
    day.date,
    7,
  ).filter((m) => {
    // Only days after the learner started that language: never "missed" lessons from before sign-up/placement.
    const track = progressByLang[m.slot.languageId] ?? [];
    if (!track.length) return false;
    const started = localDay(new Date(Math.min(...track.map((p) => p.startedAt.getTime()))), tz).date;
    const joined = localDay(learner.profile.createdAt, tz).date;
    return m.date >= (started > joined ? started : joined);
  });

  const dueEn = await countDue(tx, learner.id, "en", now);
  const dueZh = await countDue(tx, learner.id, "zh", now);

  const logs = await tx.select().from(schema.studyLog).where(and(eq(schema.studyLog.userId, learner.id), gte(schema.studyLog.logDate, addDays(day.date, -60))));
  const activeDates = [...new Set(logs.filter((l) => l.seconds >= 60).map((l) => l.logDate))];
  const week = weeklyConsistency(activeDates, day.date, 1)[0]!;
  const todaySeconds = logs.filter((l) => l.logDate === day.date).reduce((a, l) => a + l.seconds, 0);
  // Streak: consecutive days with ≥ 1 minute of study, ending today (or yesterday if today isn't done yet).
  const active = new Set(activeDates);
  let streak = 0;
  for (let d = active.has(day.date) ? day.date : addDays(day.date, -1); active.has(d); d = addDays(d, -1)) streak++;
  // The most recent unfinished lesson, to resume in one tap.
  const unfinished = recent.find((r) => r.status === "in_progress" && r.kind !== "level_exam" && r.kind !== "unit_assessment");
  const weekStart = addDays(day.date, -day.weekday);
  const weekPlanned = schedule.length;
  const weekDone = recent.filter((r) => r.status === "completed" && r.scheduledDate && r.scheduledDate >= weekStart && (r.kind === "scheduled" || r.kind === "makeup" || r.kind === "review")).length;

  return {
    day,
    languages,
    items,
    missed: missed.slice(0, 6),
    due: { en: dueEn, zh: dueZh },
    week: { activeDays: week.days, planned: weekPlanned, done: Math.min(weekDone, weekPlanned), weekStart },
    goal: { minutes: learner.profile.dailyMinutes, doneMinutes: Math.floor(todaySeconds / 60), streak },
    resume: unfinished ? { id: unfinished.id, kind: unfinished.kind, languageId: unfinished.languageId, skills: unfinished.skills, answered: Object.keys(((unfinished.state ?? {}) as { answered?: object }).answered ?? {}).length } : null,
    schedule,
  };
}

export async function replaceSchedule(tx: Tx, userId: string, slots: Slot[]) {
  await tx.delete(schema.scheduleSlots).where(eq(schema.scheduleSlots.userId, userId));
  if (slots.length) await tx.insert(schema.scheduleSlots).values(slots.map((s) => ({ userId, weekday: s.weekday, languageId: s.languageId, skills: s.skills, position: s.position })));
}

export async function recentSessions(tx: Tx, userId: string, limit = 10) {
  return tx.select().from(schema.studySessions).where(eq(schema.studySessions.userId, userId)).orderBy(desc(schema.studySessions.createdAt)).limit(limit);
}

export async function sessionsByIds(tx: Tx, userId: string, ids: string[]) {
  if (!ids.length) return [];
  return tx.select().from(schema.studySessions).where(and(eq(schema.studySessions.userId, userId), inArray(schema.studySessions.id, ids)));
}
