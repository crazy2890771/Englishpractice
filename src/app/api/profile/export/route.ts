import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { asUser, schema } from "@/db";
import { route } from "@/server/http";

/** Downloads all of the learner's own data as JSON (read through RLS). */
export const GET = route(async (_req, learner) => {
  const data = await asUser(learner.id, async (tx) => {
    const u = learner.id;
    const s = schema;
    return {
      exportedAt: new Date().toISOString(),
      profile: (await tx.select().from(s.profiles).where(eq(s.profiles.id, u)))[0] ?? null,
      languages: await tx.select().from(s.userLanguages).where(eq(s.userLanguages.userId, u)),
      schedule: await tx.select().from(s.scheduleSlots).where(eq(s.scheduleSlots.userId, u)),
      skillProgress: await tx.select().from(s.skillProgress).where(eq(s.skillProgress.userId, u)),
      unitProgress: await tx.select().from(s.unitProgress).where(eq(s.unitProgress.userId, u)),
      placements: await tx.select().from(s.placementAssessments).where(eq(s.placementAssessments.userId, u)),
      placementResults: await tx.select().from(s.placementSkillResults).where(eq(s.placementSkillResults.userId, u)),
      sessions: await tx.select().from(s.studySessions).where(eq(s.studySessions.userId, u)),
      attempts: await tx.select().from(s.exerciseAttempts).where(eq(s.exerciseAttempts.userId, u)),
      vocabulary: await tx.select().from(s.vocabularyItems).where(eq(s.vocabularyItems.userId, u)),
      vocabularyReviews: await tx.select().from(s.vocabularyReviews).where(eq(s.vocabularyReviews.userId, u)),
      mistakes: await tx.select().from(s.mistakeRecords).where(eq(s.mistakeRecords.userId, u)),
      weaknesses: await tx.select().from(s.userWeaknesses).where(eq(s.userWeaknesses.userId, u)),
      assessments: await tx.select().from(s.assessmentResults).where(eq(s.assessmentResults.userId, u)),
      studyLog: await tx.select().from(s.studyLog).where(eq(s.studyLog.userId, u)),
      conversations: await tx.select().from(s.conversations).where(eq(s.conversations.userId, u)),
      conversationMessages: await tx.select().from(s.conversationMessages).where(eq(s.conversationMessages.userId, u)),
      recordings: await tx.select().from(s.recordings).where(eq(s.recordings.userId, u)),
    };
  });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="fluency-lab-export-${new Date().toISOString().slice(0, 10)}.json"` },
  });
});
