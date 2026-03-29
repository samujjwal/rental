import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/test-utils";

type AdminEntityCase = {
  path: string;
  heading: RegExp;
};

const ENTITY_CASES: AdminEntityCase[] = [
  { path: "/admin/entities/users", heading: /Users/i },
  { path: "/admin/entities/listings", heading: /Listings/i },
  { path: "/admin/entities/bookings", heading: /Bookings/i },
  { path: "/admin/entities/payments", heading: /Payments/i },
  { path: "/admin/entities/organizations", heading: /Organizations/i },
];

function routePattern(path: string): RegExp {
  return new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[?#])`);
}

async function openAdminPath(page: Page, path: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });

    if (response) {
      expect(response.status()).toBeLessThan(500);
    }

    await page.waitForLoadState("domcontentloaded");

    if (!/\/auth\/login/.test(page.url())) {
      await expect(page).toHaveURL(routePattern(path));
      await expect(page.locator("body")).toBeVisible();
      return;
    }

    await loginAsAdmin(page);
  }

  await expect(page).toHaveURL(routePattern(path));
}

async function expectEntityTable(page: Page, heading: RegExp) {
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await expect(page.locator('[data-testid="data-table"]')).toBeVisible();
  await expect(page.getByPlaceholder("Search...")).toBeVisible();
  await expect(page.getByRole("button", { name: /Add New/i })).toBeVisible();
}

async function maybeAssertRowActions(page: Page) {
  const rows = page.locator('[data-testid="data-table"] tbody tr');
  const rowCount = await rows.count();

  if (rowCount > 0) {
    await expect(page.locator('button[title="View"], button[aria-label="view"]').first()).toBeVisible();
    await expect(page.locator('button[title="Edit"], button[aria-label="edit"]').first()).toBeVisible();
    await expect(page.locator('button[title="Delete"], button[aria-label="delete"]').first()).toBeVisible();
  }
}

async function openFirstDisputeIfPresent(page: Page): Promise<boolean> {
  const disputeCard = page.locator('[data-testid="dispute-card"]').first();
  const visible = await disputeCard.isVisible().catch(() => false);

  if (!visible) {
    return false;
  }

  await disputeCard.click();
  await expect(page.locator('[data-testid="dispute-details"]')).toBeVisible();
  return true;
}

test.describe("Admin dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openAdminPath(page, "/admin");
  });

  test("renders the dashboard overview with key metrics", async ({ page }) => {
    await expect(page.locator('[data-testid="platform-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-listings"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-bookings"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-disputes"]')).toBeVisible();
  });

  test("navigates to analytics and diagnostics from the admin shell", async ({ page }) => {
    await page.locator('a[href="/admin/analytics"]').first().click();
    await expect(page).toHaveURL(routePattern("/admin/analytics"));
    await expect(page.getByRole("heading", { level: 1, name: /Analytics/i })).toBeVisible();

    await page.locator('a[href="/admin/diagnostics"]').first().click();
    await expect(page).toHaveURL(routePattern("/admin/diagnostics"));
    await expect(page.getByRole("heading", { level: 1, name: /System Diagnostics/i })).toBeVisible();
  });

  test("exposes quick-action links to core admin surfaces", async ({ page }) => {
    for (const path of [
      "/admin/entities/users",
      "/admin/disputes",
      "/admin/system/power-operations",
    ]) {
      await expect(page.locator(`a[href="${path}"]`).first()).toBeVisible();
    }
  });
});

test.describe("Admin entity management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const entityCase of ENTITY_CASES) {
    test(`renders ${entityCase.path}`, async ({ page }) => {
      await openAdminPath(page, entityCase.path);
      await expectEntityTable(page, entityCase.heading);
      await maybeAssertRowActions(page);
    });
  }

  test("opens the create form from the users entity page", async ({ page }) => {
    await openAdminPath(page, "/admin/entities/users");
    await expectEntityTable(page, /Users/i);

    await page.getByRole("button", { name: /Add New/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Create/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cancel/i })).toBeVisible();

    await page.getByRole("button", { name: /Cancel/i }).click();
    await expectEntityTable(page, /Users/i);
  });
});

test.describe("Admin dispute management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openAdminPath(page, "/admin/disputes");
  });

  test("renders dispute filters and list state", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: /Dispute Management/i })).toBeVisible();
    await expect(page.locator('[data-testid="filter-open"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-in-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-resolved"]')).toBeVisible();
    await expect(page.locator('[data-testid="type-filter"]')).toBeVisible();
    await expect(page.getByLabel(/Search disputes/i)).toBeVisible();

    const hasCards = (await page.locator('[data-testid="dispute-card"]').count()) > 0;
    if (!hasCards) {
      await expect(page.getByText(/no disputes/i)).toBeVisible();
    }
  });

  test("updates the selected dispute status filter tab", async ({ page }) => {
    const reviewButton = page.locator('[data-testid="filter-in-progress"]');
    await reviewButton.click();
    await expect(reviewButton).toHaveClass(/bg-primary/);

    const resolvedButton = page.locator('[data-testid="filter-resolved"]');
    await resolvedButton.click();
    await expect(resolvedButton).toHaveClass(/bg-primary/);
  });

  test("opens dispute details when a dispute exists", async ({ page }) => {
    const opened = await openFirstDisputeIfPresent(page);

    if (!opened) {
      await expect(page.getByText(/no disputes/i)).toBeVisible();
      return;
    }

    await expect(page.locator('[data-testid="evidence-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="dispute-messages"]')).toBeVisible();
    await expect(page.locator('[data-testid="assign-dispute-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="add-note-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-dispute-message-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="resolve-dispute-button"]')).toBeVisible();
  });
});

test.describe("Admin system pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("renders the system settings hub with grouped links", async ({ page }) => {
    await openAdminPath(page, "/admin/system");
    await expect(page.getByRole("heading", { level: 1, name: /System Settings/i })).toBeVisible();
    await expect(page.locator('a[href="/admin/system/general"]').first()).toBeVisible();
    await expect(page.locator('a[href="/admin/system/power-operations"]').first()).toBeVisible();
    await expect(page.locator('a[href="/admin/system/logs"]').first()).toBeVisible();
  });

  test("renders general settings form fields", async ({ page }) => {
    await openAdminPath(page, "/admin/system/general");
    await expect(page.getByRole("heading", { level: 1, name: /General Settings/i })).toBeVisible();
    await expect(page.locator('input[name="siteName"]')).toBeVisible();
    await expect(page.locator('input[name="supportEmail"]')).toBeVisible();
    await expect(page.locator('input[name="commissionRate"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /Save/i })).toBeVisible();
  });

  test("renders power operations controls", async ({ page }) => {
    await openAdminPath(page, "/admin/system/power-operations");
    await expect(page.getByRole("heading", { level: 1, name: /Power Operations/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Fetch Logs/i })).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("renders audit log page controls", async ({ page }) => {
    await openAdminPath(page, "/admin/system/audit");
    await expect(page.getByRole("heading", { level: 1, name: /Audit Logs/i })).toBeVisible();
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    await expect(page.locator('input[type="text"]').nth(1)).toBeVisible();
  });
});