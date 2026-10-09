"use client";

/**
 * Downloads pages, their JS/CSS and read-only data into the Cache Storage used by
 * public/sw.js so lessons open without a connection.
 * Keep these cache names in sync with public/sw.js.
 */
export const PAGES_CACHE = "efl-pages-v2";
export const STATIC_CACHE = "efl-static-v2";
const META_KEY = "efl-offline-pack";

export interface PackMeta {
  downloadedAt: string;
  pages: number;
  lessons: number[];
}

export function offlineSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "caches" in window;
}

export function readPackMeta(): PackMeta | null {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? "null") as PackMeta | null;
  } catch {
    return null;
  }
}

/** Finds /_next/static assets referenced in HTML (script tags and the inline RSC payload) or CSS. */
export function extractAssets(text: string): string[] {
  const out = new Set<string>();
  // Paths may contain "(app)" route groups, so match up to a file extension instead of stopping at ")".
  const re = /(?:\/_next\/)?(static\/(?:chunks|css|media)\/[^"'\\\s]*?\.(?:js|css|woff2?|ttf|otf|png|jpe?g|svg|webp|gif|ico))(?=["'\\\s)?#]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(`/_next/${m[1]}`);
  return [...out];
}

const BASE_PAGES = ["/dashboard", "/calendar", "/listening", "/mistakes", "/vocabulary", "/writing", "/shadowing", "/progress", "/offline"];
const DATA = ["/api/review/queue"];

export async function downloadOfflinePack(
  lessonDays: number[],
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<PackMeta> {
  if (!offlineSupported()) throw new Error("This browser doesn't support offline mode.");
  const ready = await Promise.race([
    navigator.serviceWorker.ready.then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), 5000)),
  ]);
  if (!ready) throw new Error("Offline support isn't active yet. Reload the page once and try again (it only runs in the production app).");
  const pagesCache = await caches.open(PAGES_CACHE);
  const staticCache = await caches.open(STATIC_CACHE);
  const pages = [...BASE_PAGES, ...lessonDays.map((d) => `/lesson/${d}`)];
  const assets = new Set<string>();
  const total = pages.length + DATA.length;
  let done = 0;

  for (const url of [...pages, ...DATA]) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const res = await fetch(url, { credentials: "same-origin", signal });
    if (!res.ok || res.redirected) throw new Error(`Couldn't download ${url} (${res.status}).`);
    if (url.startsWith("/api/")) {
      await pagesCache.put(url, res);
    } else {
      const html = await res.clone().text();
      extractAssets(html).forEach((a) => assets.add(a));
      await pagesCache.put(url, res);
    }
    onProgress(++done, total + assets.size);
  }

  const list = [...assets];
  for (let i = 0; i < list.length; i++) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const url = list[i]!;
    if (await staticCache.match(url)) {
      onProgress(++done, total + list.length);
      continue;
    }
    const res = await fetch(url, { signal }).catch(() => null);
    if (res?.ok) {
      if (url.endsWith(".css")) {
        for (const a of extractAssets(await res.clone().text())) if (!assets.has(a)) { assets.add(a); list.push(a); }
      }
      await staticCache.put(url, res);
    }
    onProgress(++done, total + list.length);
  }

  const meta: PackMeta = { downloadedAt: new Date().toISOString(), pages: pages.length, lessons: lessonDays };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
  return meta;
}
