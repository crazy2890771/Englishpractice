import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, withUser } from "@/lib/api";
import { buildContext } from "@/lib/conversation";
import { resolveProviders } from "@/lib/ai/config";
import { roleplaySummary } from "@/lib/ai/engine";
import { assertAiAllowed } from "@/lib/usage";
import type { SpeakingScores } from "@/lib/ai/schemas";

export const POST = withUser<{ id: string }>(async (req, user, { params }) => {
  const { id } = await params;
  const convo = await db.conversation.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!convo) throw new ApiError(404, "Conversation not found.");
  if (convo.status === "ended" && convo.summary) return NextResponse.json({ summary: convo.summary });

  const learner = convo.messages.filter((m) => m.role === "user");
  const scores = learner.map((m) => (m.feedback as { scores?: SpeakingScores } | null)?.scores).filter((s): s is SpeakingScores => !!s);
  const avg = (k: keyof SpeakingScores) => (scores.length ? Math.round((scores.reduce((s, x) => s + x[k], 0) / scores.length) * 10) / 10 : null);
  let summary: Record<string, unknown> = {
    turns: learner.length,
    averages: { grammar: avg("grammar"), vocabulary: avg("vocabulary"), fluency: avg("fluency"), taskCompletion: avg("taskCompletion") },
    corrections: learner.reduce((n, m) => n + (((m.feedback as { items?: unknown[] } | null)?.items?.length) ?? 0), 0),
  };

  const ctx = buildContext(convo.topic, user.level);
  if (ctx.kind === "roleplay" && learner.length > 0) {
    const providers = resolveProviders(user.settings);
    if (providers.llm !== "mock") await assertAiAllowed(user, "chat");
    const rp = await roleplaySummary(
      user.id,
      providers.llm,
      ctx.scenario,
      convo.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      scores,
      req.signal,
    );
    summary = { ...summary, roleplay: rp };
  }
  await db.conversation.update({ where: { id: convo.id }, data: { status: "ended", summary: summary as object } });
  if (learner.length > 0) {
    await db.exerciseAttempt.create({
      data: {
        userId: user.id,
        day: convo.day,
        mode: convo.mode,
        exerciseId: convo.topic,
        score: summary.averages && avg("grammar") !== null ? (avg("grammar")! + avg("vocabulary")! + avg("fluency")! + avg("taskCompletion")!) : null,
        maxScore: 20,
        data: { conversationId: convo.id, turns: learner.length },
      },
    });
  }
  return NextResponse.json({ summary });
});
