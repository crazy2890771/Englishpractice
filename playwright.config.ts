import { defineConfig, devices } from "@playwright/test";

/** End-to-end tests run against a production build (`npm run build`) and the local Supabase stack. */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure", screenshot: "only-on-failure", locale: "th-TH", timezoneId: "Asia/Bangkok" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: /desktop\.spec\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /desktop\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run start", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 120_000 },
});
