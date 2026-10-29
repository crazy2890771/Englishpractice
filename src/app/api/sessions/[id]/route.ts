import { asUser } from "@/db";
import { route } from "@/server/http";
import { getOwnSession, sessionView } from "@/server/sessions";

export const GET = route<{ id: string }>(async (_req, learner, { params }) => {
  const { id } = await params;
  return asUser(learner.id, async (tx) => sessionView(tx, await getOwnSession(tx, learner.id, id)));
});
