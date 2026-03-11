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

// Whether to use the Stripe test bypass (no real Stripe API calls).
// Set STRIPE_TEST_BYPASS=true in CI or when running without Stripe test keys.
const stripeTestBypass = process.env.STRIPE_TEST_BYPASS ?? "true";

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

  // Global setup: runs once after webServer is started, before any tests.
  // Verifies API health and ensures test user accounts exist in the DB.
  globalSetup: "./e2e/global-setup.ts",

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

  webServer: [
    {
      // The API server loads its own .env automatically via NestJS ConfigModule.
      // We layer STRIPE_TEST_BYPASS on top so Playwright-spawned API processes
      // skip real Stripe API calls and return synthetic PaymentIntents instead.
      command: "pnpm --filter @rental-portal/api run start:dev",
      url: "http://localhost:3400/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: "development",
        STRIPE_TEST_BYPASS: stripeTestBypass,
        ALLOW_DEV_LOGIN: "true",
      },
    },
    {
      command: "pnpm run dev --host 127.0.0.1 --port 3401",
      url: "http://localhost:3401",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
