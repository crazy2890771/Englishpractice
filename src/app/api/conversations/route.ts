import { z } from "zod";
import { asUser } from "@/db";
import { readJson, route } from "@/server/http";
import { startConversation } from "@/server/tutor";

const body = z.object({ language: z.enum(["en", "zh"]), topic: z.enum(["daily", "travel", "business", "aviation", "interviews", "news", "mixed"]) });

export const POST = route(async (req, learner) => {
  const b = await readJson(req, body);
  const c = await asUser(learner.id, (tx) => startConversation(tx, learner, b.language, b.topic));
  return { id: c.id };
});
