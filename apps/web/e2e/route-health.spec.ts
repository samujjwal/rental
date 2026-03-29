import { test, expect, type Page } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";
import { loginAsAdmin, loginAsOwner, loginAsRenter } from "./helpers/test-utils";

type RouteExpectation = {
  path: string;
  expectedUrl: RegExp;
};

const PUBLIC_ROUTES: RouteExpectation[] = [
  { path: "/", expectedUrl: routePattern("/") },
  { path: "/about", expectedUrl: routePattern("/about") },
  { path: "/careers", expectedUrl: routePattern("/careers") },
  { path: "/press", expectedUrl: routePattern("/press") },
  { path: "/how-it-works", expectedUrl: routePattern("/how-it-works") },
  { path: "/insurance", expectedUrl: routePattern("/insurance") },
  { path: "/owner-guide", expectedUrl: routePattern("/owner-guide") },
  { path: "/earnings", expectedUrl: routePattern("/earnings") },
  { path: "/help", expectedUrl: routePattern("/help") },
  { path: "/contact", expectedUrl: routePattern("/contact") },
  { path: "/safety", expectedUrl: routePattern("/safety") },
  { path: "/terms", expectedUrl: routePattern("/terms") },
  { path: "/privacy", expectedUrl: routePattern("/privacy") },
  { path: "/cookies", expectedUrl: routePattern("/cookies") },
  { path: "/auth/login", expectedUrl: routePattern("/auth/login") },
  { path: "/auth/signup", expectedUrl: routePattern("/auth/signup") },
  { path: "/auth/forgot-password", expectedUrl: routePattern("/auth/forgot-password") },
  {
    path: "/auth/reset-password?token=test-token",
    expectedUrl: /\/auth\/reset-password(?:\?|$)/,
  },
  { path: "/search", expectedUrl: routePattern("/search") },
  { path: "/listings", expectedUrl: routePattern("/listings") },
];

