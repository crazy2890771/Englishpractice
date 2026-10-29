import { z } from "zod";
import { asUser } from "@/db";
import { readJson, route } from "@/server/http";
import { conversationTurn } from "@/server/tutor";

const body = z.object({ text: z.string().trim().min(1).max(2000), inputMode: z.enum(["voice", "text"]), durationMs: z.number().int().min(0).max(600000).optional() });

export const POST = route<{ id: string }>(async (req, learner, { params }) => {
  const { id } = await params;
  const b = await readJson(req, body);
  return asUser(learner.id, (tx) => conversationTurn(tx, learner, id, { ...b, signal: req.signal }));
});
