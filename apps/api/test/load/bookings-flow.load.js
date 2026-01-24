import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const bookingCreationTime = new Trend('booking_creation_duration');
const bookingApprovalTime = new Trend('booking_approval_duration');
const bookingCounter = new Counter('bookings_created');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 20 }, // Ramp up to 20 users
    { duration: '3m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 100 }, // Peak load: 100 concurrent users
    { duration: '2m', target: 50 }, // Ramp down to 50 users
    { duration: '1m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    http_req_failed: ['rate<0.01'], // Error rate < 1%
    errors: ['rate<0.05'], // Custom error rate < 5%
    booking_creation_duration: ['p(95)<800', 'p(99)<1500'],
    booking_approval_duration: ['p(95)<400', 'p(99)<800'],
  },
  ext: {
    loadimpact: {
      name: 'Booking Flow Load Test',
      projectID: 3596745,
    },
  },
};

// Base URL - can be overridden via environment variable
const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const API_VERSION = 'v1';
const API_BASE = `${BASE_URL}/api/${API_VERSION}`;

// Test data
let authTokens = {
  owner: null,
  renter: null,
};
let testData = {
  categoryId: null,
  listingId: null,
  bookingId: null,
};

/**
 * Setup function - runs once before load test
 * Creates test users, category, and listing
 */
