import { asUser } from "@/db";
import { route } from "@/server/http";
import { endConversation } from "@/server/tutor";

export const POST = route<{ id: string }>(async (_req, learner, { params }) => {
  const { id } = await params;
  return { summary: await asUser(learner.id, (tx) => endConversation(tx, learner.id, id)) };
});
