/**
 * Advanced feature coverage against the current product contract.
 * Focuses on live search, organization, listings, availability, and messaging flows.
 * @tags @advanced @features
 */

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { testUsers } from './helpers/test-utils';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3400/api';
const AUTH_STORAGE_KEY = 'auth-storage';

type Role = 'USER' | 'HOST' | 'ADMIN';

interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

interface PublicListing {
  id: string;
  title: string;
  basePrice: number;
  location?: {
    city?: string;
  };
}

interface OwnerListing {
  id: string;
  title: string;
}

interface OrganizationSummary {
  id: string;
  name: string;
}

async function loginByRole(request: APIRequestContext, role: Role): Promise<AuthPayload> {
  const credentialsByRole: Record<Role, { email: string; password: string }> = {
    USER: { email: testUsers.renter.email, password: testUsers.renter.password },
    HOST: { email: testUsers.owner.email, password: testUsers.owner.password },
    ADMIN: { email: testUsers.admin.email, password: testUsers.admin.password },
  };

  const response = await request.post(`${API_URL}/auth/login`, {
    data: {
      email: credentialsByRole[role].email,
      password: credentialsByRole[role].password,
    },
  });

  expect(
    response.ok(),
    `login failed for ${role}: ${response.status()} ${await response.text()}`,
  ).toBe(true);

  return response.json();
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function getPostLoginPath(role: Role): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'HOST') return '/dashboard/owner';
  return '/dashboard/renter';
}

function getFutureIsoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(10, 0, 0, 0);
  return date.toISOString();
}

async function findPublicListing(request: APIRequestContext): Promise<PublicListing> {
  const response = await request.get(`${API_URL}/listings`, {
    params: { limit: '20' },
  });

  expect(
    response.ok(),
    `public listing lookup failed: ${response.status()} ${await response.text()}`,
  ).toBe(true);

  const payload = await response.json();
  const listings = payload.listings ?? payload.data ?? payload.items ?? payload;

  expect(Array.isArray(listings)).toBe(true);

  if (listings.length === 0) {
    const owner = await loginByRole(request, 'HOST');
    const ownerListing = await findOwnerListing(request, owner.accessToken);
    const ownerListingResponse = await request.get(`${API_URL}/listings/${ownerListing.id}`);

    expect(
      ownerListingResponse.ok(),
      `owner listing fallback failed: ${ownerListingResponse.status()} ${await ownerListingResponse.text()}`,
    ).toBe(true);

    const ownerPayload = await ownerListingResponse.json();
    const listing = ownerPayload.listing ?? ownerPayload.data ?? ownerPayload;

    return {
      id: String(listing.id),
      title: String(listing.title),
      basePrice: Number(listing.basePrice ?? listing.pricePerDay ?? listing.dailyRate ?? 0),
      location: listing.location,
    };
  }

  const listing = listings.find((candidate: PublicListing) => candidate?.id && candidate?.title) ?? listings[0];
  return {
    id: String(listing.id),
    title: String(listing.title),
    basePrice: Number(listing.basePrice ?? 0),
    location: listing.location,
  };
}

async function findOwnerListing(request: APIRequestContext, ownerToken: string): Promise<OwnerListing> {
  const response = await request.get(`${API_URL}/listings/my-listings`, {
    headers: authHeaders(ownerToken),
  });

  expect(
    response.ok(),
    `owner listing lookup failed: ${response.status()} ${await response.text()}`,
  ).toBe(true);

  const listings = await response.json();

  expect(Array.isArray(listings)).toBe(true);
  expect(listings.length).toBeGreaterThan(0);

  return {
    id: String(listings[0].id),
    title: String(listings[0].title),
  };
}

async function findOwnerOrganization(
  request: APIRequestContext,
  ownerToken: string,
): Promise<OrganizationSummary> {
  const response = await request.get(`${API_URL}/organizations/my`, {
    headers: authHeaders(ownerToken),
  });

  expect(
    response.ok(),
    `owner organization lookup failed: ${response.status()} ${await response.text()}`,
  ).toBe(true);

  const payload = await response.json();
  const organizations = payload.organizations ?? payload.data ?? payload.items ?? payload;

  expect(Array.isArray(organizations)).toBe(true);
  expect(organizations.length).toBeGreaterThan(0);

  return {
    id: String(organizations[0].id),
    name: String(organizations[0].name),
  };
}

