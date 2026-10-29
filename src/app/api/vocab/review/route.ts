import { z } from "zod";
import { asUser } from "@/db";
import { readJson, route, HttpError } from "@/server/http";
import { reviewVocabulary } from "@/server/vocab";

const body = z.object({ itemId: z.string().uuid(), quality: z.number().int().min(0).max(5), mode: z.enum(["flashcard", "recall", "choice", "listening"]).default("flashcard") });

export const POST = route(async (req, learner) => {
  const b = await readJson(req, body);
  const r = await asUser(learner.id, (tx) => reviewVocabulary(tx, learner.id, b.itemId, b.quality, b.mode));
  if (!r) throw new HttpError(404, "not_found");
  return { correct: r.correct, familiarity: r.familiarity, dueAt: r.item.dueAt };
});
