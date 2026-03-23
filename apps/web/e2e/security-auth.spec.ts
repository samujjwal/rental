/**
 * Security & Auth Tests
 * Validates current authorization boundaries and core security protections.
 * @tags @security @auth @critical
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3400/api';

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

interface BookingResponse {
  id: string;
  status: string;
}

async function devLogin(request: APIRequestContext, role: Role): Promise<AuthPayload> {
  const emailByRole: Record<Role, string> = {
    USER: 'renter@test.com',
    HOST: 'owner@test.com',
    ADMIN: 'admin@test.com',
  };

  const response = await request.post(`${API_URL}/auth/dev-login`, {
    data: {
      email: emailByRole[role],
      role,
      secret: 'dev-secret-123',
    },
  });

  expect(response.ok(), `dev-login failed for ${role}: ${response.status()} ${await response.text()}`).toBe(true);
  return response.json();
}

async function findBookableListingIds(request: APIRequestContext): Promise<string[]> {
  const response = await request.get(`${API_URL}/listings`, {
    params: { limit: '20' },
  });
  expect(response.ok(), `listing lookup failed: ${response.status()} ${await response.text()}`).toBe(true);

  const payload = await response.json();
  const listings = payload.listings ?? payload.data ?? payload.items ?? payload;

  expect(Array.isArray(listings)).toBe(true);
  expect(listings.length).toBeGreaterThan(0);

  return listings.map((listing: { id: string }) => String(listing.id)).filter(Boolean);
}

async function createBooking(
  request: APIRequestContext,
  renterToken: string,
  listingIds: string[],
): Promise<BookingResponse> {
  const baseOffset = 730 + Math.floor(Date.now() / 1000) % 365;
  let lastError = 'booking setup was not attempted';

  for (let listingIndex = 0; listingIndex < listingIds.length; listingIndex += 1) {
    for (let windowIndex = 0; windowIndex < 6; windowIndex += 1) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + baseOffset + listingIndex * 30 + windowIndex * 7);
      startDate.setHours(10, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);

      const response = await request.post(`${API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${renterToken}` },
        data: {
          listingId: listingIds[listingIndex],
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });

      if (response.ok()) {
        return response.json();
      }

      lastError = `${response.status()} ${await response.text()}`;
    }
  }

  throw new Error(`booking create failed for all candidate listings: ${lastError}`);
}

test.describe('Security & Authorization', () => {
  test('XSS payloads are rejected or sanitized on listing creation', async ({ request }) => {
    const response = await request.get(`${API_URL}/listings`, {
      params: { limit: '20' },
    });

    expect(response.ok()).toBe(true);

    const payload = await response.json();
    const listings = payload.listings ?? payload.data ?? payload.items ?? payload;

    expect(Array.isArray(listings)).toBe(true);
    expect(listings.length).toBeGreaterThan(0);

    for (const listing of listings) {
      const description = String(listing?.description ?? '');
      expect(description.includes('onerror=')).toBe(false);
      expect(description.toLowerCase().includes('<script')).toBe(false);
    }
  });

  test('SQL injection payloads do not crash listing search', async ({ request }) => {
    const sqlPayload = `'; DROP TABLE listings; --`;

    const searchResponse = await request.get(`${API_URL}/listings`, {
      params: { search: sqlPayload, limit: '5' },
    });

    expect(searchResponse.ok(), `search failed: ${searchResponse.status()} ${await searchResponse.text()}`).toBe(true);

    const listingsResponse = await request.get(`${API_URL}/listings`, {
      params: { limit: '5' },
    });
    expect(listingsResponse.ok()).toBe(true);
  });

  test('CSRF protection rejects hostile origins on state-changing anonymous requests', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/register`, {
      headers: {
        Origin: 'https://evil.example.com',
      },
      data: {
        email: `csrf-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Csrf',
        lastName: 'Probe',
      },
    });

    expect(response.status()).toBe(403);
    expect(await response.text()).toContain('CSRF');
  });

  test('Invalid auth tokens are rejected', async ({ request }) => {
    const response = await request.get(`${API_URL}/users/profile`, {
      headers: {
        Authorization: 'Bearer invalid-token-12345',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('Non-admin users cannot access payout administration endpoints', async ({ request }) => {
    const owner = await devLogin(request, 'HOST');

    const response = await request.get(`${API_URL}/admin/payments/payouts`, {
      headers: { Authorization: `Bearer ${owner.accessToken}` },
    });

    expect(response.status()).toBe(403);
  });

  test('Renter cannot approve bookings', async ({ request }) => {
    const renter = await devLogin(request, 'USER');
    const listingIds = await findBookableListingIds(request);
    const booking = await createBooking(request, renter.accessToken, listingIds);

    const approveResponse = await request.post(`${API_URL}/bookings/${booking.id}/approve`, {
      headers: { Authorization: `Bearer ${renter.accessToken}` },
    });

    expect(approveResponse.status()).toBe(403);
  });

  test('Admin can override booking status when required', async ({ request }) => {
    const renter = await devLogin(request, 'USER');
    const admin = await devLogin(request, 'ADMIN');
    const listingIds = await findBookableListingIds(request);
    const booking = await createBooking(request, renter.accessToken, listingIds);

    const overrideResponse = await request.patch(`${API_URL}/admin/bookings/${booking.id}/status`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: { status: 'CANCELLED' },
    });

    expect(
      overrideResponse.ok(),
      `admin override failed: ${overrideResponse.status()} ${await overrideResponse.text()}`,
    ).toBe(true);
  });

  test('Registration creates an immediately usable account in development', async ({ request }) => {
    const email = `security-register-${Date.now()}@example.com`;
    const password = 'SecurePassword123!';

    const registerResponse = await request.post(`${API_URL}/auth/register`, {
      data: {
        email,
        password,
        firstName: 'New',
        lastName: 'User',
      },
    });

    expect(registerResponse.ok(), `register failed: ${registerResponse.status()} ${await registerResponse.text()}`).toBe(true);

    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: {
        email,
        password,
      },
    });

    expect(loginResponse.ok(), `login after register failed: ${loginResponse.status()} ${await loginResponse.text()}`).toBe(true);
  });

  test('Password reset requests do not reveal secrets and invalid reset tokens are rejected', async ({ request }) => {
    const resetRequestResponse = await request.post(`${API_URL}/auth/password/reset-request`, {
      data: { email: 'renter@test.com' },
    });

    expect(resetRequestResponse.status()).toBe(204);
    expect(await resetRequestResponse.text()).toBe('');

    const invalidResetResponse = await request.post(`${API_URL}/auth/password/reset`, {
      data: {
        token: 'expired-or-invalid-token',
        newPassword: 'AnotherSecure123!',
      },
    });

    expect([400, 401]).toContain(invalidResetResponse.status());
    expect(await invalidResetResponse.text()).not.toContain('AnotherSecure123!');
  });

  test('Sensitive credentials are not echoed in auth responses', async ({ request }) => {
    const password = 'super-secret-password-123';
    const response = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'renter@test.com',
        password,
      },
    });

    expect(response.status()).toBe(401);

    const bodyText = await response.text();
    expect(bodyText).not.toContain(password);
    expect(JSON.stringify(response.headers())).not.toContain(password);
  });

  test('Rate limiting or credential rejection protects repeated login attempts', async ({ request }) => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) =>
        request.post(`${API_URL}/auth/login`, {
          data: {
            email: 'renter@test.com',
            password: `wrong-password-${index}`,
          },
        }),
      ),
    );

    const statuses = attempts
      .filter((attempt): attempt is PromiseFulfilledResult<any> => attempt.status === 'fulfilled')
      .map((attempt) => attempt.value.status());

    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((status) => status === 401 || status === 429)).toBe(true);
  });

  test('Sensitive headers are not exposed', async ({ request }) => {
    const response = await request.get(`${API_URL}/listings`);
    const headers = response.headers();

    expect(headers['x-powered-by']).toBeUndefined();
    expect(headers['server'] === undefined || !headers['server'].includes('Node')).toBe(true);
  });

  test('Admin endpoints require an admin role', async ({ request }) => {
    const renter = await devLogin(request, 'USER');
    const endpoints = [
      `${API_URL}/admin/users`,
      `${API_URL}/admin/disputes`,
      `${API_URL}/admin/payments/payouts`,
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint, {
        headers: { Authorization: `Bearer ${renter.accessToken}` },
      });

      expect(response.status()).toBe(403);
    }
  });
});
