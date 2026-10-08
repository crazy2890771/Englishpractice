import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { getCurrentUser, type CurrentUser } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string, code = "error") {
  return NextResponse.json({ error: { message, code } }, { status });
}

export async function parseBody<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.", "bad_json");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ApiError(400, `Invalid input: ${first?.path.join(".") || "body"} — ${first?.message}`, "invalid_input");
  }
  return result.data;
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler with authentication and uniform error handling. */
export function withUser<P = Record<string, string>>(
  handler: (req: Request, user: CurrentUser, ctx: Ctx<P>) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await getCurrentUser();
      if (!user) return jsonError(401, "Please sign in to continue.", "unauthorized");
      return await handler(req, user, ctx);
    } catch (err) {
      return handleError(err);
    }
  };
}

export function handleError(err: unknown) {
  if (err instanceof ApiError) return jsonError(err.status, err.message, err.code);
  if (err instanceof ZodError) return jsonError(400, "Invalid input.", "invalid_input");
  if (err instanceof Error && err.name === "AbortError") return jsonError(499, "Request cancelled.", "aborted");
  console.error(err);
  return jsonError(500, "Something went wrong on our side. Please try again.", "server_error");
}
