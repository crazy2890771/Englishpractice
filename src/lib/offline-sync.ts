import "server-only";
import { z } from "zod";
import { db } from "./db";

/** Fields sent with work done offline and replayed later from the client outbox. */
export const syncFields = {
  clientId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
  occurredAt: z.string().datetime().optional(),
};

const MAX_AGE_MS = 60 * 86400_000;

/** When the learner actually did the exercise. Clamped to [now − 60 days, now]. */
export function occurredAt(iso?: string): Date {
  const now = Date.now();
  if (!iso) return new Date(now);
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return new Date(now);
  return new Date(Math.min(now, Math.max(now - MAX_AGE_MS, t)));
}

/** Returns the existing attempt if this client id was already synced (retries are idempotent). */
export async function findSynced(userId: string, clientId?: string) {
  if (!clientId) return null;
  return db.exerciseAttempt.findFirst({ where: { clientId, userId } });
}
