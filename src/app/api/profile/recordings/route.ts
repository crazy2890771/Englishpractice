import { eq } from "drizzle-orm";
import { asUser, schema } from "@/db";
import { route } from "@/server/http";
import { supabaseServer } from "@/lib/supabase/server";

/** Deletes every saved recording (rows + storage objects). */
export const DELETE = route(async (_req, learner) => {
  const rows = await asUser(learner.id, (tx) => tx.delete(schema.recordings).where(eq(schema.recordings.userId, learner.id)).returning());
  if (rows.length) await (await supabaseServer()).storage.from("recordings").remove(rows.map((r) => r.storagePath));
  return { ok: true, deleted: rows.length };
});
