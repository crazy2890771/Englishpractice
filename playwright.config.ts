import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "ipad", use: { ...devices["iPad Pro 11"], browserName: "chromium" } },
    { name: "iphone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/welcome`,
    reuseExistingServer: true,
    // The suite creates many demo accounts quickly; raise the per-IP demo limit for the test server.
    env: { DEMO_RATE_LIMIT_PER_MINUTE: "100" },
    timeout: 120_000,
  },
});
