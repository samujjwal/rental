import { defineConfig, devices } from '@playwright/test';

/**
 * Visual Regression Testing Configuration
 * 
 * Captures screenshots of critical UI components and pages,
 * comparing against baselines to detect unintended visual changes.
 */
export default defineConfig({
  testDir: './e2e/visual',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report/visual' }],
    ['json', { outputFile: 'playwright-report/visual-results.json' }],
  ],
  
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.WEB_URL || 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Viewport size for consistent screenshots
    viewport: { width: 1280, height: 720 },
    
    // Visual comparison options
    ignoreHTTPSErrors: true,
  },

  // Snapshot directory for visual baselines
  snapshotDir: './e2e/visual/__snapshots__',
  
  // Maximum time one test can run
  timeout: 30000,
  
  expect: {
    // Maximum time expect() should wait for the condition to be met
    timeout: 5000,
    
    // Visual comparison threshold (0.2 = 0.2% difference allowed)
    toHaveScreenshot: {
      maxDiffPixels: 100,
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
    },
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        // Ensure consistent rendering
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
      },
    },
    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari'],
      },
    },
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
      },
    },
    {
      name: 'tablet-ipad',
      use: { 
        ...devices['iPad (gen 7) landscape'],
      },
    },
  ],

  // Run local dev server before starting the tests
  webServer: {
    command: 'cd ../web && npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
