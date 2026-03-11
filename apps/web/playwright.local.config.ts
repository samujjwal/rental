import baseConfig from "./playwright.config";
import { defineConfig, devices } from "@playwright/test";

/**
 * Local development config — runs a single Chromium instance against a
 * pre-started dev server (webServer is disabled).
 *
 * Set the CHROMIUM_PATH environment variable to override the Chromium binary:
 *   CHROMIUM_PATH=/path/to/chrome npx playwright test -c playwright.local.config.ts
 */
export default defineConfig({
  ...baseConfig,
  webServer: undefined,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
});
