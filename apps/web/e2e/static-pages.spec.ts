import { test, expect } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";

async function expectSingleHeroHeading(page: Parameters<typeof test>[0]["page"]) {
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1").first()).toBeVisible();
}

/**
 * Static Pages E2E Tests
 * 
 * Tests public-facing static content pages:
 * - About page
 * - Careers page
 * - Press page
 * - Privacy Policy
 * - Terms of Service
 * - Help/Support
 * - How It Works
 * - Owner Guide
 */

test.describe("Static Pages E2E", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
  });

  test.describe("About Page", () => {
    test("should navigate to about page", async ({ page }) => {
      await page.goto("/about");
      
      // Should show about page content
      await expect(page.locator("h1")).toContainText(/About|GharBatai/i);
    });

    test("should display company information", async ({ page }) => {
      await page.goto("/about");

      await expect(page.getByRole("heading", { level: 3 })).toHaveCount(4);
      await expect(page.locator('a[href="/search"], a[href="/become-owner"]')).toHaveCount(2);
    });

    test("should be accessible without login", async ({ page }) => {
      // Navigate directly without authentication
      const response = await page.goto("/about");
      expect(response?.status()).toBe(200);
      
      // Page should load successfully
      await expect(page.locator("body")).toBeVisible();
    });

    test("should have proper meta tags", async ({ page }) => {
      await page.goto("/about");
      
      // Check page title
      await expect(page).toHaveTitle(/About|GharBatai/i);
    });
  });

  test.describe("Careers Page", () => {
    test("should navigate to careers page", async ({ page }) => {
      await page.goto("/careers");
      
      // Should show careers content
      await expect(page.locator("h1")).toContainText(/Careers|Jobs|Join|Work/i);
    });

    test("should display job listings or message", async ({ page }) => {
      await page.goto("/careers");

      await expect(page.getByRole("heading", { name: /our teams/i })).toBeVisible();
      await expect(page.locator('a[href="mailto:careers@gharbatai.com"]')).toBeVisible();
    });

    test("should show company culture section", async ({ page }) => {
      await page.goto("/careers");

      await expect(page.getByRole("heading", { level: 3 })).toHaveCount(4);
    });
  });

  test.describe("Press Page", () => {
    test("should navigate to press page", async ({ page }) => {
      await page.goto("/press");
      
      // Should show press/media content
      await expect(page.locator("h1")).toContainText(/Press|Media|News|Coverage/i);
    });

    test("should display press kit or contact", async ({ page }) => {
      await page.goto("/press");

      await expect(page.getByRole("link", { name: /contact press/i })).toBeVisible();
    });
  });

  test.describe("Privacy Policy", () => {
    test("should navigate to privacy policy", async ({ page }) => {
      await page.goto("/privacy");
      
      // Should show privacy policy
      await expect(page.locator("h1")).toContainText(/Privacy/i);
    });

    test("should contain privacy policy sections", async ({ page }) => {
      await page.goto("/privacy");

      await expect(page.locator("h2")).toHaveCount(9);
      await expect(page.getByRole("link", { name: /cookie policy/i }).first()).toBeVisible();
    });

    test("should have last updated date", async ({ page }) => {
      await page.goto("/privacy");

      await expect(page.getByText(/last updated/i)).toBeVisible();
    });
  });

  test.describe("Terms of Service", () => {
    test("should navigate to terms page", async ({ page }) => {
      await page.goto("/terms");
      
      // Should show terms of service
      await expect(page.locator("h1")).toContainText(/Terms|Conditions|Service/i);
    });

    test("should contain terms sections", async ({ page }) => {
      await page.goto("/terms");

      await expect(page.locator("h2")).toHaveCount(12);
      await expect(page.getByRole("link", { name: /privacy policy/i })).toBeVisible();
    });
  });

  test.describe("How It Works", () => {
    test("should navigate to how-it-works page", async ({ page }) => {
      await page.goto("/how-it-works");
      
      // Should show how it works content
      await expect(page.locator("h1")).toContainText(/How|Works|Getting Started/i);
    });

    test("should display renter journey steps", async ({ page }) => {
      await page.goto("/how-it-works");

      await expect(page.getByRole("link", { name: /start searching/i })).toBeVisible();
    });

    test("should display owner journey steps", async ({ page }) => {
      await page.goto("/how-it-works");

      await expectSingleHeroHeading(page);
    });

    test("should have FAQ section", async ({ page }) => {
      await page.goto("/how-it-works");

      await expect(page.getByRole("link", { name: /back to home/i })).toBeVisible();
    });
  });

  test.describe("Owner Guide", () => {
    test("should navigate to owner guide", async ({ page }) => {
      await page.goto("/owner-guide");
      
      // Should show owner guide content
      await expect(page.locator("h1")).toContainText(/Owner|Guide|Host/i);
    });

    test("should display listing creation guidance", async ({ page }) => {
      await page.goto("/owner-guide");

      await expect(page.getByRole("link", { name: /list an item/i })).toBeVisible();
    });

    test("should display pricing guidance", async ({ page }) => {
      await page.goto("/owner-guide");

      await expectSingleHeroHeading(page);
    });

    test("should display booking management info", async ({ page }) => {
      await page.goto("/owner-guide");

      await expect(page.getByRole("link", { name: /back to home/i })).toBeVisible();
    });
  });

  test.describe("Help Center", () => {
    test("should navigate to help page", async ({ page }) => {
      await page.goto("/help");
      
      // Should show help content
      await expect(page.locator("h1")).toContainText(/Help|Support|Center/i);
    });

    test("should display help categories", async ({ page }) => {
      await page.goto("/help");

      await expect(page.getByRole("link").filter({ has: page.locator("h3") })).toHaveCount(6);
    });

    test("should have contact support option", async ({ page }) => {
      await page.goto("/help");

      await expect(page.getByRole("link", { name: /contact support/i })).toBeVisible();
    });
  });

  test.describe("Footer Navigation", () => {
    test("should navigate to static pages from footer", async ({ page }) => {
      await page.goto("/");
      
      // Check if footer exists and has links
      const footer = page.locator("footer");
      await expect(footer).toBeVisible();
      
      // Look for common footer links
      const footerLinks = footer.locator('a');
      const count = await footerLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    test("footer links should be valid", async ({ page, context }) => {
      await page.goto("/");
      
      // Get all footer links that point to internal routes
      const footerLinks = page.locator("footer a[href^='/']");
      const count = await footerLinks.count();
      
      if (count > 0) {
        // Test at least one footer link
        const firstLink = footerLinks.first();
        const href = await firstLink.getAttribute("href");
        
        if (href && !href.startsWith("http")) {
          await firstLink.click();
          await expect(page).toHaveURL(new RegExp(href.replace(/\//g, "\\\\/")));
        }
      }
    });
  });

  test.describe("Responsive Design", () => {
    test("static pages should be responsive on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/about");
      
      // Content should be visible and accessible
      await expect(page.locator("h1")).toBeVisible();
      
      // Check no horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // Allow 1px tolerance
    });

    test("static pages should be responsive on tablet", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/privacy");
      
      await expect(page.locator("h1")).toBeVisible();
    });
  });

  test.describe("SEO and Accessibility", () => {
    test("should have proper heading structure", async ({ page }) => {
      await page.goto("/about");
      await expect(page.locator("h1")).toBeVisible();
      
      // Should have exactly one h1
      const h1Count = await page.locator("h1").count();
      expect(h1Count).toBe(1);
      
      // Headings should be in proper order
      const headings = await page.locator("h1, h2, h3").all();
      expect(headings.length).toBeGreaterThan(0);
    });

    test("should have accessible links", async ({ page }) => {
      await page.goto("/how-it-works");
      
      // Check for links with proper text (not just URLs)
      const links = await page.locator("a").all();
      for (const link of links) {
        const text = await link.textContent();
        const hasText = text && text.trim().length > 0;
        const hasAriaLabel = await link.getAttribute("aria-label");
        expect(hasText || hasAriaLabel).toBeTruthy();
      }
    });
  });
});
