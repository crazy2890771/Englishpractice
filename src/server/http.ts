import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { AiError } from "@/ai/providers";
import { getLearnerOrNull, type Learner } from "./learner";

/** Error with a stable machine-readable code; the UI translates codes into Thai/English messages. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: string,
  ) {
    super(code);
  }
}

export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "bad_json");
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new HttpError(400, "invalid_input", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return r.data;
}

type Ctx<P> = { params: Promise<P> };

/** Authenticated route handler with uniform error handling. */
export function route<P = Record<string, string>>(handler: (req: Request, learner: Learner, ctx: Ctx<P>) => Promise<Response | unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const learner = await getLearnerOrNull();
      if (!learner) return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
      const out = await handler(req, learner, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: { code: err.code, detail: err.detail } }, { status: err.status });
      if (err instanceof AiError) return NextResponse.json({ error: { code: err.retryable ? "ai_unavailable" : "ai_error", detail: err.message } }, { status: 502 });
      console.error(err);
      return NextResponse.json({ error: { code: "server_error" } }, { status: 500 });
    }
  };
}
