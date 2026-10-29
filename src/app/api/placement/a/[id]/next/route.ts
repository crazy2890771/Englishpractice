import { asUser } from "@/db";
import { route, HttpError } from "@/server/http";
import { nextPlacementItem } from "@/server/placement";
import { SKILLS, type Skill } from "@/content/types";

export const POST = route<{ id: string }>(async (req, learner, { params }) => {
  const { id } = await params;
  const skill = new URL(req.url).searchParams.get("skill") as Skill;
  if (!SKILLS.includes(skill)) throw new HttpError(400, "invalid_input");
  return asUser(learner.id, (tx) => nextPlacementItem(tx, learner.id, id, skill));
});
