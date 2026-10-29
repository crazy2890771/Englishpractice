import { asUser } from "@/db";
import { route, HttpError } from "@/server/http";
import { startPlacement } from "@/server/placement";
import { isLanguage } from "@/languages";

export const POST = route<{ lang: string }>(async (_req, learner, { params }) => {
  const { lang } = await params;
  if (!isLanguage(lang)) throw new HttpError(404, "not_found");
  const a = await asUser(learner.id, (tx) => startPlacement(tx, learner.id, lang));
  return { id: a.id };
});
