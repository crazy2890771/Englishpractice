import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { asUser, schema, type Tx } from "@/db";
import { getUser, requireUser } from "@/lib/supabase/server";
import { resolveProvider } from "@/ai/providers";
import type { LanguageId } from "@/content/types";

export type Profile = typeof schema.profiles.$inferSelect;

export interface Learner {
  id: string;
  email: string | null;
  profile: Profile;
}

async function loadProfile(tx: Tx, userId: string): Promise<Profile> {
  const [p] = await tx.select().from(schema.profiles).where(eq(schema.profiles.id, userId));
  if (p) return p;
  // Normally created by the auth trigger; recreate defensively (e.g. users created before the trigger existed).
  const [created] = await tx.insert(schema.profiles).values({ id: userId }).onConflictDoNothing().returning();
  return created ?? (await tx.select().from(schema.profiles).where(eq(schema.profiles.id, userId)))[0]!;
}

/** Current learner (verified session + profile), cached per request. Redirects to /login if signed out. */
export const getLearner = cache(async (): Promise<Learner> => {
  const user = await requireUser();
  const profile = await asUser(user.id, (tx) => loadProfile(tx, user.id));
  return { id: user.id, email: user.email, profile };
});

/** Same as getLearner but returns null instead of redirecting (for API routes). */
export async function getLearnerOrNull(): Promise<Learner | null> {
  const user = await getUser();
  if (!user) return null;
  const profile = await asUser(user.id, (tx) => loadProfile(tx, user.id));
  return { id: user.id, email: user.email, profile };
}

export function providerFor(profile: Profile) {
  return resolveProvider(profile.aiProvider);
}

export function explanationLang(profile: Profile): "th" | "en" {
  return profile.explanationLanguage === "en" ? "en" : "th";
}

export function asLanguage(id: string): LanguageId {
  if (id !== "en" && id !== "zh") throw new Error(`Unsupported language ${id}`);
  return id;
}
