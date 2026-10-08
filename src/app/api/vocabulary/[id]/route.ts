import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUser } from "@/lib/api";

export const DELETE = withUser<{ id: string }>(async (_req, user, { params }) => {
  const { id } = await params;
  await db.vocabularyItem.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
});