const RENTER_ROUTES: RouteExpectation[] = [
  { path: "/dashboard", expectedUrl: /\/dashboard(?:\/renter)?(?:$|[?#])/ },
  { path: "/dashboard/renter", expectedUrl: routePattern("/dashboard/renter") },
  { path: "/bookings", expectedUrl: routePattern("/bookings") },
  { path: "/messages", expectedUrl: routePattern("/messages") },
  { path: "/favorites", expectedUrl: routePattern("/favorites") },
  { path: "/become-owner", expectedUrl: routePattern("/become-owner") },
  { path: "/disputes", expectedUrl: routePattern("/disputes") },
  { path: "/payments", expectedUrl: routePattern("/payments") },
  { path: "/reviews", expectedUrl: routePattern("/reviews") },
  { path: "/settings", expectedUrl: routePattern("/settings/profile") },
  { path: "/settings/profile", expectedUrl: routePattern("/settings/profile") },
  { path: "/settings/notifications", expectedUrl: routePattern("/settings/notifications") },
  { path: "/insurance/upload", expectedUrl: routePattern("/insurance/upload") },
  { path: "/organizations", expectedUrl: routePattern("/organizations") },
  { path: "/organizations/new", expectedUrl: routePattern("/organizations/new") },
];

const OWNER_ROUTES: RouteExpectation[] = [
  { path: "/dashboard/owner", expectedUrl: routePattern("/dashboard/owner") },
  { path: "/dashboard/owner/calendar", expectedUrl: routePattern("/dashboard/owner/calendar") },
  { path: "/dashboard/owner/earnings", expectedUrl: routePattern("/dashboard/owner/earnings") },
  { path: "/dashboard/owner/insights", expectedUrl: routePattern("/dashboard/owner/insights") },
  { path: "/dashboard/owner/performance", expectedUrl: routePattern("/dashboard/owner/performance") },
  { path: "/listings/new", expectedUrl: routePattern("/listings/new") },
];

const ADMIN_ROUTES: RouteExpectation[] = [
  { path: "/admin", expectedUrl: routePattern("/admin") },
  { path: "/admin/analytics", expectedUrl: routePattern("/admin/analytics") },
  { path: "/admin/entities/users", expectedUrl: routePattern("/admin/entities/users") },
  { path: "/admin/entities/listings", expectedUrl: routePattern("/admin/entities/listings") },
  { path: "/admin/entities/bookings", expectedUrl: routePattern("/admin/entities/bookings") },
  { path: "/admin/entities/payments", expectedUrl: routePattern("/admin/entities/payments") },
  { path: "/admin/entities/organizations", expectedUrl: routePattern("/admin/entities/organizations") },
  { path: "/admin/disputes", expectedUrl: routePattern("/admin/disputes") },
  { path: "/admin/system", expectedUrl: routePattern("/admin/system") },
  { path: "/admin/system/general", expectedUrl: routePattern("/admin/system/general") },
  { path: "/admin/system/database", expectedUrl: routePattern("/admin/system/database") },
  { path: "/admin/system/notifications", expectedUrl: routePattern("/admin/system/notifications") },
  { path: "/admin/system/security", expectedUrl: routePattern("/admin/system/security") },
  { path: "/admin/system/api-keys", expectedUrl: routePattern("/admin/system/api-keys") },
  { path: "/admin/system/backups", expectedUrl: routePattern("/admin/system/backups") },
  { path: "/admin/system/email", expectedUrl: routePattern("/admin/system/email") },
  { path: "/admin/system/environment", expectedUrl: routePattern("/admin/system/environment") },
  { path: "/admin/system/logs", expectedUrl: routePattern("/admin/system/logs") },
  { path: "/admin/system/audit", expectedUrl: routePattern("/admin/system/audit") },
  { path: "/admin/system/power-operations", expectedUrl: routePattern("/admin/system/power-operations") },
  { path: "/admin/diagnostics", expectedUrl: routePattern("/admin/diagnostics") },
];

function routePattern(path: string): RegExp {
  if (path === "/") {
    return /\/(?:$|[?#])/;
  }

  return new RegExp(`${escapeForRegex(path)}(?:$|[?#])`);
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function openAndAssertRoute(
  page: Page,
  route: RouteExpectation,
  options: { allowLoginRedirect?: boolean } = {}
) {
  const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });

  if (response) {
    expect(response.status()).toBeLessThan(500);
  }

  await page.waitForLoadState("domcontentloaded");

  if (options.allowLoginRedirect && /\/auth\/login/.test(page.url())) {
    await expect(page).toHaveURL(/\/auth\/login(?:$|[?#])/);
  } else {
    await expect(page).toHaveURL(route.expectedUrl);
  }

  await expect(page.locator("body")).toBeVisible();
}

test.describe("Route Health", () => {
  test.describe("public routes", () => {
    for (const route of PUBLIC_ROUTES) {
      test(`loads ${route.path}`, async ({ page }) => {
        await openAndAssertRoute(page, route);
      });
    }

    test("loads a seeded listing detail route", async ({ page }) => {
      const { listing } = await ensureSeedData(page);
      await openAndAssertRoute(page, {
        path: `/listings/${listing.id}`,
        expectedUrl: routePattern(`/listings/${listing.id}`),
      });
    });
  });

  test.describe("anonymous access control", () => {
    for (const route of [
      { path: "/dashboard/renter", expectedUrl: /\/auth\/login(?:$|[?#])/ },
      { path: "/organizations", expectedUrl: /\/auth\/login(?:$|[?#])/ },
      { path: "/admin", expectedUrl: /\/auth\/login(?:$|[?#])/ },
    ]) {
      test(`redirects ${route.path} to login`, async ({ page }) => {
        await openAndAssertRoute(page, route, { allowLoginRedirect: true });
      });
    }
  });

  test.describe("renter routes", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsRenter(page);
    });

    for (const route of RENTER_ROUTES) {
      test(`loads ${route.path}`, async ({ page }) => {
        await openAndAssertRoute(page, route);
      });
    }
  });

  test.describe("owner routes", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsOwner(page);
    });

    for (const route of OWNER_ROUTES) {
      test(`loads ${route.path}`, async ({ page }) => {
        await openAndAssertRoute(page, route);
      });
    }
  });

  test.describe("admin routes", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    for (const route of ADMIN_ROUTES) {
      test(`loads ${route.path}`, async ({ page }) => {
        await openAndAssertRoute(page, route);
      });
    }
  });
});