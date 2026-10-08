import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, withUser } from "@/lib/api";

export const GET = withUser<{ id: string }>(async (_req, user, { params }) => {
  const { id } = await params;
  const convo = await db.conversation.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!convo) throw new ApiError(404, "Conversation not found.");
  return NextResponse.json({ conversation: convo });
});

export const DELETE = withUser<{ id: string }>(async (_req, user, { params }) => {
  const { id } = await params;
  await db.conversation.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
});
