import { test, expect } from "@playwright/test";

type RouteCase = {
  path: string;
  kind: "public" | "protected";
};

const ROUTES: RouteCase[] = [
  { path: "/", kind: "public" },
  { path: "/about", kind: "public" },
  { path: "/careers", kind: "public" },
  { path: "/press", kind: "public" },
  { path: "/how-it-works", kind: "public" },
  { path: "/insurance", kind: "public" },
  { path: "/owner-guide", kind: "public" },
  { path: "/earnings", kind: "public" },
  { path: "/help", kind: "public" },
  { path: "/contact", kind: "public" },
  { path: "/safety", kind: "public" },
  { path: "/terms", kind: "public" },
  { path: "/privacy", kind: "public" },
  { path: "/cookies", kind: "public" },
  { path: "/auth/login", kind: "public" },
  { path: "/auth/signup", kind: "public" },
  { path: "/auth/forgot-password", kind: "public" },
  { path: "/auth/reset-password?token=test-token", kind: "public" },
  { path: "/search", kind: "public" },
  { path: "/listings", kind: "public" },
  { path: "/listings/1", kind: "public" },
  { path: "/dashboard", kind: "protected" },
  { path: "/dashboard/owner", kind: "protected" },
  { path: "/dashboard/owner/calendar", kind: "protected" },
  { path: "/dashboard/owner/earnings", kind: "protected" },
  { path: "/dashboard/owner/insights", kind: "protected" },
  { path: "/dashboard/owner/performance", kind: "protected" },
  { path: "/dashboard/renter", kind: "protected" },
  { path: "/bookings", kind: "protected" },
  { path: "/bookings/1", kind: "protected" },
  { path: "/checkout/1", kind: "protected" },
  { path: "/listings/new", kind: "protected" },
  { path: "/listings/1/edit", kind: "protected" },
  { path: "/messages", kind: "protected" },
  { path: "/favorites", kind: "protected" },
  { path: "/become-owner", kind: "protected" },
  { path: "/disputes", kind: "protected" },
  { path: "/disputes/1", kind: "protected" },
  { path: "/payments", kind: "protected" },
  { path: "/reviews", kind: "protected" },
  { path: "/settings", kind: "protected" },
  { path: "/insurance/upload", kind: "protected" },
  { path: "/disputes/new/1", kind: "protected" },
  { path: "/organizations", kind: "protected" },
  { path: "/organizations/create", kind: "protected" },
  { path: "/organizations/1/settings", kind: "protected" },
  { path: "/organizations/1/members", kind: "protected" },
  { path: "/organizations/1/listings", kind: "protected" },
  { path: "/profile/1", kind: "protected" },
  { path: "/settings/profile", kind: "protected" },
  { path: "/settings/notifications", kind: "protected" },
  { path: "/admin", kind: "protected" },
  { path: "/admin/analytics", kind: "protected" },
  { path: "/admin/entities/users", kind: "protected" },
  { path: "/admin/disputes", kind: "protected" },
  { path: "/admin/fraud", kind: "protected" },
  { path: "/admin/system", kind: "protected" },
  { path: "/admin/system/general", kind: "protected" },
  { path: "/admin/system/database", kind: "protected" },
  { path: "/admin/system/notifications", kind: "protected" },
  { path: "/admin/system/security", kind: "protected" },
  { path: "/admin/system/api-keys", kind: "protected" },
  { path: "/admin/system/backups", kind: "protected" },
  { path: "/admin/system/email", kind: "protected" },
  { path: "/admin/system/environment", kind: "protected" },
  { path: "/admin/system/logs", kind: "protected" },
  { path: "/admin/system/audit", kind: "protected" },
  { path: "/admin/system/power-operations", kind: "protected" },
];

test.describe("Route Health (Desktop + Mobile)", () => {
  for (const routeCase of ROUTES) {
    test(`loads ${routeCase.path}`, async ({ page }) => {
      const response = await page.goto(routeCase.path, {
        waitUntil: "domcontentloaded",
      });

      // React Router SPA routes often return 200 for initial document load.
      if (response) {
        expect(response.status()).toBeLessThan(500);
      }

      await page.waitForLoadState('domcontentloaded');

      const url = page.url();
      const onLogin = /\/auth\/login/.test(url);
      const onExpectedPath = url.includes(routeCase.path);
      const isDynamicDetail = /^\/(bookings|disputes|profile|checkout)\/[^/]+$/.test(
        routeCase.path
      );
      const parentPath = routeCase.path.substring(
        0,
        routeCase.path.lastIndexOf("/")
      );
      const onParentPath = isDynamicDetail && url.includes(parentPath);
      const onBookings = url.includes("/bookings");
      const onHome = url === "http://localhost:3401/" || url.endsWith(":3401");

      if (routeCase.kind === "protected") {
        expect(
          onExpectedPath || onLogin || onParentPath || onBookings || onHome,
          `Expected protected route "${routeCase.path}" to load or redirect to login, got "${url}"`
        ).toBeTruthy();
      } else {
        expect(
          onExpectedPath || onLogin,
          `Expected public route "${routeCase.path}" to render, got "${url}"`
        ).toBeTruthy();
      }

      await expect(page.locator("body")).toBeVisible();
    });
  }
});
