import { z } from "zod";
import { asUser } from "@/db";
import { readJson, route } from "@/server/http";
import { answerPlacement } from "@/server/placement";

const response = z.union([
  z.object({ choice: z.number().int().min(0).max(10) }),
  z.object({ bool: z.boolean() }),
  z.object({ order: z.array(z.string().max(80)).max(20) }),
  z.object({ pairs: z.record(z.string().max(200), z.string().max(200)) }),
  z.object({ transcript: z.string().max(5000), durationMs: z.number().int().optional(), inputMode: z.enum(["voice", "text"]).optional() }),
  z.object({ text: z.string().max(5000) }),
]);
const body = z.object({ skill: z.enum(["listening", "speaking", "reading", "writing", "vocabulary"]), exerciseId: z.string().max(120), response, durationMs: z.number().int().min(0).max(600000).optional() });

export const POST = route<{ id: string }>(async (req, learner, { params }) => {
  const { id } = await params;
  const b = await readJson(req, body);
  return asUser(learner.id, (tx) => answerPlacement(tx, learner, id, b.skill, { exerciseId: b.exerciseId, response: b.response, durationMs: b.durationMs, signal: req.signal }));
});
