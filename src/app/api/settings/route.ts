import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBody, withUser } from "@/lib/api";
import { usageSummary } from "@/lib/usage";

const schema = z
  .object({
    theme: z.enum(["system", "light", "dark"]),
    speechRate: z.number().min(0.5).max(1.5),
    accent: z.enum(["US", "UK", "AU", "IN"]),
    llmProvider: z.enum(["auto", "anthropic", "openai", "mock"]),
    sttProvider: z.enum(["auto", "openai", "browser"]),
    ttsProvider: z.enum(["auto", "openai", "browser"]),
    saveRecordings: z.boolean(),
    recordingRetentionDays: z.number().int().min(1).max(365),
    interruptionFree: z.boolean(),
    dailyAiRequestLimit: z.number().int().min(0).max(10000),
    monthlyCostLimitCents: z.number().int().min(0).max(100000),
  })
  .partial();

export const GET = withUser(async (_req, user) => {
  const settings = await db.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  return NextResponse.json({ settings, usage: await usageSummary(user.id) });
});

export const PATCH = withUser(async (req, user) => {
  const body = await parseBody(req, schema);
  const settings = await db.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, ...body }, update: body });
  if (body.saveRecordings === false) {
    // Withdrawing consent deletes stored recordings.
    await db.recording.deleteMany({ where: { userId: user.id } });
  }
  return NextResponse.json({ settings });
});
