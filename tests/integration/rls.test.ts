import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { asUser, schema, systemDb } from "@/db";
import { createUser, dbAvailable, deleteUser } from "./helpers";
import type { Learner } from "@/server/learner";

const up = await dbAvailable();

describe.skipIf(!up)("row-level security (real Postgres + Supabase auth schema)", () => {
  let a: Learner;
  let b: Learner;
  let userTables: string[] = [];

  beforeAll(async () => {
    a = await createUser();
    b = await createUser();
    const rows = (await systemDb.execute(
      sql`select table_name from information_schema.columns where table_schema = 'public' and column_name = 'user_id' order by table_name`,
    )) as unknown as { table_name: string }[];
    userTables = rows.map((r) => r.table_name);

    // Give user A data in a spread of tables.
    await asUser(a.id, async (tx) => {
      await tx.insert(schema.vocabularyItems).values({ userId: a.id, languageId: "en", word: "secret-word", meaningTh: "x" });
      await tx.insert(schema.studySessions).values({ userId: a.id, languageId: "en", kind: "practice", skills: ["reading"], durationMinutes: 10, plan: { version: 1, activities: [] }, state: {} });
      await tx.insert(schema.studyLog).values({ userId: a.id, logDate: "2026-01-01", languageId: "en", seconds: 60 });
    });
  });

  afterAll(async () => {
    if (a) await deleteUser(a.id);
    if (b) await deleteUser(b.id);
  });

  it("the signup trigger creates profile, both languages and the default 8-slot schedule", async () => {
    const r = await asUser(a.id, async (tx) => ({
      profile: await tx.select().from(schema.profiles).where(eq(schema.profiles.id, a.id)),
      langs: await tx.select().from(schema.userLanguages).where(eq(schema.userLanguages.userId, a.id)),
      slots: await tx.select().from(schema.scheduleSlots).where(eq(schema.scheduleSlots.userId, a.id)),
    }));
    expect(r.profile).toHaveLength(1);
    expect(r.profile[0]!.timezone).toBe("Asia/Bangkok");
    expect(r.langs.map((l) => l.languageId).sort()).toEqual(["en", "zh"]);
    expect(r.slots).toHaveLength(8);
  });

  it("has RLS enabled on every public table", async () => {
    const rows = (await systemDb.execute(sql`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)) as unknown as { relname: string }[];
    expect(rows.map((r) => r.relname)).toEqual([]);
    expect(userTables.length).toBeGreaterThanOrEqual(19);
  });

  it("user B cannot read any of user A's rows, in any user table", async () => {
    const leaks: string[] = [];
    await asUser(b.id, async (tx) => {
      for (const t of userTables) {
        const [r] = (await tx.execute(sql`select count(*)::int as n from ${sql.identifier(t)} where user_id = ${a.id}`)) as unknown as [{ n: number }];
        if (r.n > 0) leaks.push(`${t}: ${r.n}`);
      }
      const [p] = (await tx.execute(sql`select count(*)::int as n from profiles where id = ${a.id}`)) as unknown as [{ n: number }];
      if (p.n > 0) leaks.push("profiles");
    });
    expect(leaks).toEqual([]);
  });

  it("user A can read their own rows", async () => {
    const own = await asUser(a.id, (tx) => tx.select().from(schema.vocabularyItems).where(eq(schema.vocabularyItems.userId, a.id)));
    expect(own.map((v) => v.word)).toContain("secret-word");
  });

  it("user B cannot update or delete user A's rows", async () => {
    await asUser(b.id, async (tx) => {
      const upd = await tx.update(schema.vocabularyItems).set({ word: "hacked" }).where(eq(schema.vocabularyItems.userId, a.id)).returning();
      expect(upd).toHaveLength(0);
      const del = await tx.delete(schema.studySessions).where(eq(schema.studySessions.userId, a.id)).returning();
      expect(del).toHaveLength(0);
      const prof = await tx.update(schema.profiles).set({ displayName: "hacked" }).where(eq(schema.profiles.id, a.id)).returning();
      expect(prof).toHaveLength(0);
    });
    const still = await asUser(a.id, (tx) => tx.select().from(schema.vocabularyItems).where(and(eq(schema.vocabularyItems.userId, a.id), eq(schema.vocabularyItems.word, "secret-word"))));
    expect(still).toHaveLength(1);
  });

  it("user B cannot insert rows on behalf of user A", async () => {
    await expect(asUser(b.id, (tx) => tx.insert(schema.vocabularyItems).values({ userId: a.id, languageId: "en", word: "planted", meaningTh: "x" }))).rejects.toThrow();
  });

  it("curriculum content is readable but not writable by learners", async () => {
    const units = await asUser(b.id, (tx) => tx.select().from(schema.units).limit(1));
    expect(units).toHaveLength(1);
    await expect(asUser(b.id, (tx) => tx.update(schema.units).set({ title: "x" }).where(eq(schema.units.id, units[0]!.id)).returning())).resolves.toHaveLength(0);
    await expect(asUser(b.id, (tx) => tx.insert(schema.languages).values({ id: "xx", nameEn: "x", nameTh: "x", framework: "x", levels: [] }))).rejects.toThrow();
  });

  it("the anonymous (signed-out) role can read nothing", async () => {
    await expect(
      systemDb.transaction(async (tx) => {
        await tx.execute(sql`set local role anon`);
        return tx.execute(sql`select count(*) from public.profiles`);
      }),
    ).rejects.toThrow();
  });

  it("deleting the auth user removes all of their data (cascade)", async () => {
    const c = await createUser();
    await asUser(c.id, (tx) => tx.insert(schema.vocabularyItems).values({ userId: c.id, languageId: "zh", word: "你好", meaningTh: "hi" }));
    await deleteUser(c.id);
    const [r] = (await systemDb.execute(sql`select count(*)::int as n from vocabulary_items where user_id = ${c.id}`)) as unknown as [{ n: number }];
    expect(r.n).toBe(0);
  });
});
