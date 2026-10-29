import { sql, eq } from "drizzle-orm";
import { z } from "zod";
import { asUser, schema, systemDb } from "@/db";
import { readJson, route } from "@/server/http";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Permanently deletes the account. Recordings are removed from storage first, then the auth user
 * (all learner rows cascade from auth.users). Requires typing DELETE as confirmation.
 */
export const DELETE = route(async (req, learner) => {
  await readJson(req, z.object({ confirm: z.literal("DELETE") }));
  const recs = await asUser(learner.id, (tx) => tx.select({ path: schema.recordings.storagePath }).from(schema.recordings).where(eq(schema.recordings.userId, learner.id)));
  const supabase = await supabaseServer();
  if (recs.length) await supabase.storage.from("recordings").remove(recs.map((r) => r.path));
  await systemDb.execute(sql`delete from auth.users where id = ${learner.id}`);
  await supabase.auth.signOut();
  return { ok: true };
});
