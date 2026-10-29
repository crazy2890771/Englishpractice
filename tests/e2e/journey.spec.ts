import { expect, test } from "@playwright/test";
import { answerCurrent, expectNoCrash, signUpAsGuest, watchErrors } from "./helpers";

test.describe.configure({ mode: "serial" });

test("new learner: sign-up → placement → separate EN/ZH levels → lesson with resume → summary → progress", async ({ page }) => {
  const errors = watchErrors(page);
  await signUpAsGuest(page, "Mali");

  // English placement: answer the listening section fully, skip the other skills.
  await page.getByRole("button", { name: "เริ่มทำแบบทดสอบ" }).click();
  await expect(page.getByRole("button", { name: "เริ่ม" }).first()).toBeVisible();
  await page.getByRole("button", { name: "เริ่ม" }).first().click();
  for (let i = 0; i < 20; i++) {
    const back = page.getByRole("button", { name: /ทักษะทั้งหมด/ });
    if (!(await back.isVisible().catch(() => false))) break;
    await expect(page.getByRole("button", { name: /^ส่งคำตอบ$/ }).or(page.getByRole("button", { name: /พิมพ์แทน/ }))).toBeVisible();
    await answerCurrent(page);
    await page.waitForLoadState("networkidle");
  }
  await expect(page.getByRole("img", { name: "เสร็จแล้ว" })).toHaveCount(1);
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: /^(เริ่ม|ทำต่อ)$/ }).first().click();
    await page.getByRole("button", { name: /ข้ามทักษะนี้/ }).click();
  }
  // Results: per-skill estimates, labelled unofficial.
  await expect(page.getByText(/ไม่ใช่ผลสอบ|Unofficial|ไม่เป็นทางการ/).first()).toBeVisible({ timeout: 30_000 });

  // Chinese: start from the beginning without a test.
  await page.goto("/placement/zh");
  await page.getByRole("button", { name: /เริ่มเรียนจากพื้นฐาน/ }).click();
  await page.waitForURL("**/today");

  await page.goto("/learn/zh");
  await expect(page.getByText("HSK1").first()).toBeVisible();
  await page.goto("/learn/en");
  await expect(page.getByText(/^(A1|A2|B1|B2|C1|C2)$/).first()).toBeVisible();
  await expect(page.getByText("HSK1")).toHaveCount(0);

  // Practice session: reading.
  await page.goto("/practice");
  await page.getByRole("radio", { name: "อังกฤษ" }).click();
  await page.getByRole("button", { name: "เริ่มฝึก" }).nth(2).click(); // reading card
  await page.waitForURL("**/session/**");
  const sessionUrl = page.url();

  await answerCurrent(page);
  await expect(page.getByText(/^(ถูกต้อง|ยังไม่ถูก)/).first()).toBeVisible();
  await page.getByRole("button", { name: /ถัดไป/ }).click();
  const progressBefore = await page.getByRole("progressbar", { name: "ความคืบหน้าบทเรียน" }).getAttribute("aria-valuenow");

  // Autosave + resume: reload and keep going from the same place.
  await page.waitForTimeout(1200);
  await page.reload();
  expect(page.url()).toBe(sessionUrl);
  await expect(page.getByRole("progressbar", { name: "ความคืบหน้าบทเรียน" })).toHaveAttribute("aria-valuenow", progressBefore ?? "0");

  for (let i = 0; i < 40; i++) {
    const finish = page.getByRole("button", { name: /จบบทเรียน/ });
    const submit = page.getByRole("button", { name: /^(ส่งคำตอบ|ส่งอีกครั้ง)$/ });
    if (await submit.isVisible().catch(() => false)) {
      await answerCurrent(page);
      await page.waitForLoadState("networkidle");
    }
    if (await finish.isVisible().catch(() => false)) {
      await finish.click();
      break;
    }
    await page.getByRole("button", { name: /ถัดไป/ }).click();
  }
  await expect(page.getByText(/จบบทเรียนแล้ว|ผ่านแบบทดสอบ/).first()).toBeVisible({ timeout: 30_000 });

  // Progress dashboard shows real data.
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "พัฒนาการ" })).toBeVisible();
  await expect(page.getByText(/ระดับแยกตามทักษะ/)).toBeVisible();
  await expectNoCrash(errors, page);
});

test("mobile navigation, profile preferences and schedule editing work", async ({ page }) => {
  const errors = watchErrors(page);
  await signUpAsGuest(page, "Nok", ["en"]);
  await page.getByRole("button", { name: /เริ่มเรียนจากพื้นฐาน/ }).click();
  await page.waitForURL("**/today");

  const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
  await expect(nav).toBeVisible();
  for (const [label, path] of [["บทเรียน", "/learn"], ["ฝึกฝน", "/practice"], ["พัฒนาการ", "/progress"], ["โปรไฟล์", "/profile"], ["วันนี้", "/today"]] as const) {
    await nav.getByRole("link", { name: label }).click();
    await page.waitForURL(`**${path}`);
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }

  // Preferences.
  await page.goto("/profile");
  await page.getByRole("radiogroup", { name: "เวลาเรียนต่อครั้ง" }).getByRole("radio", { name: "45" }).click();
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText("บันทึกแล้ว")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "เวลาเรียนต่อครั้ง" }).getByRole("radio", { name: "45" })).toHaveAttribute("aria-checked", "true");

  // Schedule: turn Sunday into a rest day and save.
  const sunday = page.locator("#schedule").locator("div.rounded-xl.border").first();
  await sunday.getByRole("button", { name: "ลบ" }).click();
  await page.getByRole("button", { name: "บันทึกตาราง" }).click();
  await expect(page.getByText("บันทึกตารางเรียนแล้ว")).toBeVisible();
  await page.reload();
  await expect(page.locator("#schedule").locator("div.rounded-xl.border").first().getByText("วันพัก")).toBeVisible();

  // Data export downloads JSON.
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /ดาวน์โหลด/ }).click();
  expect((await download).suggestedFilename()).toMatch(/fluency-lab-export-.*\.json/);
  await expectNoCrash(errors, page);
});

test("signed-out visitors are redirected to login and APIs reject them", async ({ page, request }) => {
  await page.goto("/progress");
  await page.waitForURL("**/login");
  const r = await request.get("/api/profile/export");
  expect(r.status()).toBe(401);
});
