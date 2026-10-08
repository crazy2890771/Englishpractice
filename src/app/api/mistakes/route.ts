import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, withUser } from "@/lib/api";
import { feedbackItemSchema } from "@/lib/ai/schemas";
import { saveMistakes } from "@/lib/mistakes";

const schema = z.object({
  source: z.enum(["SPEAKING", "LISTENING", "WRITING", "SHADOWING", "REVIEW", "ROLEPLAY", "ASSESSMENT"]),
  items: z.array(feedbackItemSchema).min(1).max(12),
});

/** Manually save corrections (e.g. "Save to Mistakes" button). */
export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, schema);
  const saved = await saveMistakes(user.id, body.source, body.items);
  return NextResponse.json({ saved: saved.length });
});

export const GET = withUser(async (_req, user) => {
  const mistakes = await db.mistake.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ mistakes });
});
