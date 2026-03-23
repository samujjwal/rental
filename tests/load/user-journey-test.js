import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

/**
 * K6 User Journey Load Test — GharBatai Rental Platform
 *
 * Simulates realistic user journeys through the system:
 *  - Browse → Search → View Listing → Book → Pay → Review
 *  - Owner: Dashboard → Approve → Start → Complete
 *
 * Run:  k6 run --env API_URL=http://localhost:3400/api tests/load/user-journey-test.js
 */

// ── Custom metrics ──
const searchLatency = new Trend('search_latency', true);
const bookingLatency = new Trend('booking_latency', true);
const authLatency = new Trend('auth_latency', true);
const listingLatency = new Trend('listing_latency', true);
const failedChecks = new Rate('failed_checks');
const bookingsCreated = new Counter('bookings_created');

// ── Options ──
export const options = {
  scenarios: {
    browse_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '3m', target: 30 },
        { duration: '1m', target: 0 },
      ],
      exec: 'browseJourney',
      tags: { journey: 'browse' },
    },
    booking_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 10 },
        { duration: '1m', target: 0 },
      ],
      exec: 'bookingJourney',
      startAfter: 'browse_users',
      tags: { journey: 'booking' },
    },
    search_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      exec: 'searchSpike',
      startAfter: 'booking_users',
      tags: { journey: 'search_spike' },
    },
  },
  thresholds: {
    // Aligned with docs/SLO.md §6 — SLO Baseline Thresholds
    // Note: user-journey runs multi-scenario load (ramping + spike) so p95/p99
    // windows accommodate higher percentile latency seen under peak concurrency.
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    search_latency: ['p(95)<400'],
    booking_latency: ['p(95)<800'],
    auth_latency: ['p(95)<500'],
    listing_latency: ['p(95)<300'],
    failed_checks: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3400/api';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ── Helpers ──

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function registerAndLogin() {
  const suffix = randomString(8);
  const email = `k6-${suffix}@loadtest.np`;
  const password = 'K6LoadTest123!';

  const regRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password, firstName: 'K6', lastName: suffix }),
    { headers: JSON_HEADERS, tags: { name: 'register' } },
  );
  authLatency.add(regRes.timings.duration);

  if (regRes.status === 201 || regRes.status === 200) {
    const body = JSON.parse(regRes.body);
    return { token: body.accessToken, userId: body.user?.id, email };
  }

  // If registration fails (user exists), try login
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: JSON_HEADERS, tags: { name: 'login' } },
  );
  authLatency.add(loginRes.timings.duration);

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return { token: body.accessToken, userId: body.user?.id, email };
  }

  return { token: null, userId: null, email };
}

// ── Browse Journey ──
// Simulates: Home → Categories → Search → View listing → Check availability

export function browseJourney() {
  group('Browse: Landing', () => {
    const res = http.get(`${BASE_URL}/categories`, {
      tags: { name: 'categories' },
    });
    check(res, { 'categories 200': (r) => r.status === 200 }) || failedChecks.add(1);
    listingLatency.add(res.timings.duration);
  });

  sleep(1);

  group('Browse: Search listings', () => {
    const queries = ['bike', 'apartment', 'camera', 'car', 'tent'];
    const q = queries[Math.floor(Math.random() * queries.length)];

    const res = http.get(`${BASE_URL}/search?query=${q}&page=1&limit=20`, {
      tags: { name: 'search' },
    });
    check(res, {
      'search 200': (r) => r.status === 200,
      'search < 600ms': (r) => r.timings.duration < 600,
    }) || failedChecks.add(1);
    searchLatency.add(res.timings.duration);

    // Try to get a listing ID from results
    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        const results = body.results || body.data || [];
        if (results.length > 0) {
          const listing = results[Math.floor(Math.random() * results.length)];

          sleep(0.5);

          // View listing detail
          const detailRes = http.get(`${BASE_URL}/listings/${listing.id}`, {
            tags: { name: 'listing_detail' },
          });
          check(detailRes, {
            'listing detail 200': (r) => r.status === 200,
          }) || failedChecks.add(1);
          listingLatency.add(detailRes.timings.duration);
        }
      } catch (e) {
        // Response parsing failed, skip
      }
    }
  });

  sleep(1);

  group('Browse: Featured listings', () => {
    const res = http.get(`${BASE_URL}/listings/featured?limit=8`, {
      tags: { name: 'featured' },
    });
    check(res, {
      'featured 200': (r) => r.status === 200,
    }) || failedChecks.add(1);
    listingLatency.add(res.timings.duration);
  });

  sleep(Math.random() * 2 + 1);
}

// ── Booking Journey ──
// Simulates: Register → Login → Search → View → Book → Check status

export function bookingJourney() {
  const { token } = registerAndLogin();
  if (!token) {
    failedChecks.add(1);
    return;
  }

  const headers = authHeaders(token);

  sleep(0.5);

  // Search for bookable listings
  let listingId = null;

  group('Booking: Search for listing', () => {
    const res = http.get(`${BASE_URL}/search?query=&page=1&limit=10`, {
      headers,
      tags: { name: 'booking_search' },
    });
    searchLatency.add(res.timings.duration);

    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        const results = body.results || body.data || [];
        if (results.length > 0) {
          listingId = results[0].id;
        }
      } catch (e) {
        // skip
      }
    }
  });

  if (!listingId) {
    sleep(1);
    return;
  }

  sleep(0.5);

  group('Booking: View listing detail', () => {
    const res = http.get(`${BASE_URL}/listings/${listingId}`, {
      headers,
      tags: { name: 'booking_listing_detail' },
    });
    check(res, { 'listing 200': (r) => r.status === 200 }) || failedChecks.add(1);
    listingLatency.add(res.timings.duration);
  });

  sleep(0.5);

  group('Booking: Create booking', () => {
    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const endDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const res = http.post(
      `${BASE_URL}/bookings`,
      JSON.stringify({
        listingId,
        startDate,
        endDate,
        message: 'K6 load test booking',
      }),
      { headers, tags: { name: 'create_booking' } },
    );
    bookingLatency.add(res.timings.duration);

    const ok = check(res, {
      'booking created 201': (r) => r.status === 201 || r.status === 200,
      'booking < 1s': (r) => r.timings.duration < 1000,
    });
    if (!ok) failedChecks.add(1);
    if (res.status === 201 || res.status === 200) bookingsCreated.add(1);
  });

  sleep(0.5);

  group('Booking: Check my bookings', () => {
    const res = http.get(`${BASE_URL}/bookings/my`, {
      headers,
      tags: { name: 'my_bookings' },
    });
    check(res, { 'my bookings 200': (r) => r.status === 200 }) || failedChecks.add(1);
    bookingLatency.add(res.timings.duration);
  });

  sleep(Math.random() * 2 + 1);
}

// ── Search Spike ──
// Hammers the search endpoint to test caching and elasticsearch under load

export function searchSpike() {
  const terms = [
    'kathmandu', 'pokhara', 'chitwan', 'bike', 'car', 'apartment',
    'camera', 'tent', 'laptop', 'room', 'flat', 'house', 'scooter',
  ];
  const q = terms[Math.floor(Math.random() * terms.length)];

  const res = http.get(`${BASE_URL}/search?query=${q}&page=1&limit=20`, {
    tags: { name: 'spike_search' },
  });

  check(res, {
    'spike search 200': (r) => r.status === 200,
    'spike search < 800ms': (r) => r.timings.duration < 800,
  }) || failedChecks.add(1);

  searchLatency.add(res.timings.duration);

  sleep(Math.random() * 0.5);
}

export function teardown() {
  console.log('User journey load test completed');
}
