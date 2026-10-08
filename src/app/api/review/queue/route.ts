import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUser } from "@/lib/api";

export const GET = withUser(async (_req, user) => {
  const now = new Date();
  const [mistakes, vocab] = await Promise.all([
    db.mistake.findMany({ where: { userId: user.id, mastered: false, dueAt: { lte: now } }, orderBy: { dueAt: "asc" }, take: 20 }),
    db.vocabularyItem.findMany({ where: { userId: user.id, mastered: false, dueAt: { lte: now } }, orderBy: { dueAt: "asc" }, take: 20 }),
  ]);
  return NextResponse.json({ mistakes, vocab });
});
