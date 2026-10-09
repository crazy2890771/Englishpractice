import { expect, test } from "@playwright/test";
import { startDemo } from "./helpers";
import { listeningLibrary } from "../../src/content/listening-index";

test("download for offline, practise without a connection, then sync", async ({ page, context }) => {
  test.skip(test.info().project.name !== "desktop", "service-worker flow runs once, on desktop");
  test.setTimeout(240_000);
  await startDemo(page);
  await page.goto("/lesson/1"); // starts Day 1 and adds its vocabulary to the review deck
  await expect(page.getByRole("heading", { name: /Day 1:/ })).toBeVisible();

  await page.goto("/settings");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole("button", { name: "Download for offline" }).click();
  await expect(page.getByText(/Ready offline · Days 1–1/)).toBeVisible({ timeout: 120_000 });

  // ── Offline ──
  await context.setOffline(true);

  // Listening: graded on the device.
  await page.goto("/listening");
  await expect(page.getByRole("heading", { level: 1, name: /Listening Challenge/ })).toBeVisible();
  const first = listeningLibrary.find((x) => x.variant === "standard")!.exercise;
  await page.getByRole("button", { name: new RegExp(first.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
  for (const [qi, q] of first.questions.entries()) {
    if (q.type === "fill") await page.getByLabel(`Answer for question ${qi + 1}`).fill(String(q.answer));
    else await page.locator(`input[name="${q.id}"]`).nth(Number(q.answer)).check({ force: true });
  }
  await page.getByRole("button", { name: "Check answers" }).click();
  await expect(page.getByText(`${first.questions.length}/${first.questions.length} · 100%`)).toBeVisible();
  await expect(page.getByText(/checked on this device/)).toBeVisible();

  // Lesson page + review: works offline, ratings are queued.
  await page.goto("/lesson/1");
  await expect(page.getByRole("heading", { name: /Day 1:/ })).toBeVisible();
  await page.getByRole("button", { name: /5\. Mistake review/ }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: /^Reveal$|Show answer/ }).first().click();
    await page.getByRole("button", { name: "Good" }).click();
  }
  await expect(page.getByText(/2 reviews are saved on this device/)).toBeVisible();
  await expect(page.getByText(/3 offline answers are saved on this device/)).toBeVisible();

  // In-app navigation still works offline.
  await page.goto("/vocabulary");
  await expect(page.getByRole("heading", { level: 1, name: /Vocabulary/ })).toBeVisible();

  // ── Back online: everything syncs ──
  await context.setOffline(false);
  await expect(page.getByText(/Synced 3 offline answers/)).toBeVisible({ timeout: 45_000 });

  const exported = await (await page.request.get("/api/account/export")).json();
  const synced = exported.attempts.filter((a: { clientId: string | null }) => a.clientId);
  expect(synced.filter((a: { mode: string }) => a.mode === "LISTENING")).toHaveLength(1);
  expect(synced.filter((a: { mode: string }) => a.mode === "REVIEW")).toHaveLength(2);
  expect(synced.find((a: { mode: string }) => a.mode === "LISTENING").score).toBe(first.questions.length);
});
