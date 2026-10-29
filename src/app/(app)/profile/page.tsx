import { and, count, desc, eq } from "drizzle-orm";
import { asUser, schema } from "@/db";
import { getLearner } from "@/server/learner";
import { getSchedule } from "@/server/today";
import { availableProviders, serverSpeechAvailable } from "@/ai/providers";
import { supabaseServer } from "@/lib/supabase/server";
import { ProfileClient } from "./client";

export const metadata = { title: "โปรไฟล์" };

export default async function ProfilePage() {
  const learner = await getLearner();
  const { data } = await (await supabaseServer()).auth.getUser();
  const isGuest = !!data.user?.is_anonymous;
  const p = learner.profile;
  const { languages, schedule, placements, recordingCount } = await asUser(learner.id, async (tx) => {
    const langs = await tx.select().from(schema.userLanguages).where(eq(schema.userLanguages.userId, learner.id));
    const placementRows = await tx
      .select()
      .from(schema.placementAssessments)
      .where(and(eq(schema.placementAssessments.userId, learner.id), eq(schema.placementAssessments.status, "completed")))
      .orderBy(desc(schema.placementAssessments.completedAt))
      .limit(10);
    const results = placementRows.length ? await tx.select().from(schema.placementSkillResults).where(eq(schema.placementSkillResults.userId, learner.id)) : [];
    const [rc] = await tx.select({ n: count() }).from(schema.recordings).where(eq(schema.recordings.userId, learner.id));
    return {
      languages: langs.filter((l) => l.active).map((l) => l.languageId),
      schedule: await getSchedule(tx, learner.id),
      placements: placementRows.map((a) => ({
        id: a.id,
        language: a.languageId,
        completedAt: a.completedAt?.toISOString() ?? null,
        skills: results.filter((r) => r.assessmentId === a.id).map((r) => ({ skill: r.skill, level: r.estimatedLevel, confidence: r.confidence })),
      })),
      recordingCount: rc?.n ?? 0,
    };
  });

  return (
    <ProfileClient
      email={learner.email}
      isGuest={isGuest}
      prefs={{
        displayName: p.displayName,
        uiLanguage: p.uiLanguage as "th" | "en",
        explanationLanguage: p.explanationLanguage as "th" | "en",
        timezone: p.timezone,
        dailyMinutes: p.dailyMinutes,
        correctionMode: p.correctionMode as "immediate" | "after_each" | "end",
        showPinyin: p.showPinyin,
        playbackSpeed: p.playbackSpeed,
        reviewNewPerDay: p.reviewNewPerDay,
        reviewMaxPerDay: p.reviewMaxPerDay,
        reminderEnabled: p.reminderEnabled,
        reminderTime: p.reminderTime,
        topics: p.topics,
        goals: p.goals,
        aiProvider: p.aiProvider as "auto" | "anthropic" | "openai" | "none",
        saveRecordings: p.saveRecordings,
        recordingRetentionDays: p.recordingRetentionDays,
        languages: languages as ("en" | "zh")[],
      }}
      schedule={schedule.map((s) => ({ weekday: s.weekday, languageId: s.languageId, skills: s.skills }))}
      providers={availableProviders()}
      serverSpeech={serverSpeechAvailable()}
      placements={placements}
      recordingCount={recordingCount}
    />
  );
}
