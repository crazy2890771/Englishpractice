import { describe, expect, it } from "vitest";
import { extractAssets } from "@/lib/client/offline-pack";
import { occurredAt } from "@/lib/offline-sync";

describe("offline pack asset discovery", () => {
  it("finds script, css and RSC-payload chunk references", () => {
    const html = `
      <link rel="stylesheet" href="/_next/static/css/abc123.css"/>
      <script src="/_next/static/chunks/webpack-1.js" async></script>
      <script>self.__next_f.push([1,"5:I[123,[\\"static/chunks/app/(app)/lesson/%5Bday%5D/page-9f.js\\"],\\"default\\"]"])</script>`;
    expect(extractAssets(html).sort()).toEqual([
      "/_next/static/chunks/app/(app)/lesson/%5Bday%5D/page-9f.js",
      "/_next/static/chunks/webpack-1.js",
      "/_next/static/css/abc123.css",
    ]);
  });
  it("finds fonts referenced from CSS", () => {
    expect(extractAssets("@font-face{src:url(/_next/static/media/inter.woff2) format('woff2')}")).toEqual(["/_next/static/media/inter.woff2"]);
  });
});

describe("offline timestamps", () => {
  it("keeps a recent offline time", () => {
    const t = new Date(Date.now() - 3600_000).toISOString();
    expect(occurredAt(t).toISOString()).toBe(t);
  });
  it("clamps future and very old times", () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    expect(occurredAt(future).getTime()).toBeLessThanOrEqual(Date.now());
    const old = new Date(Date.now() - 400 * 86400_000).toISOString();
    expect(Date.now() - occurredAt(old).getTime()).toBeLessThanOrEqual(60 * 86400_000 + 1000);
  });
  it("falls back to now for missing or invalid input", () => {
    expect(Math.abs(occurredAt().getTime() - Date.now())).toBeLessThan(1000);
    expect(Math.abs(occurredAt("nope").getTime() - Date.now())).toBeLessThan(1000);
  });
});
