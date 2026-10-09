import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, withUser } from "@/lib/api";
import { review } from "@/lib/srs";
import { findSynced, occurredAt, syncFields } from "@/lib/offline-sync";

const schema = z.object({ quality: z.number().int().min(0).max(5), day: z.number().int().min(1).max(30).optional(), ...syncFields });

export const POST = withUser<{ id: string }>(async (req, user, { params }) => {
  const { id } = await params;
  const body = await parseBody(req, schema);
  const v = await db.vocabularyItem.findFirst({ where: { id, userId: user.id } });
  if (!v) throw new ApiError(404, "Word not found.");
  if (await findSynced(user.id, body.clientId)) return NextResponse.json({ item: v, duplicate: true });
  const when = occurredAt(body.occurredAt);
  const next = review(v, body.quality, when);
  const updated = await db.vocabularyItem.update({
    where: { id: v.id },
    data: { ...next, reviewCount: { increment: 1 }, lastReviewedAt: when },
  });
  await db.exerciseAttempt.create({
    data: { userId: user.id, day: body.day ?? null, mode: "REVIEW", exerciseId: `vocab:${v.id}`, score: body.quality >= 3 ? 1 : 0, maxScore: 1, clientId: body.clientId, createdAt: when },
  });
  return NextResponse.json({ item: updated });
});