async function registerAndLoginUser(request: APIRequestContext): Promise<AuthPayload> {
  const email = `advanced-member-${Date.now()}@example.com`;
  const password = 'SecurePassword123!';

  const registerResponse = await request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password,
      firstName: 'Advanced',
      lastName: 'Member',
    },
  });

  expect(
    registerResponse.ok(),
    `member registration failed: ${registerResponse.status()} ${await registerResponse.text()}`,
  ).toBe(true);

  const loginResponse = await request.post(`${API_URL}/auth/login`, {
    data: {
      email,
      password,
    },
  });

  expect(
    loginResponse.ok(),
    `member login failed: ${loginResponse.status()} ${await loginResponse.text()}`,
  ).toBe(true);

  return loginResponse.json();
}

function getSearchKeyword(title: string): string {
  return (
    title
      .split(/\s+/)
      .map((part) => part.trim())
      .find((part) => part.length >= 4) ?? title.trim()
  );
}

async function authenticatePage(
  page: Page,
  request: APIRequestContext,
  role: Role,
): Promise<AuthPayload> {
  const auth = await loginByRole(request, role);

  await page.context().clearCookies();
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ authStorageKey, accessToken, authUser }) => {
      localStorage.clear();
      sessionStorage.clear();

      const rawRole =
        authUser &&
        typeof authUser === 'object' &&
        'role' in authUser &&
        typeof (authUser as { role?: unknown }).role === 'string'
          ? String((authUser as { role: string }).role).toUpperCase()
          : '';
      const normalizedRole =
        rawRole === 'HOST'
          ? 'owner'
          : rawRole === 'ADMIN' || rawRole === 'SUPER_ADMIN'
            ? 'admin'
            : 'renter';
      const normalizedUser =
        authUser && typeof authUser === 'object'
          ? { ...(authUser as Record<string, unknown>), role: normalizedRole }
          : authUser;

      localStorage.setItem(
        authStorageKey,
        JSON.stringify({
          state: {
            user: normalizedUser,
            accessToken,
          },
          version: 0,
        }),
      );
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    },
    {
      authStorageKey: AUTH_STORAGE_KEY,
      accessToken: auth.accessToken,
      authUser: auth.user,
    },
  );

  const destination = getPostLoginPath(role);
  await gotoPathAfterLogin(page, destination);
  await page.waitForURL(new RegExp(destination.replace('/', '\\/'))).catch(() => {
    // The destination navigation above is the primary authentication checkpoint.
  });

  return auth;
}

async function gotoPathAfterLogin(page: Page, path: string): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      if (page.url().includes(path)) {
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        !message.includes('interrupted by another navigation') &&
        !message.includes('NS_BINDING_ABORTED') &&
        !message.includes('NS_ERROR_FAILURE') &&
        !message.includes('Frame load interrupted')
      ) {
        throw error;
      }

      lastError = error;
    }

    await page.waitForLoadState('domcontentloaded').catch(() => {
      // Best effort to let the auth redirect settle before retrying the target route.
    });
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`Failed to navigate to ${path}`);
}

async function gotoListingDetail(page: Page, listingId: string): Promise<void> {
  const listingPath = `/listings/${listingId}`;

  await gotoPathAfterLogin(page, listingPath);
  await page.waitForLoadState('networkidle').catch(() => {
    // Some listing detail resources remain long-polling or slow; URL + content checks below are authoritative.
  });

  if (!page.url().includes(listingPath)) {
    await gotoPathAfterLogin(page, listingPath);
  }

  await expect(page).toHaveURL(new RegExp(listingPath.replace('?', '\\?')));
}

