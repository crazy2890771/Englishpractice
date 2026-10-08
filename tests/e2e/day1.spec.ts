import { expect, test } from "@playwright/test";
import { startDemo, typeAnswer } from "./helpers";
import { lessons } from "../../src/content/curriculum";

const day1 = lessons[0]!;

test.describe("full Day 1 lesson in demo mode", () => {
  test.skip(({ isMobile }) => isMobile, "Full flow runs on desktop/tablet; mobile is covered by page tests.");

  test("completes all five steps based on real exercises", async ({ page }) => {
    test.setTimeout(300_000);
    await startDemo(page);
    await page.goto("/lesson/1");
    await expect(page.getByRole("heading", { name: /Day 1:/ })).toBeVisible();

    // Completion is evidence-based: nothing is done yet.
    await page.getByRole("button", { name: "Check completion" }).click();
    await expect(page.getByText(/Not finished yet: 0\/\d+ speaking turns/)).toBeVisible();

    // 1. Speaking — answer the AI's questions.
    const answers = [
      "I usually wake up at half past six and make a strong coffee before I check my schedule for the day.",
      "My wife work in a hospital, so she don't have breakfast with me on weekdays, but we eat together at the weekend.",
      "After breakfast I take the train to the airport, which takes about forty minutes, and I read the news on my phone.",
      "In the evening I like to cook something simple, and then I watch a series or call my parents for a quick chat.",
      "On my days off I sleep a little longer and go for a long walk by the river if the weather is nice.",
      "I think a good routine helps me feel calm, because I know what to expect even when work is very busy.",
    ];
    for (let i = 0; i < day1.completion.speakingTurns; i++) {
      await typeAnswer(page, answers[i]!);
      await expect(page.getByRole("button", { name: /correction|No errors/ }).nth(i)).toBeVisible();
    }
    await page.getByRole("button", { name: /correction|No errors/ }).nth(1).click();
    await expect(page.getByText("My wife works").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /1\. Speaking/ }).locator("svg.text-success")).toBeVisible();

    // 2. Listening — answer every question correctly.
    await page.getByRole("button", { name: /2\. Listening/ }).click();
    const ex = day1.listening.standard;
    for (const [qi, q] of ex.questions.entries()) {
      if (q.type === "fill") await page.getByLabel(`Answer for question ${qi + 1}`).fill(String(q.answer));
      else await page.locator(`input[name="${q.id}"]`).nth(Number(q.answer)).check({ force: true });
    }
    await page.getByRole("button", { name: "Check answers" }).click();
    await expect(page.getByText(`${ex.questions.length}/${ex.questions.length} · 100%`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible();

    // 3. Writing — submit 100+ words.
    await page.getByRole("button", { name: /3\. Writing/ }).click();
    const text = Array.from({ length: 9 }, (_, i) => `On day ${i + 1} of my routine I get up early, have a quick coffee and walk to work.`).join(" ");
    await page.getByLabel("Your writing").fill(text);
    await page.getByRole("button", { name: /check with ai/i }).click();
    await expect(page.getByText("Overall feedback")).toBeVisible();

    // 4. Shadowing — practise all sentences (typed fallback in headless browsers).
    await page.getByRole("button", { name: /4\. Shadowing/ }).click();
    for (let i = 0; i < day1.shadowing.length; i++) {
      await typeAnswer(page, day1.shadowing[i]!.text, /compare/i);
      await expect(page.getByText(/word accuracy/)).toBeVisible();
      if (i < day1.shadowing.length - 1) await page.getByRole("button", { name: /next sentence/i }).first().click();
    }

    // 5. Review — flashcards and mistakes.
    await page.getByRole("button", { name: /5\. Mistake review/ }).click();
    for (let i = 0; i < day1.completion.reviewItems; i++) {
      const reveal = page.getByRole("button", { name: /^Reveal$|Show answer/ }).first();
      await reveal.click();
      await page.getByRole("button", { name: "Good" }).click();
    }

    await expect(page.getByRole("heading", { name: "Day 1 complete!" })).toBeVisible();
    await page.screenshot({ path: `test-results/screens/${test.info().project.name}-day1-complete.png`, fullPage: true });

    // Progress persists across sessions (reload) and unlocks Day 2.
    await page.goto("/calendar");
    await expect(page.getByRole("link", { name: /Day 2/ }).first()).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByText("3%").first()).toBeVisible();
    await page.goto("/mistakes");
    await page.getByRole("tab", { name: "Notebook" }).click();
    await expect(page.getByText("she doesn't").first()).toBeVisible();
  });
});

test("baseline assessment produces comparable scores", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop/tablet only");
  test.setTimeout(180_000);
  await startDemo(page);
  await page.goto("/assessment");
  await page.getByRole("button", { name: "Begin" }).click();
  const speaking = [
    "My name is Alex and I work for an airline. On a normal day I get up early, check my roster and go to the airport by train.",
    "Last year I travelled to Japan with my brother. We visited Kyoto and Osaka, and the most memorable moment was seeing the temples at sunrise.",
    "I think working from home is good for focus, but the office is better for teamwork, so a mix of both is probably the best solution for most people.",
  ];
  for (const s of speaking) {
    await typeAnswer(page, s, /save answer/i);
    await page.getByRole("button", { name: "Next" }).click();
  }
  const radios = page.locator('input[type="radio"]');
  const names = await radios.evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLInputElement).name))]);
  for (const n of names) await page.locator(`input[name="${n}"]`).first().check({ force: true });
  for (const input of await page.getByLabel(/^Answer \d+$/).all()) await input.fill("x");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Your email").fill(Array.from({ length: 6 }, () => "Hi Sam, it has been a long time since we last met and I really miss our chats.").join(" "));
  await page.getByRole("button", { name: /submit assessment/i }).click();
  await expect(page.getByText(/Estimated level:/)).toBeVisible({ timeout: 60_000 });
  await page.goto("/progress/compare");
  await expect(page.getByRole("cell", { name: "Speaking" })).toBeVisible();
});
