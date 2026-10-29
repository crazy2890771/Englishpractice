import { expect, test } from "@playwright/test";
import { answerCurrent, expectNoCrash, signUpAsGuest, watchErrors } from "./helpers";

test("desktop: Chinese track, vocabulary review and EN/ZH progress switch", async ({ page }) => {
  const errors = watchErrors(page);
  await signUpAsGuest(page, "Ploy");
  await page.getByRole("button", { name: /เริ่มเรียนจากพื้นฐาน/ }).click();
  await page.waitForURL("**/today");
  await page.goto("/placement/zh");
  await page.getByRole("button", { name: /เริ่มเรียนจากพื้นฐาน/ }).click();
  await page.waitForURL("**/today");

  // Side rail navigation on desktop.
  await expect(page.getByRole("complementary").getByRole("link", { name: "บทเรียน" })).toBeVisible();

  // Chinese vocabulary practice (adds unit words to the SRS deck).
  await page.goto("/practice");
  await page.getByRole("radio", { name: "จีน" }).click();
  await page.getByRole("button", { name: "เริ่มฝึก" }).nth(4).click();
  await page.waitForURL("**/session/**");
  await answerCurrent(page, "你好");
  await expect(page.getByText(/^(ถูกต้อง|ยังไม่ถูก)/).first().or(page.getByText("บันทึกคำตอบแล้ว"))).toBeVisible();

  // Vocabulary review page lists due cards from the Chinese unit.
  await page.goto("/review");
  await expect(page.locator("main")).toContainText(/คำศัพท์|ทบทวน/);

  // Progress: language switch shows each language separately.
  await page.goto("/progress?lang=zh");
  await expect(page.getByRole("link", { name: "จีน" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "อังกฤษ" }).click();
  await expect(page.getByRole("link", { name: "อังกฤษ" })).toHaveAttribute("aria-current", "page");
  await expectNoCrash(errors, page);
});
