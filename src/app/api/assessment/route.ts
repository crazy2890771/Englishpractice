import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, withUser } from "@/lib/api";
import { assessment } from "@/content/assessment";
import { gradeListening } from "@/lib/listening";
import { resolveProviders } from "@/lib/ai/config";
import { conversationTurn, writingFeedback } from "@/lib/ai/engine";
import { assertAiAllowed } from "@/lib/usage";
import { lessonOverview } from "@/lib/progress";
import { estimatedLevel, overallPercent, sectionPercent, type AssessmentScores } from "@/lib/assessment";
import type { SpeakingScores } from "@/lib/ai/schemas";
import { wordCount } from "@/lib/text";

const schema = z.object({
  kind: z.enum(["BASELINE", "FINAL"]),
  speaking: z
    .array(z.object({ id: z.string(), text: z.string().trim().min(1).max(3000), durationSec: z.number().min(0).max(600).optional(), spoken: z.boolean().optional() }))
    .length(assessment.speaking.length),
  listening: z.record(z.union([z.string().max(200), z.number().int(), z.null()])),
  writing: z.string().trim().min(1).max(4000),
});

/**
 * Day 1 baseline and Day 30 final use the SAME tasks, the SAME rubric and the SAME
 * scorer type, so results are directly comparable.
 */
export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, schema);
  const ov = await lessonOverview(user.id);
  if (body.kind === "FINAL" && ov.completed < 29) throw new ApiError(403, "The final assessment unlocks on Day 30.");
  if (body.kind === "BASELINE" && ov.completed > 0) {
    const existing = await db.assessment.findUnique({ where: { userId_kind: { userId: user.id, kind: "BASELINE" } } });
    if (existing) throw new ApiError(409, "Your baseline is locked once lessons have started, so the Day 30 comparison stays fair.");
  }
  if (wordCount(body.writing) < 20) throw new ApiError(400, "Please write at least 20 words for the writing task.");

  const providers = resolveProviders(user.settings);
  // Keep the scorer consistent with the baseline when possible.
  let llm = providers.llm;
  if (body.kind === "FINAL") {
    const base = await db.assessment.findUnique({ where: { userId_kind: { userId: user.id, kind: "BASELINE" } } });
    if (base && !base.live) llm = "mock";
  }
  await assertAiAllowed(user, "assessment");

  const speakingScores: SpeakingScores[] = [];
  const speakingFeedback = [];
  for (const task of assessment.speaking) {
    const resp = body.speaking.find((s) => s.id === task.id);
    if (!resp) throw new ApiError(400, "Missing a speaking response.");
    const out = await conversationTurn({
      userId: user.id,
      llm,
      ctx: { kind: "speaking", topic: "Placement assessment", questions: [task.prompt], targetWords: [], level: "B1" },
      history: [{ role: "assistant", content: task.prompt }],
      userText: resp.text,
      durationSec: resp.durationSec,
      signal: req.signal,
    });
    speakingScores.push(out.feedback.scores);
    speakingFeedback.push({ id: task.id, feedback: out.feedback });
  }
  const avg = (k: keyof SpeakingScores) => speakingScores.reduce((s, x) => s + x[k], 0) / speakingScores.length;
  const speaking = { grammar: avg("grammar"), vocabulary: avg("vocabulary"), fluency: avg("fluency"), taskCompletion: avg("taskCompletion") };

  const listening = gradeListening(assessment.listening, body.listening);
  const wf = await writingFeedback({
    userId: user.id,
    llm,
    text: body.writing,
    prompt: assessment.writing.prompt,
    type: "email",
    minWords: assessment.writing.minWords,
    maxWords: assessment.writing.maxWords,
    level: "B1",
    targetWords: [],
    signal: req.signal,
  });

  const scores: AssessmentScores = {
    speaking,
    listening: { score: listening.score, max: listening.max, percent: listening.percent },
    writing: wf.scores,
    sections: { speaking: sectionPercent(speaking), listening: listening.percent, writing: sectionPercent(wf.scores) },
  };
  const overall = overallPercent(scores.sections);
  const level = estimatedLevel(overall);
  const live = llm !== "mock";
  const data = {
    version: assessment.version,
    responses: { speaking: body.speaking, listening: body.listening, writing: body.writing, speakingFeedback, writingFeedback: { ...wf, live: undefined }, listeningResults: listening.results },
    scores: scores as object,
    overall,
    level,
    live,
    completedAt: new Date(),
  };
  const saved = await db.assessment.upsert({
    where: { userId_kind: { userId: user.id, kind: body.kind } },
    create: { userId: user.id, kind: body.kind, ...data },
    update: data,
  });
  if (body.kind === "BASELINE") {
    await db.user.update({ where: { id: user.id }, data: { level: overall >= 70 ? "B2" : "B1", onboarded: true } });
  }
  return NextResponse.json({ assessment: saved });
});
