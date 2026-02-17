import baseConfig from "./playwright.config";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  ...baseConfig,
  webServer: undefined,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath:
            "/Users/samujjwal/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell",
        },
      },
    },
  ],
});
