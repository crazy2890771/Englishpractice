import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, withUser } from "@/lib/api";
import { buildContext } from "@/lib/conversation";
import { resolveProviders } from "@/lib/ai/config";
import { lessonOverview, isDayUnlocked } from "@/lib/progress";

const schema = z.object({
  topic: z.string().regex(/^(lesson|topic|roleplay):[a-z0-9-]+$/),
  day: z.number().int().min(1).max(30).optional(),
});

export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, schema);
  const ctx = buildContext(body.topic, user.level);
  if (body.day) {
    const ov = await lessonOverview(user.id);
    if (!isDayUnlocked(ov, body.day)) throw new ApiError(403, "This lesson is still locked.");
  }
  const providers = resolveProviders(user.settings);
  const convo = await db.conversation.create({
    data: {
      userId: user.id,
      mode: ctx.kind === "roleplay" ? "ROLEPLAY" : "SPEAKING",
      topic: body.topic,
      day: body.day ?? null,
      live: providers.mode === "live",
      messages: { create: { role: "assistant", content: ctx.opening } },
    },
    include: { messages: true },
  });
  return NextResponse.json({ conversation: convo, title: ctx.title, mode: providers.mode });
});

export const GET = withUser(async (req, user) => {
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") ?? undefined;
  const list = await db.conversation.findMany({
    where: { userId: user.id, ...(topic ? { topic } : {}) },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { _count: { select: { messages: true } } },
  });
  return NextResponse.json({ conversations: list });
});
