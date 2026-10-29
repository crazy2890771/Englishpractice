import { asUser } from "@/db";
import { route } from "@/server/http";
import { completeSession } from "@/server/sessions";

export const POST = route<{ id: string }>(async (_req, learner, { params }) => {
  const { id } = await params;
  return asUser(learner.id, (tx) => completeSession(tx, learner, id));
});
