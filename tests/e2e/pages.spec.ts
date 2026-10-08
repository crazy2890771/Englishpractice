import { expect, test } from "@playwright/test";
import { collectErrors, startDemo } from "./helpers";

const PAGES: [string, RegExp][] = [
  ["/dashboard", /a more fluent/i],
  ["/calendar", /30-Day Journey/i],
  ["/lesson/1", /Day 1:/i],
  ["/speaking", /AI Speaking Partner/i],
  ["/listening", /Listening Challenge/i],
  ["/writing", /Writing Coach/i],
  ["/roleplay", /Real-Life Roleplay/i],
  ["/shadowing", /Shadowing Trainer/i],
  ["/mistakes", /Mistake Hub/i],
  ["/vocabulary", /Vocabulary/i],
  ["/progress", /Progress Analytics/i],
  ["/progress/compare", /Day 1 vs Day 30/i],
  ["/assessment", /Assessment/i],
  ["/settings", /Settings/i],
];

test("welcome page renders for signed-out visitors", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL("**/welcome");
  await expect(page.getByRole("button", { name: /try the demo/i })).toBeVisible();
  await page.screenshot({ path: `test-results/screens/${test.info().project.name}-welcome.png`, fullPage: true });
});

test("every page renders without errors or horizontal overflow", async ({ page }) => {
  const errors = collectErrors(page);
  await startDemo(page);
  for (const [path, heading] of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}${path.replace(/\//g, "-")}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test("navigation works on this viewport", async ({ page }) => {
  await startDemo(page);
  if (page.viewportSize()!.width < 768) {
    await page.getByRole("button", { name: "More navigation" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Progress" }).click();
  } else {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Progress" }).click();
  }
  await expect(page.getByRole("heading", { level: 1, name: /Progress Analytics/ })).toBeVisible();
});
