import { z } from "zod";
import { asUser } from "@/db";
import { readJson, route } from "@/server/http";
import { submitAnswer } from "@/server/sessions";

const response = z.union([
  z.object({ choice: z.number().int().min(0).max(10) }),
  z.object({ bool: z.boolean() }),
  z.object({ order: z.array(z.string().max(80)).max(20) }),
  z.object({ pairs: z.record(z.string().max(200), z.string().max(200)) }),
  z.object({ transcript: z.string().max(5000), durationMs: z.number().int().min(0).max(600000).optional(), inputMode: z.enum(["voice", "text"]).optional() }),
  z.object({ text: z.string().max(5000) }),
]);
const body = z.object({ exerciseId: z.string().max(120), response, durationMs: z.number().int().min(0).max(600000).optional(), retry: z.boolean().optional() });

/** Scores an answer (deterministically, or by rubric for open tasks), saves it and returns feedback. */
export const POST = route<{ id: string }>(async (req, learner, { params }) => {
  const { id } = await params;
  const b = await readJson(req, body);
  return asUser(learner.id, (tx) => submitAnswer(tx, learner, id, { ...b, signal: req.signal }));
});
