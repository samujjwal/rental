import { test, expect, type Page } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";
import { loginAsUi, testUsers, expectAnyVisible } from "./helpers/test-utils";
import type { TestUser } from "./helpers/fixtures";

const API = process.env.E2E_API_URL ?? "http://localhost:3400/api";

async function registerFreshOrganizationMember(page: Page): Promise<TestUser> {
  const uniqueId = Date.now();
  const user: TestUser = {
    email: `org.member.${uniqueId}@example.com`,
    password: "Test123!@#",
    firstName: "Org",
    lastName: `Member${uniqueId}`,
    phone: "+15550177",
    role: "renter",
  };

  const response = await page.request.post(`${API}/auth/register`, {
    data: {
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    },
  });

  expect(response.ok(), `organization member registration failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  return user;
}

async function registerFreshOrganizationOwner(page: Page): Promise<TestUser> {
  const uniqueId = Date.now();
  const user: TestUser = {
    email: `org.owner.${uniqueId}@example.com`,
    password: "Test123!@#",
    firstName: "Org",
    lastName: `Owner${uniqueId}`,
    phone: "+15550167",
    role: "renter",
  };

  const response = await page.request.post(`${API}/auth/register`, {
    data: {
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    },
  });

  expect(response.ok(), `organization owner registration failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  return user;
}

async function getExistingOrganizationFromUi(page: Page): Promise<{ id: string; name: string }> {
  await page.goto("/organizations");

  const manageLink = page.locator('a[href^="/organizations/"][href$="/settings"]').first();
  await expect(manageLink).toBeVisible({ timeout: 10000 });

  const href = await manageLink.getAttribute("href");
  expect(href, "expected an organization settings link").toBeTruthy();

  const match = href?.match(/^\/organizations\/([^/]+)\/settings$/);
  expect(match, `could not parse organization id from ${href}`).toBeTruthy();

  const organizationName = (await page.locator("h3.text-lg").first().textContent())?.trim() || "";
  expect(organizationName, "expected a visible organization name in the list").toBeTruthy();

  return { id: match![1], name: organizationName };
}

test.describe("Organization Management E2E", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
    await loginAsUi(page, testUsers.owner);
  });

  test("should navigate to organizations list", async ({ page }) => {
    await page.goto("/organizations");

    await expectAnyVisible(page, [
      "text=/Organizations|Teams|Groups/i",
      "h1:has-text('Organizations')",
      "button:has-text('New Organization')",
    ]);
  });

  test("should create a new organization through the real UI flow", async ({ page }) => {
    const freshOwner = await registerFreshOrganizationOwner(page);
    await loginAsUi(page, freshOwner);

    await page.goto("/organizations/new");

    const orgName = `UI Org ${Date.now()}`;
    await page.locator('input[name="businessType"][value="LLC"]').check({ force: true });
    await page.getByRole("button", { name: /Next/i }).click();

    await page.locator('input[name="name"]:visible').fill(orgName);
    await page.locator('textarea[name="description"]:visible').fill("Real UI organization creation for Playwright hardening.");
    await page.locator('input[name="email"]:visible').fill(`ui-org.${Date.now()}@example.com`);
    await page.locator('input[name="phoneNumber"]:visible').fill("+15550166");
    await page.getByRole("button", { name: /Next/i }).click();

    await page.locator('input[name="city"]:visible').fill("Kathmandu");
    await page.locator('input[name="state"]:visible').fill("Bagmati");
    await page.locator('input[name="country"]:visible').fill("Nepal");
    await page.getByRole("button", { name: /Create|Creating/i }).click();

    await page.waitForURL(/\/organizations\/[^/]+\/settings/, { timeout: 20000 });
    await expect(page.locator('input[name="name"]')).toHaveValue(orgName);
    await expectAnyVisible(page, [
      "text=/Organization Settings|Settings/i",
      `text=${orgName}`,
    ]);
  });

  test("should render organization members, listings, and settings pages for a seeded organization", async ({ page }) => {
    const organization = await getExistingOrganizationFromUi(page);

    await page.goto(`/organizations/${organization.id}/members`);
    await expectAnyVisible(page, [
      "text=/Members|Team|People/i",
      "button:has-text('Invite')",
      `text=${organization.name}`,
    ]);

    await page.goto(`/organizations/${organization.id}/listings`);
    await expectAnyVisible(page, [
      `text=${organization.name}`,
      "text=/Listings/i",
      "button:has-text('Add Listing')",
      "button:has-text('Create Listing')",
    ]);

    await page.goto(`/organizations/${organization.id}/settings`);
    await expect(page.locator('input[name="name"]')).toHaveValue(organization.name);
    await expectAnyVisible(page, [
      "text=/Organization Settings|Settings/i",
      "button:has-text('Save')",
    ]);
  });

  test("should invite a newly registered member and show them on the members page", async ({ page }) => {
    const organization = await getExistingOrganizationFromUi(page);
    const invitedUser = await registerFreshOrganizationMember(page);

    await page.goto(`/organizations/${organization.id}/members`);
    await page.getByRole("button", { name: /Invite/i }).click();
    await expect(page.locator("#invite-email")).toBeVisible({ timeout: 10000 });

    await page.locator("#invite-email").fill(invitedUser.email);
    await page.locator("#invite-role").selectOption("ADMIN");
    await page.getByRole("button", { name: /Invite Member|Invite/i }).last().click();

    await expect(page.locator("#invite-email")).toBeHidden({ timeout: 15000 });
    const invitedMemberRow = page.locator("li", { hasText: invitedUser.email }).first();
    await expect(invitedMemberRow).toBeVisible({ timeout: 15000 });
    await expect(invitedMemberRow.getByText("ADMIN", { exact: true })).toBeVisible();
  });
});
