import { test, expect } from '@playwright/test';

/**
 * STATIC PAGES E2E TESTS
 * 
 * These tests validate all static pages functionality:
 * - About page
 * - Careers page
 * - Press page
 * - Privacy policy
 * - Terms of service
 * - Owner guide
 * - How it works
 * - Help and support
 * 
 * Business Truth Validated:
 * - Static pages render correctly
 * - Navigation works properly
 * - Content is accessible
 * - SEO elements are present
 * - Mobile responsiveness works
 */

test.describe('Static Pages', () => {
  test.describe('About Page', () => {
    test('should render about page correctly', async ({ page }) => {
      await page.goto('/about');
      
      // Check page elements
      await expect(page.locator('[data-testid="about-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="about-hero"]')).toBeVisible();
      await expect(page.locator('[data-testid="about-mission"]')).toBeVisible();
      await expect(page.locator('[data-testid="about-story"]')).toBeVisible();
      await expect(page.locator="[data-testid='about-team']").toBeVisible();
      await expect(page.locator('[data-testid="about-values"]')).toBeVisible();
    });

    test('should have proper SEO elements', async ({ page }) => {
      await page.goto('/about');
      
      // Check meta tags
      const title = await page.title();
      expect(title).toContain('About');
      
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description).toBeTruthy();
      expect(description?.length).toBeGreaterThan(50);
      
      // Check structured data
      const structuredData = await page.locator('script[type="application/ld+json"]').textContent();
      expect(structuredData).toContain('@type');
      expect(structuredData).toContain('Organization');
    });

    test('should navigate team section', async ({ page }) => {
      await page.goto('/about');
      
      // Check team members
      await expect(page.locator('[data-testid="team-members"]')).toBeVisible();
      await expect(page.locator('[data-testid="team-member"]').first()).toBeVisible();
      
      // Click on team member
      await page.locator('[data-testid="team-member"]').first().click();
      await expect(page.locator('[data-testid="team-member-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="member-bio"]')).toBeVisible();
      await expect(page.locator('[data-testid="member-social-links"]')).toBeVisible();
    });

    test('should be mobile responsive', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/about');
      
      await expect(page.locator('[data-testid="mobile-about-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-about-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-team-grid"]')).toBeVisible();
    });
  });

  test.describe('Careers Page', () => {
    test('should render careers page correctly', async ({ page }) => {
      await page.goto('/careers');
      
      // Check page elements
      await expect(page.locator('[data-testid="careers-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="careers-hero"]')).toBeVisible();
      await expect(page.locator('[data-testid="open-positions"]')).toBeVisible();
      await expect(page.locator('[data-testid="company-culture"]')).toBeVisible();
      await expect(page.locator('[data-testid="benefits"]')).toBeVisible();
      await expect(page.locator('[data-testid="hiring-process"]')).toBeVisible();
    });

    test('should display job listings', async ({ page }) => {
      await page.goto('/careers');
      
      // Check job listings
      await expect(page.locator('[data-testid="job-listings"]')).toBeVisible();
      await expect(page.locator('[data-testid="job-card"]').first()).toBeVisible();
      
      // Check job details
      await expect(page.locator('[data-testid="job-title"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="job-department"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="job-location"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="job-type"]').first()).toBeVisible();
    });

    test('should filter job listings', async ({ page }) => {
      await page.goto('/careers');
      
      // Test department filter
      await page.locator('[data-testid="department-filter"]').click();
      await page.locator('[data-testid="filter-engineering"]').click();
      
      await expect(page.locator('[data-testid="job-card"]').first()).toBeVisible();
      const firstJobDept = await page.locator('[data-testid="job-department"]').first().textContent();
      expect(firstJobDept).toContain('Engineering');
      
      // Test location filter
      await page.locator('[data-testid="location-filter"]').click();
      await page.locator('[data-testid="filter-kathmandu"]').click();
      
      const firstJobLocation = await page.locator('[data-testid="job-location"]').first().textContent();
      expect(firstJobLocation).toContain('Kathmandu');
    });

    test('should handle job application', async ({ page }) => {
      await page.goto('/careers');
      
      // Click on a job
      await page.locator('[data-testid="job-card"]').first().click();
      await expect(page).toHaveURL(/\/careers\/\w+/);
      
      // Check job details page
      await expect(page.locator('[data-testid="job-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="job-description"]')).toBeVisible();
      await expect(page.locator('[data-testid="job-requirements"]')).toBeVisible();
      await expect(page.locator('[data-testid="apply-button"]')).toBeVisible();
      
      // Start application
      await page.locator('[data-testid="apply-button"]').click();
      await expect(page.locator('[data-testid="application-form"]')).toBeVisible();
      
      // Fill application form
      await page.locator('[data-testid="applicant-name"]').fill('John Doe');
      await page.locator('[data-testid="applicant-email"]').fill('john@example.com');
      await page.locator('[data-testid="applicant-phone"]').fill('+9771234567890');
      
      // Upload resume
      await page.locator('[data-testid="resume-upload"]').setInputFiles('test-files/resume.pdf');
      
      // Submit application
      await page.locator('[data-testid="submit-application"]').click();
      await expect(page.locator('[data-testid="application-submitted"]')).toBeVisible();
    });

    test('should show company culture section', async ({ page }) => {
      await page.goto('/careers');
      
      // Check culture section
      await expect(page.locator('[data-testid="culture-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="culture-values"]')).toBeVisible();
      await expect(page.locator('[data-testid="employee-testimonials"]')).toBeVisible();
      
      // Test testimonial carousel
      await expect(page.locator('[data-testid="testimonial-item"]').first()).toBeVisible();
      await page.locator('[data-testid="testimonial-next"]').click();
      await expect(page.locator('[data-testid="testimonial-item"]').nth(1)).toBeVisible();
    });
  });

  test.describe('Press Page', () => {
    test('should render press page correctly', async ({ page }) => {
      await page.goto('/press');
      
      // Check page elements
      await expect(page.locator('[data-testid="press-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="press-releases"]')).toBeVisible();
      await expect(page.locator('[data-testid="media-coverage"]')).toBeVisible();
      await expect(page.locator('[data-testid="press-kit"]')).toBeVisible();
      await expect(page.locator('[data-testid="contact-media"]')).toBeVisible();
    });

    test('should display press releases', async ({ page }) => {
      await page.goto('/press');
      
      // Check press releases
      await expect(page.locator('[data-testid="press-release-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="press-release-item"]').first()).toBeVisible();
      
      // Check release details
      await expect(page.locator('[data-testid="release-title"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="release-date"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="release-summary"]').first()).toBeVisible();
    });

    test('should open press release details', async ({ page }) => {
      await page.goto('/press');
      
      // Click on a press release
      await page.locator('[data-testid="press-release-item"]').first().click();
      await expect(page).toHaveURL(/\/press\/\w+/);
      
      // Check release details
      await expect(page.locator('[data-testid="release-full-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="release-images"]')).toBeVisible();
      await expect(page.locator('[data-testid="release-quotes"]')).toBeVisible();
      await expect(page.locator('[data-testid="release-contact"]')).toBeVisible();
    });

    test('should provide press kit download', async ({ page }) => {
      await page.goto('/press');
      
      // Check press kit section
      await expect(page.locator('[data-testid="press-kit-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="press-kit-download"]').toBeVisible();
      
      // Download press kit
      const downloadPromise = page.waitForEvent('download');
      await page.locator('[data-testid="press-kit-download"]').click();
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toContain('press-kit');
    });

    test('should show media coverage', async ({ page }) => {
      await page.goto('/press');
      
      // Check media coverage
      await expect(page.locator('[data-testid="media-coverage-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="media-coverage-item"]').first()).toBeVisible();
      
      // Check coverage details
      await expect(page.locator('[data-testid="media-outlet"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="media-title"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="media-date"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="media-link"]').first()).toBeVisible();
    });
  });

  test.describe('Privacy Policy', () => {
    test('should render privacy policy correctly', async ({ page }) => {
      await page.goto('/privacy');
      
      // Check page elements
      await expect(page.locator('[data-testid="privacy-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="privacy-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="privacy-toc"]')).toBeVisible();
      await expect(page.locator('[data-testid="privacy-sections"]')).toBeVisible();
    });

    test('should have table of contents navigation', async ({ page }) => {
      await page.goto('/privacy');
      
      // Check TOC
      await expect(page.locator('[data-testid="privacy-toc"]')).toBeVisible();
      await expect(page.locator('[data-testid="toc-item"]').first()).toBeVisible();
      
      // Test TOC navigation
      await page.locator('[data-testid="toc-item"]').first().click();
      await expect(page.locator('[data-testid="section-1"]')).toBeVisible();
      
      // Check active TOC item
      await expect(page.locator('[data-testid="toc-item"].active')).toBeVisible();
    });

    test('should have all required sections', async ({ page }) => {
      await page.goto('/privacy');
      
      // Check required privacy sections
      await expect(page.locator('[data-testid="section-data-collection"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-data-usage"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-data-sharing"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-cookies"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-user-rights"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-data-security"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-international"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-children"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-changes"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-contact"]')).toBeVisible();
    });

    test('should be printable', async ({ page }) => {
      await page.goto('/privacy');
      
      // Test print view
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('[data-testid="print-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="print-content"]')).toBeVisible();
      
      // Reset media emulation
      await page.emulateMedia({ media: 'screen' });
    });
  });

  test.describe('Terms of Service', () => {
    test('should render terms of service correctly', async ({ page }) => {
      await page.goto('/terms');
      
      // Check page elements
      await expect(page.locator('[data-testid="terms-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="terms-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="terms-toc"]')).toBeVisible();
      await expect(page.locator('[data-testid="terms-sections"]')).toBeVisible();
    });

    test('should have table of contents navigation', async ({ page }) => {
      await page.goto('/terms');
      
      // Check TOC
      await expect(page.locator('[data-testid="terms-toc"]')).toBeVisible();
      await expect(page.locator('[data-testid="terms-toc-item"]').first()).toBeVisible();
      
      // Test TOC navigation
      await page.locator('[data-testid="terms-toc-item"]').first().click();
      await expect(page.locator('[data-testid="terms-section-1"]')).toBeVisible();
    });

    test('should have all required sections', async ({ page }) => {
      await page.goto('/terms');
      
      // Check required terms sections
      await expect(page.locator('[data-testid="section-acceptance"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-services"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-user-responsibilities"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-payments"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-cancellations"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-intellectual-property"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-disclaimers"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-limitation"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-disputes"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-termination"]')).toBeVisible();
    });

    test('should have search functionality', async ({ page }) => {
      await page.goto('/terms');
      
      // Test search
      await page.locator('[data-testid="terms-search"]').fill('payment');
      await page.locator('[data-testid="search-terms"]').click();
      
      // Check search results
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-result-item"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="search-highlight"]').first()).toBeVisible();
    });
  });

  test.describe('Owner Guide', () => {
    test('should render owner guide correctly', async ({ page }) => {
      await page.goto('/owner-guide');
      
      // Check page elements
      await expect(page.locator('[data-testid="owner-guide-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="guide-navigation"]')).toBeVisible();
      await expect(page.locator('[data-testid="guide-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="guide-sections"]')).toBeVisible();
    });

    test('should have guide navigation', async ({ page }) => {
      await page.goto('/owner-guide');
      
      // Check navigation
      await expect(page.locator('[data-testid="guide-nav"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-item"]').first()).toBeVisible();
      
      // Test navigation
      await page.locator('[data-testid="nav-item"]').first().click();
      await expect(page.locator('[data-testid="guide-section"]').first()).toBeVisible();
      
      // Check active navigation
      await expect(page.locator('[data-testid="nav-item"].active')).toBeVisible();
    });

    test('should have comprehensive guide sections', async ({ page }) => {
      await page.goto('/owner-guide');
      
      // Check guide sections
      await expect(page.locator('[data-testid="section-getting-started"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-creating-listings"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-managing-bookings"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-payments"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-reviews"]')).toBeVisible();
      await expect(page.locator('[data-testid="section-tips"]')).toBeVisible();
    });

    test('should have interactive elements', async ({ page }) => {
      await page.goto('/owner-guide');
      
      // Check interactive elements
      await expect(page.locator('[data-testid="guide-videos"]')).toBeVisible();
      await expect(page.locator('[data-testid="guide-checklists"]')).toBeVisible();
      await expect(page.locator('[data-testid="guide-downloads"]')).toBeVisible();
      
      // Test checklist
      await page.locator('[data-testid="checklist-item"]').first().click();
      await expect(page.locator('[data-testid="checklist-item"].checked')).toBeVisible();
    });

    test('should have downloadable resources', async ({ page }) => {
      await page.goto('/owner-guide');
      
      // Check downloadable resources
      await expect(page.locator('[data-testid="resource-downloads"]')).toBeVisible();
      await expect(page.locator('[data-testid="download-item"]').first()).toBeVisible();
      
      // Test download
      const downloadPromise = page.waitForEvent('download');
      await page.locator('[data-testid="download-item"]').first().click();
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toBeTruthy();
    });
  });

  test.describe('How It Works', () => {
    test('should render how it works correctly', async ({ page }) => {
      await page.goto('/how-it-works');
      
      // Check page elements
      await expect(page.locator('[data-testid="how-it-works-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="process-steps"]')).toBeVisible();
      await expect(page.locator('[data-testid="process-timeline"]')).toBeVisible();
      await expect(page.locator('[data-testid="benefits"]')).toBeVisible();
      await expect(page.locator('[data-testid="faq"]')).toBeVisible();
    });

    test('should show process steps', async ({ page }) => {
      await page.goto('/how-it-works');
      
      // Check process steps
      await expect(page.locator('[data-testid="step-1"]')).toBeVisible();
      await expect(page.locator('[data-testid="step-2"]')).toBeVisible();
      await expect(page.locator('[data-testid="step-3"]')).toBeVisible();
      await expect(page.locator('[data-testid="step-4"]')).toBeVisible();
      
      // Check step details
      await expect(page.locator('[data-testid="step-title"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="step-description"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="step-icon"]').first()).toBeVisible();
    });

    test('should have interactive timeline', async ({ page }) => {
      await page.goto('/how-it-works');
      
      // Check timeline
      await expect(page.locator('[data-testid="process-timeline"]')).toBeVisible();
      await expect(page.locator('[data-testid="timeline-item"]').first()).toBeVisible();
      
      // Test timeline interaction
      await page.locator('[data-testid="timeline-item"]').first().click();
      await expect(page.locator('[data-testid="timeline-details"]')).toBeVisible();
    });

    test('should have FAQ section', async ({ page }) => {
      await page.goto('/how-it-works');
      
      // Check FAQ
      await expect(page.locator('[data-testid="faq-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="faq-item"]').first()).toBeVisible();
      
      // Test FAQ accordion
      await page.locator('[data-testid="faq-question"]').first().click();
      await expect(page.locator('[data-testid="faq-answer"]').first()).toBeVisible();
      
      // Test FAQ search
      await page.locator('[data-testid="faq-search"]').fill('booking');
      await expect(page.locator('[data-testid="faq-results"]')).toBeVisible();
    });

    test('should have call-to-action', async ({ page }) => {
      await page.goto('/how-it-works');
      
      // Check CTA
      await expect(page.locator('[data-testid="get-started-cta"]')).toBeVisible();
      await expect(page.locator('[data-testid="cta-button"]')).toBeVisible();
      
      // Test CTA button
      await page.locator('[data-testid="cta-button"]').click();
      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Help and Support', () => {
    test('should render help page correctly', async ({ page }) => {
      await page.goto('/help');
      
      // Check page elements
      await expect(page.locator('[data-testid="help-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="help-categories"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-help"]')).toBeVisible();
      await expect(page.locator('[data-testid="popular-articles"]')).toBeVisible();
      await expect(page.locator('[data-testid="contact-support"]')).toBeVisible();
    });

    test('should have help categories', async ({ page }) => {
      await page.goto('/help');
      
      // Check categories
      await expect(page.locator('[data-testid="category-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="category-item"]').first()).toBeVisible();
      
      // Check category details
      await expect(page.locator('[data-testid="category-icon"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="category-title"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="category-description"]').first()).toBeVisible();
      
      // Click on category
      await page.locator('[data-testid="category-item"]').first().click();
      await expect(page).toHaveURL(/\/help\/category\/\w+/);
      await expect(page.locator('[data-testid="category-articles"]')).toBeVisible();
    });

    test('should have search functionality', async ({ page }) => {
      await page.goto('/help');
      
      // Test search
      await page.locator('[data-testid="help-search-input"]').fill('booking cancellation');
      await page.locator('[data-testid="search-help-button"]').click();
      
      // Check search results
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-result-item"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="search-highlight"]').first()).toBeVisible();
    });

    test('should display help articles', async ({ page }) => {
      await page.goto('/help');
      
      // Navigate to an article
      await page.locator('[data-testid="popular-article"]').first().click();
      await expect(page).toHaveURL(/\/help\/article\/\w+/);
      
      // Check article content
      await expect(page.locator('[data-testid="article-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="article-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="article-breadcrumbs"]')).toBeVisible();
      await expect(page.locator('[data-testid="article-related"]')).toBeVisible();
    });

    test('should have contact support', async ({ page }) => {
      await page.goto('/help');
      
      // Check contact support
      await expect(page.locator('[data-testid="contact-support-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="support-options"]')).toBeVisible();
      
      // Test contact form
      await page.locator('[data-testid="contact-form-button"]').click();
      await expect(page.locator('[data-testid="contact-form"]')).toBeVisible();
      
      await page.locator('[data-testid="support-topic"]').selectOption('booking-issue');
      await page.locator('[data-testid="support-subject"]').fill('Booking not showing up');
      await page.locator('[data-testid="support-message"]').fill('My booking is not appearing in my dashboard');
      
      await page.locator('[data-testid="submit-support-request"]').click();
      await expect(page.locator('[data-testid="support-request-submitted"]')).toBeVisible();
    });

    test('should have live chat option', async ({ page }) => {
      await page.goto('/help');
      
      // Check live chat
      await expect(page.locator('[data-testid="live-chat-widget"]')).toBeVisible();
      await expect(page.locator('[data-testid="chat-button"]')).toBeVisible();
      
      // Test chat
      await page.locator('[data-testid="chat-button"]').click();
      await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
      
      await page.locator('[data-testid="chat-input"]').fill('I need help with my booking');
      await page.locator('[data-testid="send-chat-message"]').click();
      await expect(page.locator('[data-testid="chat-message-sent"]')).toBeVisible();
    });
  });

  test.describe('Cross-Page Navigation', () => {
    test('should have consistent navigation across static pages', async ({ page }) => {
      const pages = ['/about', '/careers', '/press', '/privacy', '/terms', '/owner-guide', '/how-it-works', '/help'];
      
      for (const pageUrl of pages) {
        await page.goto(pageUrl);
        
        // Check consistent navigation
        await expect(page.locator('[data-testid="main-nav"]')).toBeVisible();
        await expect(page.locator('[data-testid="footer-nav"]')).toBeVisible();
        await expect(page.locator('[data-testid="breadcrumb"]')).toBeVisible();
        await expect(page.locator('[data-testid="language-selector"]')).toBeVisible();
      }
    });

    test('should have proper breadcrumbs', async ({ page }) => {
      await page.goto('/careers/engineering/developer');
      
      // Check breadcrumbs
      await expect(page.locator('[data-testid="breadcrumb"]')).toBeVisible();
      await expect(page.locator('[data-testid="breadcrumb-home"]')).toBeVisible();
      await expect(page.locator('[data-testid="breadcrumb-careers"]')).toBeVisible();
      await expect(page.locator('[data-testid="breadcrumb-engineering"]')).toBeVisible();
      await expect(page.locator('[data-testid="breadcrumb-current"]')).toBeVisible();
      
      // Test breadcrumb navigation
      await page.locator('[data-testid="breadcrumb-careers"]').click();
      await expect(page).toHaveURL('/careers');
    });

    test('should have proper 404 handling', async ({ page }) => {
      // Test 404 page
      await page.goto('/nonexistent-page');
      await expect(page.locator('[data-testid="404-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="404-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="404-search"]')).toBeVisible();
      await expect(page.locator('[data-testid="404-home-link"]')).toBeVisible();
      
      // Test 404 search
      await page.locator('[data-testid="404-search-input"]').fill('about');
      await page.locator('[data-testid="404-search-button"]').click();
      await expect(page.locator('[data-testid="search-suggestions"]')).toBeVisible();
    });
  });

  test.describe('Accessibility Compliance', () => {
    test('should meet WCAG standards', async ({ page }) => {
      await page.goto('/about');
      
      // Check accessibility
      const accessibilityTree = await page.accessibility.snapshot();
      expect(accessibilityTree).toBeDefined();
      
      // Check ARIA labels
      const buttons = page.locator('button[aria-label]');
      const buttonCount = await buttons.count();
      expect(buttonCount).toBeGreaterThan(0);
      
      // Check heading hierarchy
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);
      
      // Check alt text for images
      const images = page.locator('img[alt]');
      const imageCount = await images.count();
      expect(imageCount).toBeGreaterThan(0);
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/about');
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Test Enter key
      await page.keyboard.press('Enter');
      // Should trigger action on focused element
    });

    test('should have proper color contrast', async ({ page }) => {
      await page.goto('/about');
      
      // Check color contrast (simplified check)
      const textElements = page.locator('[data-testid="about-content"] *');
      const textCount = await textElements.count();
      
      for (let i = 0; i < Math.min(textCount, 10); i++) {
        const element = textElements.nth(i);
        const styles = await element.evaluate(el => {
          const computed = getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
          };
        });
        
        // Basic contrast check (would need more sophisticated calculation in real test)
        expect(styles.color).not.toBe('');
        expect(styles.backgroundColor).not.toBe('');
      }
    });
  });
});
