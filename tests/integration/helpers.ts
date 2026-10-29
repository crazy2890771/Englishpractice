import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { asUser, schema, systemDb } from "@/db";
import type { Exercise } from "@/content/types";
import type { Response } from "@/engine/scoring";
import type { Learner } from "@/server/learner";

export async function dbAvailable() {
  try {
    await systemDb.execute(sql`select 1 from public.languages limit 1`);
    const [{ n }] = (await systemDb.execute(sql`select count(*)::int as n from public.units`)) as unknown as [{ n: number }];
    return n > 0;
  } catch {
    return false;
  }
}

/** Creates a real auth user (the signup trigger creates profile, languages and schedule). */
export async function createUser(): Promise<Learner> {
  const id = randomUUID();
  const email = `test-${id.slice(0, 8)}@example.test`;
  await systemDb.execute(sql`insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at, updated_at) values (${id}, ${email}, 'authenticated', 'authenticated', '{"name":"Test"}'::jsonb, now(), now())`);
  await asUser(id, (tx) => tx.update(schema.profiles).set({ onboarded: true }).where(eq(schema.profiles.id, id)));
  const profile = await asUser(id, async (tx) => (await tx.select().from(schema.profiles).where(eq(schema.profiles.id, id)))[0]!);
  return { id, email, profile };
}

export async function deleteUser(id: string) {
  await systemDb.execute(sql`delete from auth.users where id = ${id}`);
}

/** A correct (or deliberately wrong) response for an objective exercise. */
export function answerFor(e: Exercise, correct = true): Response {
  switch (e.type) {
    case "mcq":
      return { choice: correct ? e.answer : (e.answer + 1) % e.options.length };
    case "true_false":
      return { bool: correct ? e.answer : !e.answer };
    case "fill_blank":
    case "word_recall":
    case "sentence_correction":
      return { text: correct ? e.answers[0]! : "zzzz" };
    case "listen_type":
      return { text: correct ? e.audio : "zzzz" };
    case "repeat_sentence":
      return { transcript: correct ? e.text : "zzzz", inputMode: "text" };
    case "sentence_order":
      return { order: correct ? e.tokens : [...e.tokens].reverse() };
    case "match_pairs":
      return { pairs: Object.fromEntries(e.pairs.map(([l, r], i) => [l, correct ? r : e.pairs[(i + 1) % e.pairs.length]![1]])) };
    case "open_writing":
      return { text: correct ? "I like my city because it is friendly and green. Every weekend I walk in the park with my friends, and then we eat noodles together. However, the traffic is bad, so I usually take the train to work." : "ok" };
    case "speaking_response":
      return { transcript: correct ? "I like my city because it is friendly. Every weekend I walk in the park with my friends and then we eat noodles together." : "ok", inputMode: "text" };
  }
}
