import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handleError, parseBody } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`register:${ip}`, 10).ok) throw new ApiError(429, "Too many attempts. Please wait a minute.");
    const body = await parseBody(req, schema);
    const exists = await db.user.findUnique({ where: { email: body.email } });
    if (exists) throw new ApiError(409, "An account with this email already exists.", "email_taken");
    const user = await db.user.create({
      data: { name: body.name, email: body.email, passwordHash: await hashPassword(body.password), settings: { create: {} } },
    });
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
