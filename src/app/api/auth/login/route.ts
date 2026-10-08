import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handleError, parseBody } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`login:${ip}`, 10).ok) throw new ApiError(429, "Too many attempts. Please wait a minute.");
    const body = await parseBody(req, schema);
    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new ApiError(401, "Incorrect email or password.", "bad_credentials");
    }
    await createSession(user.id);
    return NextResponse.json({ ok: true, onboarded: user.onboarded });
  } catch (err) {
    return handleError(err);
  }
}
