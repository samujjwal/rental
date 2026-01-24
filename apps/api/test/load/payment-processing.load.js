import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const paymentIntentLatency = new Trend('payment_intent_creation_latency');
const depositHoldLatency = new Trend('deposit_hold_latency');
const payoutLatency = new Trend('payout_request_latency');
const transactionCounter = new Counter('transactions_processed');
const ledgerEntryCounter = new Counter('ledger_entries_created');

// Test configuration - moderate load for financial operations
export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '2m', target: 30 }, // Ramp up to 30 users
    { duration: '3m', target: 50 }, // Peak load: 50 concurrent users
    { duration: '2m', target: 30 }, // Ramp down
    { duration: '1m', target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'], // Payment ops can be slower
    http_req_failed: ['rate<0.005'], // Very low error rate < 0.5%
    errors: ['rate<0.01'], // Custom error rate < 1%
    payment_intent_creation_latency: ['p(95)<1200', 'p(99)<2500'],
    deposit_hold_latency: ['p(95)<1000', 'p(99)<2000'],
    payout_request_latency: ['p(95)<800', 'p(99)<1500'],
  },
  ext: {
    loadimpact: {
      name: 'Payment Processing Load Test',
      projectID: 3596745,
    },
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const API_VERSION = 'v1';
const API_BASE = `${BASE_URL}/api/${API_VERSION}`;

/**
 * Setup function - creates test users and listings
 */
export function setup() {
  console.log('Setting up payment test data...');

  // Create owner account
  const ownerSignup = http.post(
    `${API_BASE}/auth/signup`,
    JSON.stringify({
      email: `payment_owner_${Date.now()}@loadtest.com`,
      password: 'LoadTest123!@#',
      name: 'Payment Test Owner',
      role: 'owner',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  const ownerData = JSON.parse(ownerSignup.body);
  const ownerToken = ownerData.accessToken;

  // Create renter account
  const renterSignup = http.post(
    `${API_BASE}/auth/signup`,
    JSON.stringify({
      email: `payment_renter_${Date.now()}@loadtest.com`,
      password: 'LoadTest123!@#',
      name: 'Payment Test Renter',
      role: 'renter',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  const renterData = JSON.parse(renterSignup.body);
  const renterToken = renterData.accessToken;

  // Setup Stripe Connect for owner
  const connectRes = http.post(`${API_BASE}/payments/connect/onboard`, null, {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  // Create category
  const categoryRes = http.post(
    `${API_BASE}/categories`,
    JSON.stringify({
      name: 'Payment Test Category',
      slug: `payment-test-${Date.now()}`,
      description: 'Category for payment testing',
      icon: 'test-icon',
      customFields: {},
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  );

  const categoryData = JSON.parse(categoryRes.body);

  // Create listing
  const listingRes = http.post(
    `${API_BASE}/listings`,
    JSON.stringify({
      title: 'Payment Test Listing',
      description: 'A listing for payment testing',
      categoryId: categoryData.id,
      pricePerDay: 100,
      pricePerWeek: 600,
      pricePerMonth: 2000,
      location: {
        address: '456 Payment St',
        city: 'Finance City',
        state: 'FC',
        zipCode: '54321',
        country: 'USA',
        coordinates: {
          latitude: 37.7749,
          longitude: -122.4194,
        },
      },
      bookingMode: 'INSTANT',
      instantBookingEnabled: true,
      customFields: {},
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  );

  const listingData = JSON.parse(listingRes.body);

  // Create a booking for payment testing
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 7);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 3);

  const bookingRes = http.post(
    `${API_BASE}/bookings`,
    JSON.stringify({
      listingId: listingData.id,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      notes: 'Payment test booking',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${renterToken}`,
      },
    },
  );

  const bookingData = JSON.parse(bookingRes.body);

  console.log('Payment test setup complete');

  return {
    ownerToken,
    renterToken,
    listingId: listingData.id,
    bookingId: bookingData.id,
  };
}

/**
 * Main VU code
 */
export default function (data) {
  const { ownerToken, renterToken, bookingId } = data;

  // Randomly choose a payment flow
  const flows = [
    customerAndPaymentMethodFlow,
    paymentIntentFlow,
    depositFlow,
    ledgerFlow,
    payoutFlow,
  ];

  const flow = flows[Math.floor(Math.random() * flows.length)];
  flow(ownerToken, renterToken, bookingId);

  sleep(Math.random() * 2 + 1); // Random think time 1-3 seconds
}

/**
 * Flow 1: Customer and Payment Method Management
 */
function customerAndPaymentMethodFlow(ownerToken, renterToken, bookingId) {
  group('Customer Management', () => {
    // Create Stripe customer
    const customerRes = http.post(`${API_BASE}/payments/customers`, null, {
      headers: {
        Authorization: `Bearer ${renterToken}`,
      },
    });

    const customerSuccess = check(customerRes, {
      'customer creation successful': (r) => r.status === 201 || r.status === 200,
      'has stripe customer ID': (r) => {
        const body = JSON.parse(r.body);
        return body.stripeCustomerId !== undefined;
      },
    });

    if (!customerSuccess) {
      errorRate.add(1);
      return;
    }

    sleep(0.5);

    // Get payment methods
    const methodsRes = http.get(`${API_BASE}/payments/customers/payment-methods`, {
      headers: {
        Authorization: `Bearer ${renterToken}`,
      },
    });

    check(methodsRes, {
      'payment methods retrieval successful': (r) => r.status === 200,
      'returns array': (r) => {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      },
    }) || errorRate.add(1);
  });
}

/**
 * Flow 2: Payment Intent Creation
 */
function paymentIntentFlow(ownerToken, renterToken, bookingId) {
  group('Payment Intent', () => {
    const startTime = new Date();
    const intentRes = http.post(
      `${API_BASE}/payments/intents`,
      JSON.stringify({
        bookingId: bookingId,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${renterToken}`,
        },
      },
    );

    const duration = new Date() - startTime;
    paymentIntentLatency.add(duration);

    const success = check(intentRes, {
      'payment intent creation successful': (r) => r.status === 201,
      'has client secret': (r) => {
        const body = JSON.parse(r.body);
        return body.clientSecret !== undefined;
      },
      'has correct amount': (r) => {
        const body = JSON.parse(r.body);
        return body.amount > 0;
      },
      'has stripe payment intent ID': (r) => {
        const body = JSON.parse(r.body);
        return body.stripePaymentIntentId !== undefined;
      },
    });

    if (success) {
      transactionCounter.add(1);
    } else {
      errorRate.add(1);
    }
  });
}

/**
 * Flow 3: Security Deposit Management
 */
function depositFlow(ownerToken, renterToken, bookingId) {
  group('Security Deposit', () => {
    // Hold deposit
    const holdStart = new Date();
    const holdRes = http.post(
      `${API_BASE}/payments/deposits/${bookingId}/hold`,
      JSON.stringify({
        amount: 50, // $50 deposit
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${renterToken}`,
        },
      },
    );

    const holdDuration = new Date() - holdStart;
    depositHoldLatency.add(holdDuration);

    const holdSuccess = check(holdRes, {
      'deposit hold successful': (r) => r.status === 200 || r.status === 201,
      'has payment intent': (r) => {
        const body = JSON.parse(r.body);
        return body.paymentIntentId !== undefined;
      },
    });

    if (!holdSuccess) {
      errorRate.add(1);
      return;
    }

    transactionCounter.add(1);
    sleep(1);

    // Release deposit (owner action)
    const releaseRes = http.post(`${API_BASE}/payments/deposits/${bookingId}/release`, null, {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    check(releaseRes, {
      'deposit release successful': (r) => r.status === 200,
    }) || errorRate.add(1);
  });
}

/**
 * Flow 4: Ledger Queries
 */
function ledgerFlow(ownerToken, renterToken, bookingId) {
  group('Ledger Operations', () => {
    // Get booking ledger entries
    const ledgerRes = http.get(`${API_BASE}/payments/ledger/booking/${bookingId}`, {
      headers: {
        Authorization: `Bearer ${renterToken}`,
      },
    });

    const ledgerSuccess = check(ledgerRes, {
      'ledger retrieval successful': (r) => r.status === 200,
      'returns array of entries': (r) => {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      },
      'entries have amounts': (r) => {
        const body = JSON.parse(r.body);
        if (body.length === 0) return true;
        return body.every((entry) => entry.amount !== undefined);
      },
      'entries have types': (r) => {
        const body = JSON.parse(r.body);
        if (body.length === 0) return true;
        return body.every((entry) => entry.type !== undefined);
      },
    });

    if (ledgerSuccess) {
      const body = JSON.parse(ledgerRes.body);
      ledgerEntryCounter.add(body.length);
    } else {
      errorRate.add(1);
    }

    sleep(0.5);

    // Get user balance
    const balanceRes = http.get(`${API_BASE}/payments/ledger/balance`, {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    check(balanceRes, {
      'balance retrieval successful': (r) => r.status === 200,
      'has balance amount': (r) => {
        const body = JSON.parse(r.body);
        return body.balance !== undefined;
      },
    }) || errorRate.add(1);
  });
}

/**
 * Flow 5: Payout Operations
 */
function payoutFlow(ownerToken, renterToken, bookingId) {
  group('Payout Operations', () => {
    // Get earnings
    const earningsRes = http.get(`${API_BASE}/payments/payouts/earnings`, {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    check(earningsRes, {
      'earnings retrieval successful': (r) => r.status === 200,
      'has available amount': (r) => {
        const body = JSON.parse(r.body);
        return body.available !== undefined;
      },
      'has pending amount': (r) => {
        const body = JSON.parse(r.body);
        return body.pending !== undefined;
      },
    }) || errorRate.add(1);

    sleep(0.5);

    // Request payout (only if has earnings)
    const earningsData = JSON.parse(earningsRes.body);
    if (earningsData.available && earningsData.available > 0) {
      const payoutStart = new Date();
      const payoutRes = http.post(
        `${API_BASE}/payments/payouts/request`,
        JSON.stringify({
          amount: Math.min(earningsData.available, 100), // Request up to $100
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerToken}`,
          },
        },
      );

      const payoutDuration = new Date() - payoutStart;
      payoutLatency.add(payoutDuration);

      const payoutSuccess = check(payoutRes, {
        'payout request successful': (r) => r.status === 201 || r.status === 200,
        'has payout ID': (r) => {
          const body = JSON.parse(r.body);
          return body.id !== undefined;
        },
      });

      if (payoutSuccess) {
        transactionCounter.add(1);
      } else {
        errorRate.add(1);
      }
    }

    sleep(0.5);

    // Get payout history
    const historyRes = http.get(`${API_BASE}/payments/payouts/history`, {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    check(historyRes, {
      'payout history retrieval successful': (r) => r.status === 200,
      'returns array': (r) => {
        const body = JSON.parse(r.body);
        return Array.isArray(body.payouts);
      },
    }) || errorRate.add(1);
  });
}

/**
 * Teardown function
 */
export function teardown(data) {
  console.log('Payment load test completed.');
}
