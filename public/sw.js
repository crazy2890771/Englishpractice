/* English Fluency Lab service worker — limited offline support.
 * - Static assets: cache-first.
 * - Pages: network-first, falling back to the last cached copy, then /offline.
 *   "Download for offline" (Settings / Calendar) pre-fills these caches.
 * - API GETs for read-only data are network-first with cache fallback.
 * - AI, audio and all non-GET requests always go to the network.
 */
const VERSION = "v2"; // keep cache names in sync with src/lib/client/offline-pack.ts
const STATIC = `efl-static-${VERSION}`;
const PAGES = `efl-pages-${VERSION}`;
const PRECACHE = ["/offline", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const NO_CACHE_API = /^\/api\/(ai|auth|recordings|conversations\/[^/]+\/(turn|end)|account)/;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    if (NO_CACHE_API.test(url.pathname)) return;
    e.respondWith(networkFirst(req, false));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, true));
  }
});

async function networkFirst(req, isPage) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res.ok && !res.redirected) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreVary: true });
    if (hit) return hit;
    if (isPage) return (await caches.match("/offline", { ignoreVary: true })) || new Response("Offline", { status: 503 });
    return new Response(JSON.stringify({ error: { message: "You're offline.", code: "offline" } }), { status: 503, headers: { "content-type": "application/json" } });
  }
}
