import { test, expect } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";

/**
 * Content Management E2E Tests
 * 
 * Tests content management functionality:
 * - Content editing
 * - Content publishing
 * - Content versioning
 * - Content localization
 * - Content SEO optimization
 * - Content approval workflows
 * - Content scheduling
 * - Content analytics
 */

test.describe("Content Management E2E", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
  });

  test.describe("Content Editing", () => {
    test("should access content management dashboard", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to content management
      await page.click('a[href="/admin/content"]');
      await page.waitForURL("/admin/content");

      // Should show content management interface
      await expect(page.locator("h1")).toContainText(/Content|Management/i);
      await expect(page.locator('[data-testid="content-list"]')).toBeVisible();
    });

    test("should create new content", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to content creation
      await page.goto("/admin/content/new");

      // Fill content form
      await page.fill('input[name="title"]', "Test Blog Post");
      await page.fill('textarea[name="excerpt"]', "This is a test blog post excerpt");
      await page.fill('[data-testid="content-editor"]', "This is the main content of the blog post.");
      
      // Set content type
      await page.selectOption('select[name="contentType"]', "blog");
      
      // Save as draft
      await page.click('button[data-testid="save-draft"]');
      
      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText(/saved|draft/i);
    });

    test("should edit existing content", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to content list
      await page.goto("/admin/content");
      
      // Find and edit first content item
      await page.click('[data-testid="content-item"]:first-child [data-testid="edit-button"]');
      
      // Modify content
      await page.fill('input[name="title"]', "Updated Blog Post Title");
      await page.fill('[data-testid="content-editor"]', "Updated content with new information.");
      
      // Save changes
      await page.click('button[data-testid="save-changes"]');
      
      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-message"]')).toContainText(/updated|saved/i);
    });

    test("should handle rich text editing", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Create new content with rich text
      await page.goto("/admin/content/new");
      
      // Use rich text editor
      await page.click('[data-testid="bold-button"]');
      await page.type('[data-testid="content-editor"]', "Bold text");
      await page.keyboard.press('Enter');
      
      await page.click('[data-testid="italic-button"]');
      await page.type('[data-testid="content-editor"]', "Italic text");
      await page.keyboard.press('Enter');
      
      await page.click('[data-testid="link-button"]');
      await page.fill('input[placeholder="URL"]', "https://example.com");
      await page.fill('input[placeholder="Link text"]', "Example Link");
      await page.click('button[data-testid="insert-link"]');
      
      // Should see formatted content
      await expect(page.locator('[data-testid="content-editor"] strong')).toContainText("Bold text");
      await expect(page.locator('[data-testid="content-editor"] em')).toContainText("Italic text");
      await expect(page.locator('[data-testid="content-editor"] a')).toContainText("Example Link");
    });

    test("should upload and manage media", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Create content with media
      await page.goto("/admin/content/new");
      
      // Upload image
      await page.click('[data-testid="upload-media"]');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('test-files/test-image.jpg');
      
      // Should show uploaded image
      await expect(page.locator('[data-testid="media-preview"] img')).toBeVisible();
      
      // Add alt text for accessibility
      await page.fill('input[name="altText"]', "Test image description");
      
      // Save content
      await page.fill('input[name="title"]', "Content with Image");
      await page.click('button[data-testid="save-draft"]');
      
      // Should show success
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    });
  });

  test.describe("Content Publishing", () => {
    test("should publish content immediately", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Create and publish content
      await page.goto("/admin/content/new");
      await page.fill('input[name="title"]', "Published Blog Post");
      await page.fill('[data-testid="content-editor"]', "This content is published immediately.");
      
      // Publish immediately
      await page.click('button[data-testid="publish-now"]');
      
      // Should show published status
      await expect(page.locator('[data-testid="published-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="published-status"]')).toContainText(/published|live/i);
      
      // Verify content is publicly accessible
      await page.goto("/blog/published-blog-post");
      await expect(page.locator("h1")).toContainText("Published Blog Post");
      await expect(page.locator('[data-testid="content-body"]')).toContainText("This content is published immediately.");
    });

    test("should schedule content for future publishing", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Create scheduled content
      await page.goto("/admin/content/new");
      await page.fill('input[name="title"]', "Scheduled Blog Post");
      await page.fill('[data-testid="content-editor"]', "This content is scheduled for future publishing.");
      
      // Set publish date
      await page.click('[data-testid="schedule-publish"]');
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      await page.fill('input[name="publishDate"]', futureDate.toISOString().split('T')[0]);
      
      // Save scheduled content
      await page.click('button[data-testid="schedule-content"]');
      
      // Should show scheduled status
      await expect(page.locator('[data-testid="scheduled-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="scheduled-status"]')).toContainText(/scheduled/i);
      
      // Content should not be publicly accessible yet
      const response = await page.goto("/blog/scheduled-blog-post");
      expect(response?.status()).toBe(404);
    });

    test("should handle content approval workflow", async ({ page }) => {
      // Login as content editor
      await page.goto("/login");
      await page.fill('input[name="email"]', "editor@gharbatai.com");
      await page.fill('input[name="password"]', "editor123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Create content requiring approval
      await page.goto("/admin/content/new");
      await page.fill('input[name="title"]', "Content Requiring Approval");
      await page.fill('[data-testid="content-editor"]', "This content needs admin approval.");
      
      // Submit for approval
      await page.click('button[data-testid="submit-for-approval"]');
      
      // Should show pending approval status
      await expect(page.locator('[data-testid="pending-approval"]')).toBeVisible();
      
      // Logout and login as admin
      await page.click('[data-testid="logout"]');
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to approval queue
      await page.goto("/admin/content/approvals");
      
      // Should see pending content
      await expect(page.locator('[data-testid="pending-item"]')).toContainText("Content Requiring Approval");
      
      // Approve content
      await page.click('[data-testid="approve-button"]:first-child');
      
      // Should show approved status
      await expect(page.locator('[data-testid="approved-status"]')).toBeVisible();
    });

    test("should handle content rejection with feedback", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to approval queue
      await page.goto("/admin/content/approvals");
      
      // Reject content with feedback
      await page.click('[data-testid="reject-button"]:first-child');
      await page.fill('textarea[name="rejectionReason"]', "Please add more details to this content.");
      await page.click('button[data-testid="confirm-rejection"]');
      
      // Should show rejection status
      await expect(page.locator('[data-testid="rejected-status"]')).toBeVisible();
      
      // Logout and login as editor
      await page.click('[data-testid="logout"]');
      await page.goto("/login");
      await page.fill('input[name="email"]', "editor@gharbatai.com");
      await page.fill('input[name="password"]', "editor123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Should see rejection feedback
      await page.goto("/admin/content");
      await expect(page.locator('[data-testid="rejection-feedback"]')).toContainText("Please add more details");
    });
  });

  test.describe("Content Versioning", () => {
    test("should track content versions", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Create initial content
      await page.goto("/admin/content/new");
      await page.fill('input[name="title"]', "Versioned Content");
      await page.fill('[data-testid="content-editor"]', "Initial version of content.");
      await page.click('button[data-testid="save-draft"]');

      // Edit content to create new version
      await page.fill('[data-testid="content-editor"]', "Updated version with new information.");
      await page.click('button[data-testid="save-changes"]');

      // Navigate to version history
      await page.click('[data-testid="version-history"]');
      
      // Should show version history
      await expect(page.locator('[data-testid="version-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="version-item"]')).toHaveCount(2);
      
      // Should show version details
      await expect(page.locator('[data-testid="version-item"]:first-child')).toContainText(/version 1/i);
      await expect(page.locator('[data-testid="version-item"]:last-child')).toContainText(/version 2/i);
    });

    test("should restore previous versions", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to existing content with versions
      await page.goto("/admin/content");
      await page.click('[data-testid="content-item"]:first-child [data-testid="edit-button"]');
      
      // Go to version history
      await page.click('[data-testid="version-history"]');
      
      // Restore previous version
      await page.click('[data-testid="version-item"]:first-child [data-testid="restore-button"]');
      await page.click('button[data-testid="confirm-restore"]');
      
      // Should show restored content
      await expect(page.locator('[data-testid="content-editor"]')).toContainText("Initial version of content.");
      await expect(page.locator('[data-testid="restore-message"]')).toBeVisible();
    });

    test("should compare content versions", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to content with versions
      await page.goto("/admin/content");
      await page.click('[data-testid="content-item"]:first-child [data-testid="edit-button"]');
      
      // Go to version history
      await page.click('[data-testid="version-history"]');
      
      // Select versions to compare
      await page.check('[data-testid="version-item"]:first-child [data-testid="compare-checkbox"]');
      await page.check('[data-testid="version-item"]:last-child [data-testid="compare-checkbox"]');
      await page.click('[data-testid="compare-versions"]');
      
      // Should show version comparison
      await expect(page.locator('[data-testid="version-comparison"]')).toBeVisible();
      await expect(page.locator('[data-testid="diff-view"]')).toBeVisible();
      await expect(page.locator('[data-testid="added-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="removed-content"]')).toBeVisible();
    });
  });

  test.describe("Content Localization", () => {
    test("should create content in multiple languages", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Create content in English
      await page.goto("/admin/content/new");
      await page.fill('input[name="title"]', "Multilingual Content");
      await page.fill('[data-testid="content-editor"]', "This is English content.");
      await page.selectOption('select[name="language"]', "en");
      await page.click('button[data-testid="save-draft"]');

      // Add Nepali translation
      await page.click('[data-testid="add-translation"]');
      await page.selectOption('select[name="translationLanguage"]', "ne");
      await page.fill('input[name="translatedTitle"]', "बहुभाषिक सामग्री");
      await page.fill('[data-testid="translated-content"]', "यो नेपाली सामग्री हो।");
      await page.click('button[data-testid="save-translation"]');

      // Should show translation saved
      await expect(page.locator('[data-testid="translation-saved"]')).toBeVisible();
      
      // Should show available translations
      await expect(page.locator('[data-testid="translation-list"]')).toContainText("English");
      await expect(page.locator('[data-testid="translation-list"]')).toContainText("नेपाली");
    });

    test("should display localized content to users", async ({ page }) => {
      // Set language preference to Nepali
      await page.goto("/settings/language");
      await page.selectOption('select[name="preferredLanguage"]', "ne");
      await page.click('button[data-testid="save-language"]');

      // Navigate to localized content
      await page.goto("/blog/multilingual-content");
      
      // Should show Nepali content
      await expect(page.locator("h1")).toContainText("बहुभाषिक सामग्री");
      await expect(page.locator('[data-testid="content-body"]')).toContainText("यो नेपाली सामग्री हो।");
      
      // Switch to English
      await page.click('[data-testid="language-switcher"]');
      await page.click('button[data-testid="switch-to-en"]');
      
      // Should show English content
      await expect(page.locator("h1")).toContainText("Multilingual Content");
      await expect(page.locator('[data-testid="content-body"]')).toContainText("This is English content.");
    });

    test("should handle RTL languages", async ({ page }) => {
      // Set language to Arabic (RTL)
      await page.goto("/settings/language");
      await page.selectOption('select[name="preferredLanguage"]', "ar");
      await page.click('button[data-testid="save-language"]');

      // Navigate to Arabic content
      await page.goto("/blog/arabic-content");
      
      // Should apply RTL styling
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('[data-testid="content-body"]')).toHaveCSS('direction', 'rtl');
      
      // Should show Arabic content
      await expect(page.locator("h1")).toContainText(/[\u0600-\u06FF]/); // Arabic characters
    });
  });

  test.describe("Content SEO", () => {
    test("should optimize content for SEO", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Create SEO-optimized content
      await page.goto("/admin/content/new");
      await page.fill('input[name="title"]', "SEO Optimized Blog Post");
      await page.fill('textarea[name="seoDescription"]', "This is an SEO-optimized blog post about rental properties in Nepal.");
      await page.fill('input[name="seoKeywords"]', "rental, nepal, property, kathmandu, pokhara");
      await page.fill('[data-testid="content-editor"]', "Comprehensive content about rental properties in Nepal with relevant keywords.");
      
      // Set SEO settings
      await page.fill('input[name="slug"]', "seo-optimized-blog-post");
      await page.check('input[name="enableIndexing"]');
      await page.fill('input[name="ogTitle"]', "SEO Optimized Blog Post - GharBatai Nepal");
      await page.fill('textarea[name="ogDescription"]', "Discover rental properties in Nepal with our comprehensive guide.");
      
      // Save content
      await page.click('button[data-testid="save-draft"]');

      // Check SEO preview
      await page.click('[data-testid="seo-preview"]');
      
      // Should show SEO preview
      await expect(page.locator('[data-testid="google-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="google-preview"]')).toContainText("SEO Optimized Blog Post");
      await expect(page.locator('[data-testid="google-preview"]')).toContainText("This is an SEO-optimized blog post");
      
      // Should show social media preview
      await expect(page.locator('[data-testid="facebook-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="twitter-preview"]')).toBeVisible();
    });

    test("should validate SEO requirements", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Create content with SEO issues
      await page.goto("/admin/content/new");
      await page.fill('input[name="title"]', "Short"); // Too short for SEO
      await page.fill('textarea[name="seoDescription"]', "Short"); // Too short
      await page.fill('[data-testid="content-editor"]', "Minimal content without keywords.");
      
      // Check SEO analysis
      await page.click('[data-testid="seo-analysis"]');
      
      // Should show SEO warnings
      await expect(page.locator('[data-testid="seo-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="seo-warning"]')).toContainText(/title too short/i);
      await expect(page.locator('[data-testid="seo-warning"]')).toContainText(/description too short/i);
      await expect(page.locator('[data-testid="seo-warning"]')).toContainText(/missing keywords/i);
      
      // Should show SEO score
      await expect(page.locator('[data-testid="seo-score"]')).toBeVisible();
      await expect(page.locator('[data-testid="seo-score"]')).toContainText(/\d+\/100/i);
    });

    test("should generate XML sitemap", async ({ page }) => {
      // Access sitemap
      const response = await page.goto("/sitemap.xml");
      expect(response?.status()).toBe(200);
      
      // Should be valid XML
      const content = await page.content();
      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(content).toContain('<urlset');
      expect(content).toContain('<url>');
      expect(content).toContain('<loc>');
      expect(content).toContain('</urlset>');
      
      // Should include content URLs
      expect(content).toContain('/blog/');
      expect(content).toContain('/about');
      expect(content).toContain('/help');
    });
  });

  test.describe("Content Analytics", () => {
    test("should show content performance metrics", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to content analytics
      await page.goto("/admin/content/analytics");
      
      // Should show analytics dashboard
      await expect(page.locator("h1")).toContainText(/Content Analytics|Performance/i);
      await expect(page.locator('[data-testid="analytics-overview"]')).toBeVisible();
      
      // Should show key metrics
      await expect(page.locator('[data-testid="total-views"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-engagement"]')).toBeVisible();
      await expect(page.locator('[data-testid="average-time-on-page"]')).toBeVisible();
      
      // Should show content performance list
      await expect(page.locator('[data-testid="content-performance"]')).toBeVisible();
      await expect(page.locator('[data-testid="performance-item"]')).toHaveCount.greaterThan(0);
    });

    test("should show individual content analytics", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to content list
      await page.goto("/admin/content");
      
      // Click analytics for first content item
      await page.click('[data-testid="content-item"]:first-child [data-testid="analytics-button"]');
      
      // Should show detailed analytics
      await expect(page.locator('[data-testid="content-analytics"]')).toBeVisible();
      await expect(page.locator('[data-testid="views-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="engagement-metrics"]')).toBeVisible();
      
      // Should show traffic sources
      await expect(page.locator('[data-testid="traffic-sources"]')).toBeVisible();
      await expect(page.locator('[data-testid="source-item"]')).toHaveCount.greaterThan(0);
    });

    test("should export analytics data", async ({ page }) => {
      // Login as admin
      await page.goto("/login");
      await page.fill('input[name="email"]', "admin@gharbatai.com");
      await page.fill('input[name="password"]', "admin123");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");

      // Navigate to content analytics
      await page.goto("/admin/content/analytics");
      
      // Export data
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-analytics"]');
      const download = await downloadPromise;
      
      // Should download CSV file
      expect(download.suggestedFilename()).toMatch(/analytics.*\.csv$/i);
    });
  });
});
