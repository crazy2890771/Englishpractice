import { z } from "zod";
import { asUser } from "@/db";
import { readJson, route } from "@/server/http";
import { skipPlacementSkill } from "@/server/placement";

const body = z.object({ skill: z.enum(["listening", "speaking", "reading", "writing", "vocabulary"]) });

export const POST = route<{ id: string }>(async (req, learner, { params }) => {
  const { id } = await params;
  const b = await readJson(req, body);
  await asUser(learner.id, (tx) => skipPlacementSkill(tx, learner.id, id, b.skill));
  return { ok: true };
});
