import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./work/playwright-results",
  fullyParallel: true,
  workers: 3,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "work/playwright-results/report.json" }],
    ["html", { outputFolder: "work/playwright-report", open: "never" }]
  ],
  use: {
    baseURL: process.env.SANDI_TEST_URL || "https://www.sandi50th.com",
    ignoreHTTPSErrors: false,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  projects: [
    { name: "iPhone-SE-WebKit", use: { ...devices["iPhone SE"], browserName: "webkit" } },
    { name: "iPhone-15-WebKit", use: { ...devices["iPhone 15"], browserName: "webkit" } },
    { name: "Pixel-7-Chromium", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "Desktop-Chromium", use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    { name: "Desktop-Firefox", use: { ...devices["Desktop Firefox"], browserName: "firefox", viewport: { width: 1440, height: 900 } } },
    { name: "Desktop-WebKit", use: { ...devices["Desktop Safari"], browserName: "webkit", viewport: { width: 1440, height: 900 } } }
  ]
});

