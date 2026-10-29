import { z } from "zod";
import { asUser } from "@/db";
import { readJson, route } from "@/server/http";
import { saveSessionState } from "@/server/sessions";

const body = z.object({
  pos: z.object({ a: z.number().int().min(0).max(50), i: z.number().int().min(0).max(200) }).optional(),
  draft: z.object({ exerciseId: z.string().max(120), text: z.string().max(5000) }).optional(),
  paused: z.boolean().optional(),
});

/** Auto-save: current position, drafts, pause state. */
export const PATCH = route<{ id: string }>(async (req, learner, { params }) => {
  const { id } = await params;
  const b = await readJson(req, body);
  await asUser(learner.id, (tx) => saveSessionState(tx, learner.id, id, b));
  return { ok: true };
});
