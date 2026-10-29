import { z } from "zod";
import { asUser } from "@/db";
import { readJson, route } from "@/server/http";
import { addActiveTime } from "@/server/sessions";
import { rateLimit } from "@/server/ai-usage";

const body = z.object({ seconds: z.number().int().min(1).max(60) });

/** Active study-time heartbeat (only sent while the session is open, visible and not paused). */
export const POST = route<{ id: string }>(async (req, learner, { params }) => {
  const { id } = await params;
  const b = await readJson(req, body);
  if (!rateLimit(`time:${learner.id}`, 6)) return { ok: false };
  await asUser(learner.id, (tx) => addActiveTime(tx, learner.id, id, b.seconds, learner.profile.timezone));
  return { ok: true };
});
