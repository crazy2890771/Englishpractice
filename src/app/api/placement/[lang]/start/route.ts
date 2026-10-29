import { z } from "zod";
import { asUser } from "@/db";
import { route, HttpError } from "@/server/http";
import { startPlacement } from "@/server/placement";
import { isLanguage } from "@/languages";

const body = z.object({ self: z.enum(["none", "basic", "conversational", "confident"]).optional() });

export const POST = route<{ lang: string }>(async (req, learner, { params }) => {
  const { lang } = await params;
  if (!isLanguage(lang)) throw new HttpError(404, "not_found");
  // The body is optional (a retake from Profile sends none).
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  const a = await asUser(learner.id, (tx) => startPlacement(tx, learner.id, lang, parsed.success ? parsed.data.self : undefined));
  return { id: a.id };
});
