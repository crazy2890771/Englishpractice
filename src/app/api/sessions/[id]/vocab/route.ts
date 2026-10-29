import { z } from "zod";
import { asUser } from "@/db";
import { readJson, route, HttpError } from "@/server/http";
import { getOwnSession, saveSessionState } from "@/server/sessions";
import { reviewVocabulary } from "@/server/vocab";

const body = z.object({ itemId: z.string().uuid(), quality: z.number().int().min(0).max(5), mode: z.enum(["flashcard", "recall", "choice", "listening"]).default("flashcard") });

/** Spaced-repetition review of a vocabulary item inside a session. */
export const POST = route<{ id: string }>(async (req, learner, { params }) => {
  const { id } = await params;
  const b = await readJson(req, body);
  return asUser(learner.id, async (tx) => {
    await getOwnSession(tx, learner.id, id);
    const r = await reviewVocabulary(tx, learner.id, b.itemId, b.quality, b.mode);
    if (!r) throw new HttpError(404, "not_found");
    await saveSessionState(tx, learner.id, id, { vocabDone: b.itemId });
    return { correct: r.correct, familiarity: r.familiarity, dueAt: r.item.dueAt };
  });
});
