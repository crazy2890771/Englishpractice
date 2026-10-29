import { z } from "zod";
import { asUser, schema } from "@/db";
import { readJson, route } from "@/server/http";

const body = z.object({
  language: z.enum(["en", "zh"]),
  word: z.string().trim().min(1).max(80),
  meaningTh: z.string().trim().min(1).max(300),
  meaningEn: z.string().trim().max(300).default(""),
  pronunciation: z.string().max(120).nullable().default(null),
  example: z.string().max(300).default(""),
});

/** Save a word from a reading passage to the learner's vocabulary deck. */
export const POST = route(async (req, learner) => {
  const b = await readJson(req, body);
  await asUser(learner.id, (tx) =>
    tx.insert(schema.vocabularyItems).values({ userId: learner.id, languageId: b.language, word: b.word, meaningTh: b.meaningTh, meaningEn: b.meaningEn, pronunciation: b.pronunciation, example: b.example }).onConflictDoNothing(),
  );
  return { ok: true };
});
