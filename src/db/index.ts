import "server-only";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { env } from "@/lib/env";

type Db = PostgresJsDatabase<typeof schema>;
const g = globalThis as unknown as { __flDb?: Db };

function create(): Db {
  // prepare:false keeps us compatible with Supabase's transaction pooler.
  const client = postgres(env.databaseUrl, { prepare: false, max: 10, idle_timeout: 20 });
  return drizzle(client, { schema });
}

/**
 * System connection (table owner — RLS does NOT apply).
 * Only for curriculum content reads/seeding and maintenance. Never for user data.
 */
export const systemDb: Db = g.__flDb ?? create();
if (process.env.NODE_ENV !== "production") g.__flDb = systemDb;

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Runs `fn` as the given user with row-level security enforced:
 * the transaction switches to the `authenticated` role and sets the verified JWT
 * claims, so `auth.uid()` in every RLS policy resolves to this user.
 */
export async function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Invalid user id");
  return systemDb.transaction(async (tx) => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true), set_config('request.jwt.claim.sub', ${userId}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}

export { schema };
