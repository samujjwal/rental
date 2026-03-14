import { test, expect, type Page } from "@playwright/test";
import { loginAs, testUsers } from "./helpers/test-utils";

interface RouteExpectation {
  path: string;
  heading: RegExp;
  actionText?: RegExp;
  sidebarLinks: string[];
  extraCheck?: (page: Page) => Promise<void>;
}

async function expectPortalShell(page: Page, route: RouteExpectation) {
  await page.goto(route.path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toContainText(route.heading);

  for (const label of route.sidebarLinks) {
    await expect(
      page.getByRole("link", { name: label, exact: true }).first()
    ).toBeVisible();
  }

  if (route.actionText) {
    await expect(page.locator("body")).toContainText(route.actionText);
  }

  if (route.extraCheck) {
    await route.extraCheck(page);
  }
}

test.describe("Portal layout consistency", () => {
  test("redirects /dashboard into the renter portal shell for renter users", async ({
    page,
  }) => {
    await loginAs(page, testUsers.renter);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/dashboard\/renter$/);
    await expect(page.locator("h1")).toContainText(/Renter Portal/i);
  });

  test("keeps renter portal routes on the shared shell", async ({ page }) => {
    await loginAs(page, testUsers.renter);

    const routes: RouteExpectation[] = [
      {
        path: "/dashboard/renter",
        heading: /Renter Portal/i,
        actionText: /Browse Rentals/i,
        sidebarLinks: ["Dashboard", "My Bookings", "Favorites", "Messages"],
      },
      {
        path: "/bookings",
        heading: /My Bookings/i,
        sidebarLinks: ["Dashboard", "My Bookings", "Favorites", "Messages"],
      },
      {
        path: "/favorites",
        heading: /Saved Listings/i,
        actionText: /Browse More/i,
        sidebarLinks: ["Dashboard", "My Bookings", "Favorites", "Messages"],
      },
      {
        path: "/messages",
        heading: /^Messages$/i,
        actionText: /Live|Offline/i,
        sidebarLinks: ["Dashboard", "My Bookings", "Favorites", "Messages"],
        extraCheck: async (currentPage) => {
          await expect(
            currentPage.locator('input[placeholder="Search conversations..."]')
          ).toBeVisible();
        },
      },
      {
        path: "/notifications",
        heading: /^Notifications$/i,
        actionText: /Unread|Show All|notifications\./i,
        sidebarLinks: [
          "Dashboard",
          "My Bookings",
          "Favorites",
          "Messages",
          "Notifications",
        ],
      },
    ];

    for (const route of routes) {
      await expectPortalShell(page, route);
    }
  });

  test("keeps owner portal routes on the shared shell", async ({ page }) => {
    await loginAs(page, testUsers.owner);

    const routes: RouteExpectation[] = [
      {
        path: "/dashboard/owner",
        heading: /Owner Portal/i,
        actionText: /New Listing/i,
        sidebarLinks: ["Dashboard", "Listings", "Bookings", "Messages"],
      },
      {
        path: "/bookings?view=owner",
        heading: /Booking Center/i,
        sidebarLinks: ["Dashboard", "Listings", "Bookings", "Messages"],
      },
      {
        path: "/messages",
        heading: /Owner Inbox/i,
        actionText: /Live|Offline/i,
        sidebarLinks: ["Dashboard", "Listings", "Bookings", "Messages"],
        extraCheck: async (currentPage) => {
          await expect(
            currentPage.locator('input[placeholder="Search conversations..."]')
          ).toBeVisible();
        },
      },
      {
        path: "/notifications",
        heading: /^Notifications$/i,
        actionText: /Unread|Show All|notifications\./i,
        sidebarLinks: [
          "Dashboard",
          "Listings",
          "Bookings",
          "Messages",
          "Notifications",
        ],
      },
    ];

    for (const route of routes) {
      await expectPortalShell(page, route);
    }
  });

  test("keeps renter dashboard header usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, testUsers.renter);

    await page.goto("/dashboard/renter", { waitUntil: "domcontentloaded" });

    await expect(page.locator("h1")).toContainText(/Renter Portal/i);
    await expect(
      page.getByRole("link", { name: /Browse Rentals/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open navigation menu" })
    ).toBeVisible();
  });

  test("keeps owner dashboard header usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, testUsers.owner);

    await page.goto("/dashboard/owner", { waitUntil: "domcontentloaded" });

    await expect(page.locator("h1")).toContainText(/Owner Portal/i);
    await expect(
      page.getByRole("link", { name: /New Listing/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open navigation menu" })
    ).toBeVisible();
  });
});
