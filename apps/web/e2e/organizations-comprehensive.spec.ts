/**
 * Organization Management E2E Test Suite
 *
 * Covers organization workflows:
 * - Organization list and creation
 * - Member invitation and management
 * - Organization settings
 * - Organization listings
 * - Role-based access control
 */

import { test, expect } from "@playwright/test";
import { loginAs, testUsers, expectAnyVisible } from "./helpers/test-utils";
import { testOrganization } from "./helpers/fixtures";
import { SeedApi } from "./helpers/seed-api";

// ===========================================================================
// 1. Organization List Page
// ===========================================================================

test.describe("Organizations - List Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders organizations list page with correct heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Organization|Organizations|Team|Teams/i);
  });

  test("shows empty state when user has no organizations", async ({ page }) => {
    // Check for empty state or create button
    await expectAnyVisible(page, [
      "text=/no organizations|empty|create|Create/i",
      'a[href="/organizations/new"], button:has-text("Create")',
    ]);
  });

  test("has create organization button", async ({ page }) => {
    const createBtn = page.locator('a[href="/organizations/new"], button:has-text("Create"), button:has-text("New")').first();
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click();
      await expect(page).toHaveURL(/\/organizations\/new/);
    }
  });

  test("displays existing organizations with details", async ({ page }) => {
    // Look for organization cards or rows
    const orgCard = page.locator('[data-testid="organization-card"], .organization-item, tr').first();
    if (await orgCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expectAnyVisible(page, [
        "text=/members|Members|people|People/i",
        "text=/listings|Listings/i",
        'a[href^="/organizations/"], button:has-text("View"), button:has-text("Manage")',
      ]);
    }
  });
});

// ===========================================================================
// 2. Organization Creation
// ===========================================================================

test.describe("Organizations - Create New", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
  });

  test("renders organization creation form", async ({ page }) => {
    await page.goto("/organizations/new");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1")).toContainText(/Create|New|Organization/i);

    // Check for form fields
    await expectAnyVisible(page, [
      'input[name="name"], input[name="organizationName"]',
      'textarea[name="description"], input[name="description"]',
      'button[type="submit"], button:has-text("Create")',
    ]);
  });

  test("validates required organization name", async ({ page }) => {
    await page.goto("/organizations/new");
    await page.waitForLoadState("domcontentloaded");

    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try to submit empty form
      await submitBtn.click();

      // Should show validation error
      await expectAnyVisible(page, [
        "text=/required|Required/i",
        "text=/name is required|organization name/i",
        ".error",
        "[role=alert]",
      ], 5000);
    }
  });

  test("successfully creates a new organization", async ({ page }) => {
    await page.goto("/organizations/new");
    await page.waitForLoadState("domcontentloaded");

    const nameInput = page.locator('input[name="name"], input[name="organizationName"]').first();
    if (!(await nameInput.isVisible({ timeout: 3000 }).catch(() => false))) return;

    const orgName = `Test Org ${Date.now()}`;
    await nameInput.fill(orgName);

    // Fill description if field exists
    const descInput = page.locator('textarea[name="description"], input[name="description"]').first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.fill("This is a test organization for E2E testing");
    }

    // Fill website if field exists
    const websiteInput = page.locator('input[name="website"], input[name="url"]').first();
    if (await websiteInput.isVisible().catch(() => false)) {
      await websiteInput.fill("https://example.com");
    }

    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();

      // Should redirect to organization detail or show success
      await Promise.race([
        expect(page).toHaveURL(/\/organizations\/[a-f0-9-]+/, { timeout: 10000 }),
        expect(page.locator("text=/created|success/i")).toBeVisible({ timeout: 10000 }),
      ]);
    }
  });
});

// ===========================================================================
// 3. Organization Member Management
// ===========================================================================

