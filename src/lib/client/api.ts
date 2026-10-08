"use client";

export class ClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = "error",
  ) {
    super(message);
  }
}

/**
 * fetch wrapper: JSON in/out, timeout, caller cancellation, friendly errors.
 * Throws ClientError (or AbortError when cancelled by the caller).
 */
export async function api<T = unknown>(
  url: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal; timeoutMs?: number; form?: FormData } = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 45_000);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
      headers: opts.form ? undefined : opts.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal,
      credentials: "same-origin",
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    if (timeout.aborted) throw new ClientError("The request timed out. Check your connection and try again.", 408, "timeout");
    throw new ClientError(
      typeof navigator !== "undefined" && !navigator.onLine ? "You're offline. Reconnect to use this feature." : "Network error. Please try again.",
      0,
      "network",
    );
  }
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/welcome";
  }
  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (!res.ok) {
    const data = isJson ? await res.json().catch(() => null) : null;
    throw new ClientError(data?.error?.message ?? `Request failed (${res.status}).`, res.status, data?.error?.code);
  }
  return (isJson ? res.json() : res.blob()) as Promise<T>;
}

export function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === "AbortError";
}

export function errorMessage(err: unknown) {
  if (err instanceof ClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
