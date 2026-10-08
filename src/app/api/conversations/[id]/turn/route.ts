import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, withUser } from "@/lib/api";
import { buildContext } from "@/lib/conversation";
import { resolveProviders } from "@/lib/ai/config";
import { conversationTurn } from "@/lib/ai/engine";
import { assertAiAllowed, recordUsage } from "@/lib/usage";
import { saveMistakes } from "@/lib/mistakes";

const schema = z.object({
  text: z.string().trim().min(1, "Say or type something first.").max(2000),
  durationSec: z.number().min(0).max(600).optional(),
  recordingId: z.string().max(40).optional(),
});

export const POST = withUser<{ id: string }>(async (req, user, { params }) => {
  const { id } = await params;
  const body = await parseBody(req, schema);
  const convo = await db.conversation.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!convo) throw new ApiError(404, "Conversation not found.");
  if (convo.status === "ended") throw new ApiError(409, "This conversation has ended. Start a new one.");

  const providers = resolveProviders(user.settings);
  await assertAiAllowed(user, "chat");
  const ctx = buildContext(convo.topic, user.level);
  const result = await conversationTurn({
    userId: user.id,
    llm: providers.llm,
    ctx,
    history: convo.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    userText: body.text,
    durationSec: body.durationSec,
    signal: req.signal,
  });
  if (!result.live) await recordUsage(user.id, "llm", "mock", 0, 0);

  const recording = body.recordingId
    ? await db.recording.findFirst({ where: { id: body.recordingId, userId: user.id }, select: { id: true } })
    : null;
  const [userMsg, aiMsg] = await db.$transaction([
    db.message.create({
      data: { conversationId: convo.id, role: "user", content: body.text, feedback: { ...result.feedback, live: result.live }, recordingId: recording?.id },
    }),
    db.message.create({ data: { conversationId: convo.id, role: "assistant", content: result.reply } }),
    db.conversation.update({ where: { id: convo.id }, data: { updatedAt: new Date() } }),
  ]);
  await saveMistakes(user.id, convo.mode, result.feedback.items);
  return NextResponse.json({ userMessage: userMsg, reply: aiMsg, feedback: result.feedback, live: result.live, scenarioComplete: result.scenarioComplete });
});
