"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: string,
  ) {
    super(code);
  }
}

/** JSON fetch with timeout, cancellation and error codes the UI can translate. */
export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal; timeoutMs?: number } = {}): Promise<T> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 45_000);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
      headers: opts.form || opts.body === undefined ? undefined : { "content-type": "application/json" },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    throw new ApiError(0, timeout.aborted ? "timeout" : "network");
  }
  if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
  const json = res.headers.get("content-type")?.includes("json") ? await res.json().catch(() => null) : null;
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? "server_error", json?.error?.detail);
  return (json ?? (await res.blob())) as T;
}

export function isAbort(e: unknown) {
  return e instanceof DOMException && e.name === "AbortError";
}
