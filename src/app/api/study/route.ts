import { z } from "zod";
import { NextResponse } from "next/server";
import { parseBody, withUser } from "@/lib/api";
import { addStudyTime } from "@/lib/progress";
import { isValidIsoDate } from "@/lib/dates";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  seconds: z.number().int().min(1).max(60),
  date: z.string().refine(isValidIsoDate, "Invalid date"),
  day: z.number().int().min(1).max(30).optional(),
});

/** Study-time heartbeat (sent while a learner is actively on a practice page). */
export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, schema);
  // At most ~one heartbeat per 10s per user; extra ones are ignored to keep time honest.
  if (!rateLimit(`study:${user.id}`, 7).ok) return NextResponse.json({ ok: false, ignored: true });
  await addStudyTime(user.id, body.date, body.seconds, body.day);
  return NextResponse.json({ ok: true });
});
