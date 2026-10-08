import "server-only";
import { env } from "../../env";
import { ProviderError } from "./types";

/** fetch with timeout + caller cancellation + one retry on transient errors. */
export async function providerFetch(url: string, init: RequestInit, signal?: AbortSignal, attempt = 0): Promise<Response> {
  const timeout = AbortSignal.timeout(env.timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: combined });
  } catch (err) {
    if (signal?.aborted) throw Object.assign(new Error("Request cancelled."), { name: "AbortError" });
    if (timeout.aborted) {
      if (attempt === 0) return providerFetch(url, init, signal, 1);
      throw new ProviderError("The AI service timed out.", true);
    }
    if (attempt === 0) return providerFetch(url, init, signal, 1);
    throw new ProviderError(`Could not reach the AI service: ${(err as Error).message}`, true);
  }
  if (res.ok) return res;
  const retryable = res.status === 429 || res.status >= 500;
  if (retryable && attempt === 0) {
    await new Promise((r) => setTimeout(r, 800));
    return providerFetch(url, init, signal, 1);
  }
  let detail = "";
  try {
    detail = (await res.text()).slice(0, 300);
  } catch {
    /* ignore */
  }
  const msg =
    res.status === 401 || res.status === 403
      ? "The AI provider rejected the API key. Check the server configuration."
      : `The AI provider returned an error (${res.status}).`;
  if (process.env.NODE_ENV !== "production") console.warn("[ai] provider error", res.status, detail);
  throw new ProviderError(msg, retryable, res.status);
}
