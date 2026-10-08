import "server-only";
import { db } from "./db";
import { env } from "./env";
import { ApiError } from "./api";
import { rateLimit } from "./rate-limit";
import type { CurrentUser } from "./auth";

/**
 * Enforces burst rate limit + daily request cap + monthly cost cap before an AI call.
 * User-configured limits can only lower the server-wide caps.
 */
export async function assertAiAllowed(user: CurrentUser, bucket: string) {
  const rl = rateLimit(`${user.id}:${bucket}`, env.rateLimitPerMinute);
  if (!rl.ok) {
    throw new ApiError(429, `Too many requests. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`, "rate_limited");
  }
  const s = user.settings;
  const dailyCap = Math.min(env.maxDailyRequests, s?.dailyAiRequestLimit ?? env.maxDailyRequests);
  const monthlyCap = Math.min(env.maxMonthlyCostCents, s?.monthlyCostLimitCents ?? env.maxMonthlyCostCents);

  const now = new Date();
  const dayStart = new Date(now.getTime() - 24 * 3600_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [daily, monthly] = await Promise.all([
    db.aiUsage.count({ where: { userId: user.id, createdAt: { gte: dayStart }, provider: { not: "mock" } } }),
    db.aiUsage.aggregate({ where: { userId: user.id, createdAt: { gte: monthStart } }, _sum: { costCents: true } }),
  ]);
  if (daily >= dailyCap) {
    throw new ApiError(429, `Daily AI request limit reached (${dailyCap}). Adjust it in Settings or try tomorrow.`, "daily_limit");
  }
  if ((monthly._sum.costCents ?? 0) >= monthlyCap) {
    throw new ApiError(429, `Monthly AI budget reached ($${(monthlyCap / 100).toFixed(2)}).`, "budget_limit");
  }
}

export async function recordUsage(userId: string, kind: "llm" | "stt" | "tts", provider: string, units: number, costCents: number) {
  await db.aiUsage.create({ data: { userId, kind, provider, units: Math.round(units), costCents } });
}

export async function usageSummary(userId: string) {
  const now = new Date();
  const dayStart = new Date(now.getTime() - 24 * 3600_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [daily, monthly] = await Promise.all([
    db.aiUsage.count({ where: { userId, createdAt: { gte: dayStart }, provider: { not: "mock" } } }),
    db.aiUsage.aggregate({ where: { userId, createdAt: { gte: monthStart } }, _sum: { costCents: true } }),
  ]);
  return { requestsLast24h: daily, costCentsThisMonth: Math.round((monthly._sum.costCents ?? 0) * 100) / 100 };
}
