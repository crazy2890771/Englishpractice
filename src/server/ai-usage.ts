import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import { env } from "@/lib/env";
import { HttpError } from "./http";

const buckets = new Map<string, number[]>();

/** Sliding-window limiter (per server instance). Daily caps below are database-backed. */
export function rateLimit(key: string, limit: number, windowMs = 60_000, now = Date.now()) {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export async function assertAiAllowed(tx: Tx, userId: string) {
  if (!rateLimit(`ai:${userId}`, env.rateLimitPerMinute)) throw new HttpError(429, "rate_limited");
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.aiUsage)
    .where(and(eq(schema.aiUsage.userId, userId), gte(schema.aiUsage.createdAt, new Date(Date.now() - 86_400_000))));
  if ((r?.n ?? 0) >= env.maxDailyRequests) throw new HttpError(429, "daily_limit");
}

export function usageRecorder(tx: Tx, userId: string, kind: "llm" | "stt" | "tts", provider: string) {
  const pending: Promise<unknown>[] = [];
  return {
    onUsage: (tokensIn: number, tokensOut: number) => {
      pending.push(tx.insert(schema.aiUsage).values({ userId, kind, provider, units: tokensIn + tokensOut }));
    },
    flush: () => Promise.all(pending),
  };
}
