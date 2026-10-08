import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handleError } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

/** Creates a fresh, private demo account (no email needed). Data is real and persisted. */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`demo:${ip}`, Number(process.env.DEMO_RATE_LIMIT_PER_MINUTE) || 5).ok) throw new ApiError(429, "Too many demo accounts. Please wait a minute.");
    const id = randomBytes(6).toString("hex");
    const user = await db.user.create({
      data: {
        name: "Alex",
        email: `demo-${id}@demo.local`,
        passwordHash: await hashPassword(randomBytes(24).toString("hex")),
        isDemo: true,
        settings: { create: {} },
      },
    });
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
