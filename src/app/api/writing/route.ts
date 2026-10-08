import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, withUser } from "@/lib/api";
import { getLesson } from "@/content/curriculum";
import { resolveProviders } from "@/lib/ai/config";
import { writingFeedback } from "@/lib/ai/engine";
import { assertAiAllowed, recordUsage } from "@/lib/usage";
import { saveMistakes } from "@/lib/mistakes";
import { wordCount } from "@/lib/text";
import { FREE_WRITING_PROMPTS } from "@/content/writing-prompts";

const schema = z.object({
  text: z.string().trim().min(1).max(4000),
  day: z.number().int().min(1).max(30).optional(),
  promptId: z.string().max(60),
});

export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, schema);
  if (wordCount(body.text) < 20) throw new ApiError(400, "Write at least 20 words to get useful feedback.");

  let prompt: { prompt: string; type: string; minWords: number; maxWords: number; targetWords: string[] };
  if (body.day) {
    const lesson = getLesson(body.day);
    if (!lesson) throw new ApiError(404, "Lesson not found.");
    prompt = { ...lesson.writing, targetWords: lesson.vocabulary.map((v) => v.word) };
  } else {
    const p = FREE_WRITING_PROMPTS.find((x) => x.id === body.promptId);
    if (!p) throw new ApiError(404, "Prompt not found.");
    prompt = { ...p, targetWords: [] };
  }

  const providers = resolveProviders(user.settings);
  await assertAiAllowed(user, "writing");
  const fb = await writingFeedback({ userId: user.id, llm: providers.llm, text: body.text, level: user.level, signal: req.signal, ...prompt });
  if (!fb.live) await recordUsage(user.id, "llm", "mock", 0, 0);
  const { live, ...feedback } = fb;
  const submission = await db.writingSubmission.create({
    data: {
      userId: user.id,
      day: body.day ?? null,
      promptId: body.promptId,
      prompt: prompt.prompt,
      text: body.text,
      corrected: feedback.corrected,
      natural: feedback.natural,
      feedback: feedback as object,
      scores: feedback.scores,
      live,
    },
  });
  await saveMistakes(user.id, "WRITING", feedback.items);
  return NextResponse.json({ submission, feedback, live });
});

export const GET = withUser(async (_req, user) => {
  const list = await db.writingSubmission.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
  return NextResponse.json({ submissions: list });
});
