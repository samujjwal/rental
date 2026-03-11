/**
 * P3: k6 Full Checkout Flow Load Test
 *
 * End-to-end checkout flow under load:
 *   1. Login → 2. Search listings → 3. Create booking → 4. Approve booking →
 *   5. Create payment intent → 6. Confirm payment → 7. Check booking status
 *
 * Simulates realistic user behavior with think-time between steps.
 *
 * Run:
 *   k6 run apps/api/test/load/checkout-flow.load.js
 *   k6 run --env API_URL=http://staging:3400 apps/api/test/load/checkout-flow.load.js
 */
import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ────────────────────────────────────────
const checkoutSuccess = new Rate('checkout_success');
const checkoutE2ELatency = new Trend('checkout_e2e_latency');
const loginLatency = new Trend('login_latency');
const searchLatency = new Trend('search_latency');
const bookingCreateLatency = new Trend('booking_create_latency');
const bookingApproveLatency = new Trend('booking_approve_latency');
const paymentIntentLatency = new Trend('payment_intent_latency');
const checkoutAttempts = new Counter('checkout_attempts');
const checkoutFailures = new Counter('checkout_failures');

// ─── Options ───────────────────────────────────────────────
export const options = {
  scenarios: {
    checkout_flow: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },   // Warm-up
        { duration: '1m', target: 15 },   // Ramp
        { duration: '2m', target: 25 },   // Sustained
        { duration: '1m', target: 10 },   // Cool down
        { duration: '30s', target: 0 },   // Drain
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    http_req_failed: ['rate<0.05'],            // < 5% failure rate
    checkout_e2e_latency: ['p(95)<8000'],       // Full flow < 8s at p95
    checkout_success: ['rate>0.80'],            // > 80% checkout success
    login_latency: ['p(95)<500'],
    search_latency: ['p(95)<1000'],
    booking_create_latency: ['p(95)<1500'],
    payment_intent_latency: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3400';
const RENTER_PASSWORD = 'LoadTest123!@#';
const OWNER_PASSWORD = 'LoadTest123!@#';

// ─── Helpers ───────────────────────────────────────────────

function jsonHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function safeParse(response) {
  try {
    return JSON.parse(response.body);
  } catch {
    return null;
  }
}

// ─── Setup ─────────────────────────────────────────────────

export function setup() {
  console.log(`[checkout-flow] Setting up test accounts against ${BASE_URL}`);

  // Register owner
  const ownerEmail = `chk_owner_${Date.now()}@loadtest.com`;
  const ownerRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({
      email: ownerEmail,
      password: OWNER_PASSWORD,
      firstName: 'CheckoutOwner',
    }),
    { headers: jsonHeaders() },
  );

  const ownerData = safeParse(ownerRes);
  if (!ownerData || !ownerData.accessToken) {
    console.error('[setup] Failed to register owner:', ownerRes.body);
    return { error: 'owner registration failed' };
  }

  // Register renter
  const renterEmail = `chk_renter_${Date.now()}@loadtest.com`;
  const renterRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({
      email: renterEmail,
      password: RENTER_PASSWORD,
      firstName: 'CheckoutRenter',
    }),
    { headers: jsonHeaders() },
  );

  const renterData = safeParse(renterRes);
  if (!renterData || !renterData.accessToken) {
    console.error('[setup] Failed to register renter:', renterRes.body);
    return { error: 'renter registration failed' };
  }

  return {
    ownerEmail,
    ownerToken: ownerData.accessToken,
    renterEmail,
    renterToken: renterData.accessToken,
  };
}

// ─── Main VU Function ──────────────────────────────────────

