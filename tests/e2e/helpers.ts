import { expect, type Page } from "@playwright/test";

export const LONG_EN =
  "I live in Bangkok and I like my city because it is friendly and busy. Every weekend I walk in the park with my friends, and then we eat noodles together. However, the traffic is bad, so I usually take the train to work. In the future I want to travel to Japan and practise my English there.";

/** Collects uncaught page errors so a test can assert the app never crashed. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message.slice(0, 160)}`));
  return errors;
}

export async function signUpAsGuest(page: Page, name = "Alex", languages: ("en" | "zh")[] = ["en", "zh"]) {
  await page.goto("/today");
  await page.waitForURL("**/login");
  await page.getByRole("button", { name: /Try without an account/ }).click();
  await page.waitForURL("**/onboarding");
  await page.getByLabel(/ชื่อที่ให้เราเรียก/).fill(name);
  await page.getByRole("button", { name: "ถัดไป" }).click();
  if (!languages.includes("zh")) await page.getByRole("button", { name: /ภาษาจีนกลาง/ }).click();
  await page.getByRole("button", { name: "ถัดไป" }).click();
  await page.getByRole("button", { name: "ถัดไป" }).click();
  await page.getByRole("button", { name: /เริ่มทดสอบวัดระดับ/ }).click();
  await page.waitForURL(`**/placement/${languages[0]}`);
}

/** Answers whatever exercise is on screen with a plausible response and submits it. */
export async function answerCurrent(page: Page, text = LONG_EN) {
  const main = page.locator("main");
  const submit = main.getByRole("button", { name: /^(ส่งคำตอบ|ส่งอีกครั้ง|Submit)$/ }).first();
  await expect(submit.or(main.getByRole("button", { name: /พิมพ์แทน|Type instead/ })).first()).toBeVisible();
  for (let attempt = 0; attempt < 3; attempt++) {
    await fillCurrent(page, text);
    if (await submit.isEnabled().catch(() => false)) break;
    await page.waitForTimeout(500);
  }
  await submit.click();
  // Wait for the answer to be processed (feedback shown, or the next item replaces this one).
  await expect(submit).toBeHidden({ timeout: 4_000 }).catch(() => undefined);
}

async function fillCurrent(page: Page, text: string) {
  const main = page.locator("main");
  const typeInstead = main.getByRole("button", { name: /พิมพ์แทน|Type instead/ });
  if (await typeInstead.isVisible().catch(() => false)) await typeInstead.click();

  const radios = main.getByRole("radio");
  if (await radios.count()) await radios.first().click();

  const selects = main.locator("select:not([id^=dur-])");
  for (let i = 0; i < (await selects.count()); i++) await selects.nth(i).selectOption({ index: i + 1 }).catch(() => selects.nth(i).selectOption({ index: 1 }));

  const bank = main.getByTestId("token-bank");
  if (await bank.count()) {
    const n = await bank.getByRole("button").count();
    for (let i = 0; i < n; i++) await bank.getByRole("button").nth(i).click();
  }

  const box = main.getByRole("textbox", { name: /คำตอบ|Answer/ });
  if ((await box.count()) && (await box.first().isEditable())) await box.first().fill(text);
}

export async function expectNoCrash(errors: string[], page: Page) {
  await expect(page.getByText(/Application error|เกิดข้อผิดพลาด/)).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
}
