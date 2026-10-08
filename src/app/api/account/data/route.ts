import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, withUser } from "@/lib/api";
import { destroySession } from "@/lib/auth";

const schema = z.object({ scope: z.enum(["recordings", "transcripts", "progress", "account"]) });

/** Data deletion controls. */
export const DELETE = withUser(async (req, user) => {
  const { scope } = await parseBody(req, schema);
  const userId = user.id;
  if (scope === "recordings") {
    await db.recording.deleteMany({ where: { userId } });
  } else if (scope === "transcripts") {
    await db.$transaction([
      db.recording.deleteMany({ where: { userId } }),
      db.conversation.deleteMany({ where: { userId } }),
      db.writingSubmission.deleteMany({ where: { userId } }),
      db.exerciseAttempt.updateMany({ where: { userId, mode: "SHADOWING" }, data: { data: {} } }),
    ]);
  } else if (scope === "progress") {
    await db.$transaction([
      db.recording.deleteMany({ where: { userId } }),
      db.conversation.deleteMany({ where: { userId } }),
      db.writingSubmission.deleteMany({ where: { userId } }),
      db.exerciseAttempt.deleteMany({ where: { userId } }),
      db.lessonProgress.deleteMany({ where: { userId } }),
      db.mistake.deleteMany({ where: { userId } }),
      db.vocabularyItem.deleteMany({ where: { userId } }),
      db.assessment.deleteMany({ where: { userId } }),
      db.studyDay.deleteMany({ where: { userId } }),
    ]);
  } else {
    await db.user.delete({ where: { id: userId } });
    await destroySession();
  }
  return NextResponse.json({ ok: true });
});
