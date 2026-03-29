import { defineConfig, devices } from "@playwright/test";

const includeDebugSuites = process.env.PLAYWRIGHT_INCLUDE_DEBUG === "true";
const includeExploratorySuites =
  process.env.PLAYWRIGHT_INCLUDE_EXPLORATORY === "true";
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
const resolvedBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || "http://localhost:3401";

// When PLAYWRIGHT_BASE_URL is set, external servers are pre-started (isolated
// mode).  Skip auto-launching webServer processes to avoid port conflicts and
// stale-server issues on teardown.
const useExternalServers = !!process.env.PLAYWRIGHT_BASE_URL;
const exploratorySuiteIgnores = [
  "**/file-upload-workflows-comprehensive.spec.ts",
  "**/help-support-comprehensive.spec.ts",
  "**/multi-language-comprehensive.spec.ts",
  "**/organization-management-comprehensive.spec.ts",
  "**/payment-integration-comprehensive.spec.ts",
  "**/profile-management.spec.ts",
  "**/profile-management-comprehensive.spec.ts",
  "**/stripe-payments.spec.ts",
  "**/websocket-realtime-comprehensive.spec.ts",
];

/**
 * Playwright configuration for E2E testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  testIgnore: [
    ...(includeDebugSuites
      ? []
      : ["**/debug-*.spec.ts", "**/diagnostic.spec.ts"]),
    ...(includeExploratorySuites ? [] : exploratorySuiteIgnores),
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // Use 1 worker to avoid parallel login conflicts causing server errors
  // Multiple workers trying to login as same user simultaneously causes DB contention
  workers: 1,
  reporter: [["html", { outputFolder: htmlReportOutput, open: "never" }]],
  outputDir: testOutputDir,

  // Global setup: runs once after webServer is started, before any tests.
  // Verifies API health and ensures test user accounts exist in the DB.
  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: resolvedBaseUrl,
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

  webServer: useExternalServers
    ? undefined
    : [
        {
          // The API server loads its own .env automatically via NestJS ConfigModule.
          // We layer STRIPE_TEST_BYPASS on top so Playwright-spawned API processes
          // skip real Stripe API calls and return synthetic PaymentIntents instead.
          command: "pnpm --filter @rental-portal/api run build && pnpm --filter @rental-portal/api run start",
          url: "http://localhost:3400/api/health/liveness",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            NODE_ENV: "test",
            STRIPE_TEST_BYPASS: stripeTestBypass,
            DEV_LOGIN_ENABLED: "true",
            DEV_LOGIN_SECRET: "dev-secret-123",
            DEV_LOGIN_ALLOWED_IPS: "127.0.0.1,localhost",
            DATABASE_URL:
              "postgresql://rental_user:rental_password@localhost:3433/rental_portal_e2e?schema=public",
            REDIS_HOST: "localhost",
            REDIS_PORT: "3480",
            DISABLE_THROTTLE: "true",
          },
        },
        {
          command: "pnpm run dev",
          url: "http://localhost:3401",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