export function setup() {
  console.log('Setting up test data...');

  // Create owner account
  const ownerSignup = http.post(
    `${API_BASE}/auth/signup`,
    JSON.stringify({
      email: `owner_${Date.now()}@loadtest.com`,
      password: 'LoadTest123!@#',
      name: 'Load Test Owner',
      role: 'owner',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  check(ownerSignup, {
    'owner signup successful': (r) => r.status === 201,
  });

  const ownerData = JSON.parse(ownerSignup.body);
  authTokens.owner = ownerData.accessToken;

  // Create renter account
  const renterSignup = http.post(
    `${API_BASE}/auth/signup`,
    JSON.stringify({
      email: `renter_${Date.now()}@loadtest.com`,
      password: 'LoadTest123!@#',
      name: 'Load Test Renter',
      role: 'renter',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  check(renterSignup, {
    'renter signup successful': (r) => r.status === 201,
  });

  const renterData = JSON.parse(renterSignup.body);
  authTokens.renter = renterData.accessToken;

  // Create category
  const categoryRes = http.post(
    `${API_BASE}/categories`,
    JSON.stringify({
      name: 'Load Test Category',
      slug: `load-test-${Date.now()}`,
      description: 'Category for load testing',
      icon: 'test-icon',
      customFields: {},
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authTokens.owner}`,
      },
    },
  );

  const categoryData = JSON.parse(categoryRes.body);
  testData.categoryId = categoryData.id;

  // Create listing
  const listingRes = http.post(
    `${API_BASE}/listings`,
    JSON.stringify({
      title: 'Load Test Listing',
      description: 'A listing for load testing purposes',
      categoryId: testData.categoryId,
      pricePerDay: 100,
      pricePerWeek: 600,
      pricePerMonth: 2000,
      location: {
        address: '123 Test St',
        city: 'Test City',
        state: 'TC',
        zipCode: '12345',
        country: 'USA',
        coordinates: {
          latitude: 40.7128,
          longitude: -74.006,
        },
      },
      bookingMode: 'INSTANT',
      instantBookingEnabled: true,
      customFields: {},
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authTokens.owner}`,
      },
    },
  );

  const listingData = JSON.parse(listingRes.body);
  testData.listingId = listingData.id;

  console.log('Setup complete. Test data:', testData);

  return {
    ownerToken: authTokens.owner,
    renterToken: authTokens.renter,
    listingId: testData.listingId,
  };
}

/**
 * Main VU (Virtual User) code
 */
export default function (data) {
  const { ownerToken, renterToken, listingId } = data;

  // Simulate realistic user behavior with think time
  group('Booking Creation Flow', () => {
    // 1. Browse listing (as renter)
    const browseRes = http.get(`${API_BASE}/listings/${listingId}`, {
      headers: {
        Authorization: `Bearer ${renterToken}`,
      },
    });

    check(browseRes, {
      'browse listing successful': (r) => r.status === 200,
      'listing has correct data': (r) => {
        const body = JSON.parse(r.body);
        return body.id === listingId;
      },
    }) || errorRate.add(1);

    sleep(1); // Think time

    // 2. Create booking (as renter)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 10) + 5);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 7) + 1);

    const bookingPayload = {
      listingId: listingId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      notes: 'Load test booking',
    };

    const createStart = new Date();
    const bookingRes = http.post(`${API_BASE}/bookings`, JSON.stringify(bookingPayload), {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${renterToken}`,
      },
    });

    const bookingDuration = new Date() - createStart;
    bookingCreationTime.add(bookingDuration);

    const bookingSuccess = check(bookingRes, {
      'booking creation successful': (r) => r.status === 201,
      'booking has ID': (r) => {
        const body = JSON.parse(r.body);
        return body.id !== undefined;
      },
      'booking status is correct': (r) => {
        const body = JSON.parse(r.body);
        return body.status === 'PENDING' || body.status === 'CONFIRMED';
      },
    });

    if (bookingSuccess) {
      bookingCounter.add(1);
      const bookingData = JSON.parse(bookingRes.body);
      const bookingId = bookingData.id;

      sleep(2); // Think time

      // 3. View booking details (as renter)
      const viewRes = http.get(`${API_BASE}/bookings/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${renterToken}`,
        },
      });

      check(viewRes, {
        'view booking successful': (r) => r.status === 200,
      }) || errorRate.add(1);

      sleep(1);

      // 4. Owner checks bookings
      const ownerBookingsRes = http.get(`${API_BASE}/bookings/host-bookings`, {
        headers: {
          Authorization: `Bearer ${ownerToken}`,
        },
      });

      check(ownerBookingsRes, {
        'owner view bookings successful': (r) => r.status === 200,
      }) || errorRate.add(1);

      sleep(1);

      // 5. Owner approves booking (if it needs approval)
      if (bookingData.status === 'PENDING') {
        const approvalStart = new Date();
        const approvalRes = http.post(`${API_BASE}/bookings/${bookingId}/approve`, null, {
          headers: {
            Authorization: `Bearer ${ownerToken}`,
          },
        });

        const approvalDuration = new Date() - approvalStart;
        bookingApprovalTime.add(approvalDuration);

        check(approvalRes, {
          'booking approval successful': (r) => r.status === 200,
          'booking status changed to confirmed': (r) => {
            const body = JSON.parse(r.body);
            return body.status === 'CONFIRMED';
          },
        }) || errorRate.add(1);
      }
    } else {
      errorRate.add(1);
    }

    sleep(2); // Think time between iterations
  });
}

/**
 * Teardown function - runs once after load test
 * Cleans up test data
 */
export function teardown(data) {
  console.log('Load test completed. Cleaning up...');
  // Note: In production, you'd want to clean up test data here
  // For now, we'll leave it to manual cleanup or database reset
}

/**
 * Handle summary - custom summary function
 */
export function handleSummary(data) {
  const summary = {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };

  // Save summary to file
  if (__ENV.SAVE_REPORT === 'true') {
    summary['summary.json'] = JSON.stringify(data);
  }

  return summary;
}

// Helper function for text summary
function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors !== false;

  let output = '\n';
  output += `${indent}Booking Flow Load Test Summary\n`;
  output += `${indent}================================\n\n`;

  // Key metrics
  const metrics = data.metrics;

  output += `${indent}Duration: ${data.state.testRunDurationMs / 1000}s\n`;
  output += `${indent}VUs: ${data.state.maxVUs}\n\n`;

  output += `${indent}HTTP Metrics:\n`;
  output += `${indent}  Requests: ${metrics.http_reqs.values.count}\n`;
  output += `${indent}  Failed: ${metrics.http_req_failed.values.passes} (${(
    (metrics.http_req_failed.values.passes / metrics.http_reqs.values.count) *
    100
  ).toFixed(2)}%)\n`;
  output += `${indent}  Duration (p95): ${metrics.http_req_duration.values.p95.toFixed(2)}ms\n`;
  output += `${indent}  Duration (p99): ${metrics.http_req_duration.values.p99.toFixed(2)}ms\n\n`;

  output += `${indent}Business Metrics:\n`;
  output += `${indent}  Bookings Created: ${metrics.bookings_created.values.count}\n`;
  output += `${indent}  Booking Creation (p95): ${metrics.booking_creation_duration.values.p95.toFixed(
    2,
  )}ms\n`;
  output += `${indent}  Booking Approval (p95): ${metrics.booking_approval_duration.values.p95.toFixed(
    2,
  )}ms\n`;
  output += `${indent}  Error Rate: ${(metrics.errors.values.rate * 100).toFixed(2)}%\n\n`;

  // Check thresholds
  const thresholds = data.thresholds;
  const failedThresholds = Object.keys(thresholds).filter((key) => !thresholds[key].ok);

  if (failedThresholds.length > 0) {
    output += `${indent}⚠️  Failed Thresholds:\n`;
    failedThresholds.forEach((key) => {
      output += `${indent}  - ${key}\n`;
    });
  } else {
    output += `${indent}✅ All thresholds passed\n`;
  }

  return output;
}
