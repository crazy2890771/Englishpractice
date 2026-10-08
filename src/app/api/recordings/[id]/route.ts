import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, withUser } from "@/lib/api";

/** Streams a recording back to its owner only. */
export const GET = withUser<{ id: string }>(async (_req, user, { params }) => {
  const { id } = await params;
  const rec = await db.recording.findFirst({ where: { id, userId: user.id, expiresAt: { gte: new Date() } } });
  if (!rec) throw new ApiError(404, "Recording not found.");
  return new Response(Buffer.from(rec.data), {
    headers: { "content-type": rec.mimeType, "cache-control": "private, no-store", "content-length": String(rec.sizeBytes) },
  });
});

export const DELETE = withUser<{ id: string }>(async (_req, user, { params }) => {
  const { id } = await params;
  await db.recording.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
});
