import { z } from "zod";
import { NextResponse } from "next/server";
import { ApiError, parseBody, withUser } from "@/lib/api";
import { STEP_IDS, getLesson } from "@/content/curriculum";
import { markStep, verifyStep } from "@/lib/progress";

const schema = z.object({ step: z.enum(STEP_IDS as [string, ...string[]]) });

/** Verifies evidence for a step and marks it complete if satisfied. */
export const POST = withUser<{ day: string }>(async (req, user, { params }) => {
  const day = Number((await params).day);
  if (!getLesson(day)) throw new ApiError(404, "Lesson not found.");
  const { step } = await parseBody(req, schema);
  const result = await markStep(user.id, day, step as (typeof STEP_IDS)[number]);
  return NextResponse.json({ ok: result.ok, detail: result.detail, completedSteps: result.progress.completedSteps, status: result.progress.status });
});

/** Returns verification status of every step. */
export const GET = withUser<{ day: string }>(async (_req, user, { params }) => {
  const day = Number((await params).day);
  if (!getLesson(day)) throw new ApiError(404, "Lesson not found.");
  const checks = Object.fromEntries(await Promise.all(STEP_IDS.map(async (s) => [s, await verifyStep(user.id, day, s)] as const)));
  return NextResponse.json({ checks });
});