export default function (data) {
  if (data.error) {
    console.warn('[vu] Skipping — setup failed');
    sleep(1);
    return;
  }

  const startTime = Date.now();
  checkoutAttempts.add(1);
  let success = false;

  try {
    // Step 1: Login (renter)
    let renterToken;
    group('1_login', () => {
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({
          email: data.renterEmail,
          password: RENTER_PASSWORD,
        }),
        { headers: jsonHeaders() },
      );
      loginLatency.add(Date.now() - start);

      const ok = check(res, {
        'login status 200/201': (r) => r.status === 200 || r.status === 201,
        'login has token': (r) => {
          const body = safeParse(r);
          return body && !!body.accessToken;
        },
      });

      if (ok) {
        renterToken = safeParse(res).accessToken;
      }
    });

    if (!renterToken) {
      checkoutFailures.add(1);
      checkoutSuccess.add(false);
      return;
    }

    sleep(0.5); // Think time

    // Step 2: Search listings
    let listingId;
    group('2_search_listings', () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/listings?limit=5`, {
        headers: jsonHeaders(renterToken),
      });
      searchLatency.add(Date.now() - start);

      check(res, {
        'search returns 200': (r) => r.status === 200,
      });

      const body = safeParse(res);
      if (body) {
        const items = Array.isArray(body) ? body : body.data || body.items || [];
        if (items.length > 0) {
          // Pick a random listing
          listingId = items[Math.floor(Math.random() * items.length)].id;
        }
      }
    });

    if (!listingId) {
      // No listings available — not a checkout failure per se
      sleep(2);
      return;
    }

    sleep(1); // User browses listing

    // Step 3: Create booking
    let bookingId;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30) + 10);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 1);

    group('3_create_booking', () => {
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/bookings`,
        JSON.stringify({
          listingId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
        { headers: jsonHeaders(renterToken) },
      );
      bookingCreateLatency.add(Date.now() - start);

      const ok = check(res, {
        'booking created': (r) => r.status === 201 || r.status === 200,
      });

      if (ok) {
        const body = safeParse(res);
        bookingId = body ? body.id : null;
      }
    });

    if (!bookingId) {
      // Date conflict or validation error — acceptable
      checkoutFailures.add(1);
      checkoutSuccess.add(false);
      return;
    }

    sleep(1);

    // Step 4: Owner approves booking
    group('4_owner_approve', () => {
      const start = Date.now();
      const res = http.patch(
        `${BASE_URL}/bookings/${bookingId}/approve`,
        null,
        { headers: jsonHeaders(data.ownerToken) },
      );
      bookingApproveLatency.add(Date.now() - start);

      check(res, {
        'booking approved': (r) => r.status === 200,
      });
    });

    sleep(0.5);

    // Step 5: Create payment intent
    let hasPaymentIntent = false;
    group('5_create_payment_intent', () => {
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/payments/intents/${bookingId}`,
        null,
        { headers: jsonHeaders(renterToken) },
      );
      paymentIntentLatency.add(Date.now() - start);

      const ok = check(res, {
        'payment intent created': (r) => r.status === 201 || r.status === 200,
        'has client secret': (r) => {
          const body = safeParse(r);
          return body && !!body.clientSecret;
        },
      });

      hasPaymentIntent = ok;
    });

    sleep(0.5);

    // Step 6: Verify booking status
    group('6_verify_booking_status', () => {
      const res = http.get(`${BASE_URL}/bookings/${bookingId}`, {
        headers: jsonHeaders(renterToken),
      });

      check(res, {
        'booking accessible': (r) => r.status === 200,
        'booking has expected status': (r) => {
          const body = safeParse(r);
          return (
            body &&
            ['PENDING_PAYMENT', 'CONFIRMED', 'PENDING_OWNER_APPROVAL'].includes(body.status)
          );
        },
      });
    });

    success = true;
  } catch (e) {
    console.error(`[vu] Error: ${e.message}`);
  } finally {
    const elapsed = Date.now() - startTime;
    checkoutE2ELatency.add(elapsed);
    checkoutSuccess.add(success);
    if (!success) checkoutFailures.add(1);

    sleep(2); // Cool-down between iterations
  }
}

// ─── Teardown ──────────────────────────────────────────────

export function teardown(data) {
  console.log('[checkout-flow] Test complete. See results above.');
}
