import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { env } from "./env";

export const SESSION_COOKIE = "efl_session";
const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(`${token}.${env.sessionSecret}`).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 11);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Resolves the signed-in user from the session cookie (server-side only). */
export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { settings: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { passwordHash: _omit, ...user } = session.user;
  void _omit;
  return user;
}

/** For server components/pages: redirects to the welcome page if signed out. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  return user;
}

export async function ensureSettings(userId: string) {
  return db.userSettings.upsert({ where: { userId }, create: { userId }, update: {} });
}
