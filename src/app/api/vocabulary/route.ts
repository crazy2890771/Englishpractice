import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, withUser } from "@/lib/api";

const schema = z.object({
  word: z.string().trim().min(1).max(80),
  definition: z.string().trim().max(300).default(""),
  example: z.string().trim().max(300).default(""),
});

export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, schema);
  const item = await db.vocabularyItem.upsert({
    where: { userId_word: { userId: user.id, word: body.word } },
    create: { userId: user.id, ...body },
    update: {},
  });
  return NextResponse.json({ item });
});
