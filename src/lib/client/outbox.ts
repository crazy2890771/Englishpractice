"use client";
import { ClientError, api } from "./api";

/**
 * Offline outbox: work done without a connection (listening answers, review ratings)
 * is graded on the device, stored here, and replayed to the server in order when
 * the connection returns. Each item carries a clientId so replays are idempotent.
 */

export interface OutboxItem {
  clientId: string;
  url: string;
  body: Record<string, unknown>;
  /** Lesson step to re-verify on the server after this item syncs. */
  step?: { day: number; step: string };
  createdAt: string;
}

const EVENT = "efl-outbox-change";
const key = (userId: string) => `efl-outbox:v1:${userId}`;

export function newClientId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function readOutbox(userId: string): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

function writeOutbox(userId: string, items: OutboxItem[]) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(items));
  } catch {
    /* storage full or unavailable — nothing else we can do */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: items.length }));
}

export function enqueue(userId: string, item: Omit<OutboxItem, "createdAt">) {
  writeOutbox(userId, [...readOutbox(userId), { ...item, createdAt: new Date().toISOString() }]);
}

export function onOutboxChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Ids of review items with a rating waiting to sync (so cached queues can hide them). */
export function pendingReviewIds(userId: string): Set<string> {
  const ids = new Set<string>();
  for (const it of readOutbox(userId)) {
    const m = it.url.match(/^\/api\/review\/(?:mistake|vocab)\/([^/]+)$/);
    if (m) ids.add(m[1]!);
  }
  return ids;
}

/** True when an error means "no connection" rather than a real server answer. */
export function isOfflineError(err: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return err instanceof ClientError && (err.code === "network" || err.code === "timeout" || err.code === "offline");
}

/**
 * POSTs now if possible; if the device is offline, queues the request instead.
 * Returns { queued: true } when queued, otherwise the server response.
 */
export async function postOrQueue<T>(
  userId: string,
  url: string,
  body: Record<string, unknown>,
  step?: OutboxItem["step"],
): Promise<{ queued: true } | { queued: false; data: T }> {
  const payload = { ...body, clientId: newClientId(), occurredAt: new Date().toISOString() };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueue(userId, { clientId: payload.clientId, url, body: payload, step });
    return { queued: true };
  }
  try {
    return { queued: false, data: await api<T>(url, { body: payload, timeoutMs: 20_000 }) };
  } catch (err) {
    if (isOfflineError(err)) {
      enqueue(userId, { clientId: payload.clientId, url, body: payload, step });
      return { queued: true };
    }
    throw err;
  }
}

let flushing = false;

/**
 * Replays queued items in order. Stops at the first connection problem (retried later).
 * Items the server rejects as invalid (4xx) are dropped so one bad item can't block the queue.
 */
export async function flushOutbox(userId: string): Promise<{ synced: number; remaining: number }> {
  if (flushing || !navigator.onLine) return { synced: 0, remaining: readOutbox(userId).length };
  flushing = true;
  let synced = 0;
  const steps = new Map<string, { day: number; step: string }>();
  try {
    for (;;) {
      const [item] = readOutbox(userId);
      if (!item) break;
      try {
        await api(item.url, { body: item.body, timeoutMs: 20_000 });
        synced++;
        if (item.step) steps.set(`${item.step.day}:${item.step.step}`, item.step);
      } catch (err) {
        if (err instanceof ClientError && err.status >= 400 && err.status < 500 && ![401, 408, 429].includes(err.status)) {
          console.warn("[outbox] dropped invalid item", item.url, err.message);
        } else {
          break;
        }
      }
      writeOutbox(userId, readOutbox(userId).filter((x) => x.clientId !== item.clientId));
    }
    for (const s of steps.values()) {
      await api(`/api/lessons/${s.day}/step`, { body: { step: s.step } }).catch(() => {});
    }
  } finally {
    flushing = false;
  }
  return { synced, remaining: readOutbox(userId).length };
}
