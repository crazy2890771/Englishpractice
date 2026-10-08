import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, withUser } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  level: z.enum(["B1", "B2"]).optional(),
  goal: z.string().trim().max(200).optional(),
  onboarded: z.boolean().optional(),
});

export const PATCH = withUser(async (req, user) => {
  const body = await parseBody(req, schema);
  const updated = await db.user.update({ where: { id: user.id }, data: body, select: { name: true, level: true, goal: true, onboarded: true } });
  return NextResponse.json(updated);
});
