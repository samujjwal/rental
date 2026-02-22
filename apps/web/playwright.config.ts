import { defineConfig, devices } from "@playwright/test";

const includeDebugSuites = process.env.PLAYWRIGHT_INCLUDE_DEBUG === "true";
const htmlReportOutput =
  process.env.PLAYWRIGHT_HTML_REPORT ||
  (process.env.CI
    ? "playwright-report"
    : "/tmp/rental-playwright/playwright-report");
const testOutputDir =
  process.env.PLAYWRIGHT_OUTPUT_DIR ||
  (process.env.CI ? "test-results" : "/tmp/rental-playwright/test-results");

/**
 * Playwright configuration for E2E testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  testIgnore: includeDebugSuites
    ? []
    : ["**/debug-*.spec.ts", "**/diagnostic.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Use 1 worker to avoid parallel login conflicts causing server errors
  // Multiple workers trying to login as same user simultaneously causes DB contention
  workers: 1,
  reporter: [["html", { outputFolder: htmlReportOutput, open: "never" }]],
  outputDir: testOutputDir,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3401",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Ensure test isolation - each test starts with clean state
    storageState: { cookies: [], origins: [] },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  webServer: {
    command: "pnpm run dev --host 127.0.0.1 --port 3401",
    url: "http://localhost:3401",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