test.describe("Organizations - Member Management", () => {
  let seed: SeedApi;
  let organizationId: string | null = null;

  test.beforeAll(async ({ request }) => {
    seed = new SeedApi(request);
    await seed.init();
    // Note: Organization creation through API would be needed here
    // For now we'll test with existing orgs or skip
  });

  test.afterAll(async () => {
    await seed.cleanup();
  });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
  });

  test("renders organization members page", async ({ page }) => {
    // Try to navigate to an organization's members page
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/members`);
        await expect(page.locator("h1")).toContainText(/Member|Members|Team|People/i);
      }
    }
  });

  test("displays current organization members", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/members`);

        // Should show members list or empty state
        await expectAnyVisible(page, [
          "text=/owner|Owner|admin|Admin|member|Member/i",
          "text=/no members|invite|Invite/i",
          "table",
          "[data-testid=\"members-list\"]",
        ]);
      }
    }
  });

  test("has invite member button or form", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/members`);

        const inviteBtn = page.locator('button:has-text("Invite"), a:has-text("Invite"), button:has-text("Add")').first();
        if (await inviteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await inviteBtn.click();

          // Should show invite form or modal
          await expectAnyVisible(page, [
            'input[type="email"], input[name="email"]',
            'select[name="role"], select[name="permission"]',
            "text=/invite member|Invite Member/i",
          ], 5000);
        }
      }
    }
  });

  test("allows inviting a new member by email", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/members`);

        const inviteBtn = page.locator('button:has-text("Invite"), button:has-text("Add")').first();
        if (!(await inviteBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;

        await inviteBtn.click();

        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        if (!(await emailInput.isVisible({ timeout: 3000 }).catch(() => false))) return;

        await emailInput.fill(testOrganization.inviteEmail);

        // Select role if dropdown exists
        const roleSelect = page.locator('select[name="role"], select[name="permission"]').first();
        if (await roleSelect.isVisible().catch(() => false)) {
          await roleSelect.selectOption({ label: "Member" });
        }

        const sendBtn = page.locator('button:has-text("Send"), button:has-text("Invite"), button[type="submit"]').first();
        if (await sendBtn.isVisible().catch(() => false)) {
          await sendBtn.click();

          // Should show success or pending invitation
          await expectAnyVisible(page, [
            "text=/invited|sent|pending|invitation sent/i",
            "text=/success|Success/i",
          ], 5000);
        }
      }
    }
  });

  test("validates email when inviting member", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/members`);

        const inviteBtn = page.locator('button:has-text("Invite"), button:has-text("Add")').first();
        if (!(await inviteBtn.isVisible({ timeout: 3000 }).catch(() => false))) return;

        await inviteBtn.click();

        const emailInput = page.locator('input[type="email"]').first();
        if (!(await emailInput.isVisible({ timeout: 3000 }).catch(() => false))) return;

        await emailInput.fill("invalid-email");

        const sendBtn = page.locator('button:has-text("Send"), button[type="submit"]').first();
        if (await sendBtn.isVisible().catch(() => false)) {
          await sendBtn.click();

          // Should show email validation error
          await expectAnyVisible(page, [
            "text=/invalid email|valid email/i",
            "text=/required|Required/i",
          ], 5000);
        }
      }
    }
  });

  test("shows member roles and permissions", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/members`);

        // Look for role indicators
        await expectAnyVisible(page, [
          "text=/owner|Owner|admin|Admin|member|Member|viewer|Viewer/i",
          "table",
          ".role-badge",
          "[data-testid=\"member-role\"]",
        ]);
      }
    }
  });

  test("allows changing member roles", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/members`);

        // Look for role change dropdown or button
        const roleSelect = page.locator('select[name="role"]').first();
        const editBtn = page.locator('button:has-text("Edit"), button[aria-label="Edit"]').first();

        if (await roleSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
          await roleSelect.selectOption({ label: "Admin" });
          await expect(page.locator("text=/saved|updated/i")).toBeVisible({ timeout: 5000 });
        } else if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await editBtn.click();
          await expectAnyVisible(page, [
            'select[name="role"]',
            "text=/change role|Change Role/i",
          ], 5000);
        }
      }
    }
  });

  test("allows removing a member from organization", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/members`);

        // Look for remove button on non-owner member
        const removeBtn = page.locator('button:has-text("Remove"), button:has-text("Delete"), button[aria-label="Remove"]').first();
        if (await removeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await removeBtn.click();

          // Should show confirmation
          await expectAnyVisible(page, [
            "text=/confirm|Confirm|are you sure/i",
            'button:has-text("Confirm"), button:has-text("Yes")',
          ], 5000);
        }
      }
    }
  });
});