test.describe('Advanced Features', () => {
  test('Search supports compound filters and persists map-only mode', async ({ page, request }) => {
    const listing = await findPublicListing(request);
    const keyword = getSearchKeyword(listing.title);
    const minPrice = Math.max(0, Math.floor(listing.basePrice) - 1);
    const maxPrice = Math.ceil(listing.basePrice) + 1;

    await page.goto(
      `/search?query=${encodeURIComponent(keyword)}&minPrice=${minPrice}&maxPrice=${maxPrice}`,
    );

    await expect(page.locator('input[name="query"]')).toHaveValue(keyword);
    await expect(page.locator('input[name="minPrice"]')).toHaveValue(String(minPrice));
    await expect(page.locator('input[name="maxPrice"]')).toHaveValue(String(maxPrice));
    await expect(page.getByText(listing.title).first()).toBeVisible();

    await page.getByRole('button', { name: 'Map view' }).click({ force: true });
    await expect(page.getByRole('button', { name: 'Map only' })).toBeVisible();

    await page.getByRole('button', { name: 'Map only' }).click({ force: true });
    await expect(page.getByRole('button', { name: 'Show list' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Show list' })).toBeVisible();
  });

  test('Owner booking calendar loads and supports month navigation', async ({ page }) => {
    await authenticatePage(page, page.request, 'HOST');
    await gotoPathAfterLogin(page, '/dashboard/owner/calendar');

    await expect(page.getByText(/Booking Calendar|Calendar/i).first()).toBeVisible();

    const monthLabel = page.locator('h2').first();
    const initialMonth = (await monthLabel.textContent())?.trim();

    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(monthLabel).not.toHaveText(initialMonth ?? '');

    await page.getByRole('button', { name: /Today/i }).click();
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('Organization invitations can be created and accepted across members', async ({ request }) => {
    const owner = await loginByRole(request, 'HOST');
    const invitedUser = await registerAndLoginUser(request);
    const organization = await findOwnerOrganization(request, owner.accessToken);

    const inviteResponse = await request.post(`${API_URL}/organizations/${organization.id}/members`, {
      headers: authHeaders(owner.accessToken),
      data: {
        email: invitedUser.user.email,
        role: 'MEMBER',
      },
    });

    expect(
      inviteResponse.ok(),
      `organization invite failed: ${inviteResponse.status()} ${await inviteResponse.text()}`,
    ).toBe(true);

    const acceptResponse = await request.post(`${API_URL}/organizations/invitations/accept`, {
      headers: authHeaders(invitedUser.accessToken),
      data: { organizationId: organization.id },
    });

    expect(
      acceptResponse.ok(),
      `organization accept failed: ${acceptResponse.status()} ${await acceptResponse.text()}`,
    ).toBe(true);

    const membersResponse = await request.get(`${API_URL}/organizations/${organization.id}/members`, {
      headers: authHeaders(owner.accessToken),
    });

    expect(
      membersResponse.ok(),
      `organization members lookup failed: ${membersResponse.status()} ${await membersResponse.text()}`,
    ).toBe(true);

    const membersPayload = await membersResponse.json();
    const members = membersPayload.members ?? membersPayload;
    expect(Array.isArray(members)).toBe(true);
    expect(
      members.some((member: { user?: { email?: string }; userId?: string }) =>
        member.user?.email === invitedUser.user.email || member.userId === invitedUser.user.id,
      ),
    ).toBe(true);
  });

  test('Organization members page exposes current invite flow controls', async ({ page, request }) => {
    const owner = await loginByRole(request, 'HOST');
    const organization = await findOwnerOrganization(request, owner.accessToken);

    await authenticatePage(page, request, 'HOST');
    await gotoPathAfterLogin(page, `/organizations/${organization.id}/members`);

    await page.getByRole('button', { name: /Invite Member|Invite/i }).click();
    await expect(page.locator('#invite-email')).toBeVisible();
    await expect(page.locator('#invite-role')).toBeVisible();
    await expect(page.getByRole('button', { name: /Send Invite/i })).toBeVisible();
  });

  test('Listing version snapshots are available for owner listings', async ({ request }) => {
    const owner = await loginByRole(request, 'HOST');
    const listing = await findOwnerListing(request, owner.accessToken);

    const snapshotResponse = await request.post(
      `${API_URL}/listings/${listing.id}/versions?notes=${encodeURIComponent(`advanced-${Date.now()}`)}`,
      {
        headers: authHeaders(owner.accessToken),
      },
    );

    expect(
      snapshotResponse.ok(),
      `version snapshot failed: ${snapshotResponse.status()} ${await snapshotResponse.text()}`,
    ).toBe(true);

    const latestResponse = await request.get(`${API_URL}/listings/${listing.id}/versions/latest`);
    expect(latestResponse.ok()).toBe(true);
    const latest = await latestResponse.json();
    expect(typeof latest.version).toBe('number');
    expect(latest.version).toBeGreaterThan(0);

    const versionsResponse = await request.get(`${API_URL}/listings/${listing.id}/versions`);
    expect(versionsResponse.ok()).toBe(true);
    const versionsPayload = await versionsResponse.json();
    expect(Array.isArray(versionsPayload.versions)).toBe(true);
    expect(versionsPayload.versions.length).toBeGreaterThan(0);

    const versionResponse = await request.get(
      `${API_URL}/listings/${listing.id}/versions/${latest.version}`,
    );
    expect(versionResponse.ok()).toBe(true);
    const versionPayload = await versionResponse.json();
    expect(String(versionPayload.listingId)).toBe(listing.id);
  });

  test('Availability heatmap and booking price calculation return structured data', async ({ request }) => {
    const renter = await loginByRole(request, 'USER');
    const listing = await findPublicListing(request);
    const year = new Date().getFullYear() + 1;

    const heatmapResponse = await request.get(`${API_URL}/marketplace/availability/calendar`, {
      headers: authHeaders(renter.accessToken),
      params: {
        listingId: listing.id,
        year: String(year),
        month: '6',
      },
    });

    expect(
      heatmapResponse.ok(),
      `availability heatmap failed: ${heatmapResponse.status()} ${await heatmapResponse.text()}`,
    ).toBe(true);

    const heatmap = await heatmapResponse.json();
    expect(Array.isArray(heatmap)).toBe(true);

    const priceResponse = await request.post(`${API_URL}/bookings/calculate-price`, {
      data: {
        listingId: listing.id,
        startDate: getFutureIsoDate(120),
        endDate: getFutureIsoDate(123),
      },
    });

    expect(
      priceResponse.ok(),
      `price calculation failed: ${priceResponse.status()} ${await priceResponse.text()}`,
    ).toBe(true);

    const pricePayload = await priceResponse.json();
    expect(typeof pricePayload.totalAmount).toBe('number');
    expect(pricePayload.totalAmount).toBeGreaterThanOrEqual(0);
    expect(typeof pricePayload.subtotal).toBe('number');
    expect(typeof pricePayload.totalDays).toBe('number');
    expect(pricePayload.totalDays).toBeGreaterThan(0);
  });

  test('Dynamic pricing recommendation endpoint returns bounded pricing guidance', async ({ request }) => {
    const owner = await loginByRole(request, 'HOST');
    const listing = await findOwnerListing(request, owner.accessToken);

    const response = await request.get(`${API_URL}/marketplace/pricing/recommendation`, {
      headers: authHeaders(owner.accessToken),
      params: {
        listingId: listing.id,
        targetDate: getFutureIsoDate(45),
      },
    });

    expect(
      response.ok(),
      `pricing recommendation failed: ${response.status()} ${await response.text()}`,
    ).toBe(true);

    const payload = await response.json();
    expect(typeof payload.currentPrice).toBe('number');
    expect(typeof payload.recommendedPrice).toBe('number');
    expect(typeof payload.minPrice).toBe('number');
    expect(typeof payload.maxPrice).toBe('number');
    expect(payload.maxPrice).toBeGreaterThanOrEqual(payload.minPrice);
    expect(payload.recommendedPrice).toBeGreaterThanOrEqual(payload.minPrice);
    expect(payload.recommendedPrice).toBeLessThanOrEqual(payload.maxPrice);
  });

  test('Guest communication from listing detail routes into messages', async ({ page, request }) => {
    const listing = await findPublicListing(request);

    await authenticatePage(page, request, 'USER');
    await gotoListingDetail(page, listing.id);
    await expect(page.getByRole('heading', { name: new RegExp(listing.title, 'i') }).first()).toBeVisible();

    const messageButton = page.getByRole('button', { name: /Message/i }).first();
    await expect(messageButton).toBeVisible();
    await messageButton.click();

    await expect(page).toHaveURL(/\/messages(\?|$)/);
  });

  test('Mobile listing detail keeps booking controls accessible', async ({ page, request }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('Mobile '), 'This assertion is only relevant for mobile browser projects.');

    const listing = await findPublicListing(request);
    await gotoListingDetail(page, listing.id);

    await expect(page.locator('[data-testid="booking-panel"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Next month/i })).toBeVisible();
  });
});
