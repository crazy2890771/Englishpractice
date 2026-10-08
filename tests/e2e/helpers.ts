import { expect, type Page } from "@playwright/test";

export async function startDemo(page: Page) {
  await page.goto("/welcome");
  await page.getByRole("button", { name: /try the demo/i }).click();
  await page.waitForURL("**/onboarding");
  await page.getByLabel("Your name").fill("Alex");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /skip for now/i }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: /a more fluent/i })).toBeVisible();
}

/** Switches a VoiceInput to typing mode (if needed) and sends text. */
export async function typeAnswer(page: Page, text: string, submit: RegExp = /send/i) {
  const box = page.getByLabel("Your answer").first();
  if (!(await box.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: /type instead/i }).first().click();
  }
  await box.fill(text);
  await page.getByRole("button", { name: submit }).first().click();
}

export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}