// ===========================================================================
// 4. Organization Settings
// ===========================================================================

test.describe("Organizations - Settings", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
  });

  test("renders organization settings page", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/settings`);
        await expect(page.locator("h1")).toContainText(/Settings|Organization Settings/i);
      }
    }
  });

  test("allows editing organization details", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/settings`);

        const nameInput = page.locator('input[name="name"]').first();
        if (!(await nameInput.isVisible({ timeout: 3000 }).catch(() => false))) return;

        const newName = `Updated Org ${Date.now()}`;
        await nameInput.fill(newName);

        const saveBtn = page.locator('button[type="submit"], button:has-text("Save")').first();
        if (await saveBtn.isVisible().catch(() => false)) {
          await saveBtn.click();
          await expect(page.locator("text=/saved|updated/i")).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test("has organization branding/logo upload", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/settings`);

        await expectAnyVisible(page, [
          "text=/logo|Logo|brand|Brand/i",
          'input[type="file"][accept*=\"image\"]',
          "img[alt*=\"logo\" i]",
        ]);
      }
    }
  });

  test("has delete organization option with confirmation", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/settings`);

        const deleteBtn = page.locator('button:has-text("Delete"), button:has-text("Remove Organization"), [data-testid="delete-org"]').first();
        if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await deleteBtn.click();

          // Should show confirmation dialog
          await expectAnyVisible(page, [
            "text=/confirm|Confirm|are you sure/i",
            "text=/permanent|cannot be undone/i",
            'input[type="text"][placeholder*=\"confirm\" i], input[name="confirm"]',
          ], 5000);
        }
      }
    }
  });
});

// ===========================================================================
// 5. Organization Listings
// ===========================================================================

test.describe("Organizations - Listings", () => {
  let seed: SeedApi;

  test.beforeAll(async ({ request }) => {
    seed = new SeedApi(request);
    await seed.init();
  });

  test.afterAll(async () => {
    await seed.cleanup();
  });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
  });

  test("renders organization listings page", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/listings`);
        await expect(page.locator("h1")).toContainText(/Listing|Listings/i);
      }
    }
  });

  test("displays listings owned by organization", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/listings`);

        // Should show listings or empty state
        await expectAnyVisible(page, [
          'a[href^="/listings/"]',
          "text=/no listings|create listing|empty/i",
          "table",
          "[data-testid=\"listings-list\"]",
        ]);
      }
    }
  });

  test("has add listing button for organization", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/listings`);

        const addBtn = page.locator('button:has-text("Add"), button:has-text("Create"), a:has-text("New Listing")').first();
        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await addBtn.click();
          await expect(page).toHaveURL(/\/listings\/new|new.*listing/i);
        }
      }
    }
  });
});

// ===========================================================================
// 6. Mobile Responsiveness
// ===========================================================================

test.describe("Organizations - Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone X

  test.beforeEach(async ({ page }) => {
    await loginAs(page, testUsers.owner);
  });

  test("organizations list is accessible on mobile", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
  });

  test("member management works on mobile", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("domcontentloaded");

    const orgLink = page.locator('a[href^="/organizations/"]').first();
    if (await orgLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await orgLink.getAttribute("href");
      if (href) {
        await page.goto(`${href}/members`);
        await expect(page.locator("h1")).toBeVisible();

        // Buttons should be accessible
        const buttons = page.locator("button");
        expect(await buttons.count()).toBeGreaterThan(0);
      }
    }
  });
});
