import { asUser } from "@/db";
import { route, HttpError } from "@/server/http";
import { startFromBeginning } from "@/server/placement";
import { isLanguage } from "@/languages";

/** Start the curriculum at the first level without a placement test. */
export const POST = route<{ lang: string }>(async (_req, learner, { params }) => {
  const { lang } = await params;
  if (!isLanguage(lang)) throw new HttpError(404, "not_found");
  await asUser(learner.id, (tx) => startFromBeginning(tx, learner.id, lang));
  return { ok: true };
});
