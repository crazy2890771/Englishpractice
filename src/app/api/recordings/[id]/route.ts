import { and, eq } from "drizzle-orm";
import { asUser, schema } from "@/db";
import { route, HttpError } from "@/server/http";
import { supabaseServer } from "@/lib/supabase/server";

export const DELETE = route<{ id: string }>(async (_req, learner, { params }) => {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "not_found");
  const rows = await asUser(learner.id, (tx) => tx.delete(schema.recordings).where(and(eq(schema.recordings.id, id), eq(schema.recordings.userId, learner.id))).returning());
  if (rows[0]) await (await supabaseServer()).storage.from("recordings").remove([rows[0].storagePath]);
  return { ok: true };
});
