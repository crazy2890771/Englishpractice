import "server-only";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import { supabaseServer } from "@/lib/supabase/server";

/** Deletes expired recordings (retention setting) — rows and storage objects. */
export async function purgeExpiredRecordings(tx: Tx, userId: string) {
  const expired = await tx.select().from(schema.recordings).where(and(eq(schema.recordings.userId, userId), lt(schema.recordings.expiresAt, new Date())));
  if (!expired.length) return;
  const supabase = await supabaseServer();
  await supabase.storage.from("recordings").remove(expired.map((r) => r.storagePath));
  await tx.delete(schema.recordings).where(and(eq(schema.recordings.userId, userId), lt(schema.recordings.expiresAt, new Date())));
}

/** Earliest and latest speaking recordings (for "then vs now" comparison), with short-lived signed URLs. */
export async function listRecordings(tx: Tx, userId: string, language: string) {
  await purgeExpiredRecordings(tx, userId);
  const where = and(eq(schema.recordings.userId, userId), eq(schema.recordings.languageId, language));
  const [early, late] = await Promise.all([
    tx.select().from(schema.recordings).where(where).orderBy(asc(schema.recordings.createdAt)).limit(3),
    tx.select().from(schema.recordings).where(where).orderBy(desc(schema.recordings.createdAt)).limit(3),
  ]);
  const all = [...early, ...late.filter((l) => !early.some((e) => e.id === l.id))];
  if (!all.length) return { early: [], late: [] };
  const supabase = await supabaseServer();
  const { data } = await supabase.storage.from("recordings").createSignedUrls(all.map((r) => r.storagePath), 3600);
  const url = (p: string) => data?.find((d) => d.path === p)?.signedUrl ?? null;
  const dto = (r: (typeof all)[number]) => ({ id: r.id, url: url(r.storagePath), transcript: r.transcript, prompt: r.prompt, at: r.createdAt.toISOString(), durationMs: r.durationMs });
  return { early: early.map(dto), late: late.filter((l) => !early.some((e) => e.id === l.id)).map(dto) };
}
