/**
 * Performance Stress Testing Scenarios
 *
 * K6-based stress tests for critical API endpoints:
 * - Spike testing (sudden traffic surge)
 * - Soak testing (extended duration)
 * - Stress testing (breaking point)
 * - Load testing (gradual increase)
 * - Endurance testing (sustained load)
 */

import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const throughput = new Counter('throughput');

// Test configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

/**
 * Stress Test Configuration
 * Gradually increase load until system reaches breaking point
 */
export const stressTestOptions = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 300 },   // Ramp up to 300 users
    { duration: '5m', target: 300 },   // Stay at 300 users
    { duration: '2m', target: 400 },   // Ramp up to 400 users
    { duration: '5m', target: 400 },   // Stay at 400 users
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    errors: ['rate<0.1'],                 // Error rate under 10%
  },
};

/**
 * Spike Test Configuration
 * Sudden traffic surge simulation (e.g., flash sale, viral content)
 */
export const spikeTestOptions = {
  stages: [
    { duration: '30s', target: 50 },    // Normal load
    { duration: '30s', target: 500 },   // Spike to 500 users
    { duration: '1m', target: 500 },    // Stay at peak
    { duration: '30s', target: 50 },    // Drop back to normal
    { duration: '2m', target: 50 },     // Stay at normal
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // Allow higher latency during spike
    errors: ['rate<0.15'],               // Allow up to 15% errors during spike
  },
};

/**
 * Soak Test Configuration
 * Extended duration test for memory leaks, resource exhaustion
 */
export const soakTestOptions = {
  stages: [
    { duration: '5m', target: 100 },   // Ramp up
    { duration: '4h', target: 100 },     // Sustained load for 4 hours
    { duration: '5m', target: 0 },       // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],  // Consistent performance
    errors: ['rate<0.05'],               // Very low error rate
  },
};

/**
 * Endurance Test Configuration
 * Long-running test with varying load patterns
 */
export const enduranceTestOptions = {
  stages: [
    { duration: '10m', target: 50 },    // Light load
    { duration: '20m', target: 150 },   // Medium load
    { duration: '10m', target: 50 },    // Light load
    { duration: '20m', target: 200 },   // Heavy load
    { duration: '10m', target: 50 },    // Light load
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.1'],
  },
};

// Default to stress test
export const options = stressTestOptions;

// Select test type via environment variable
if (__ENV.TEST_TYPE === 'spike') {
  Object.assign(options, spikeTestOptions);
} else if (__ENV.TEST_TYPE === 'soak') {
  Object.assign(options, soakTestOptions);
} else if (__ENV.TEST_TYPE === 'endurance') {
  Object.assign(options, enduranceTestOptions);
}

/**
 * Setup function - runs once before all VUs start
 */
export function setup() {
  console.log(`Starting ${__ENV.TEST_TYPE || 'stress'} test against ${BASE_URL}`);
  
  // Health check
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  check(healthCheck, {
    'health check passes': (r) => r.status === 200,
  });

  return { startTime: Date.now() };
}

/**
 * Main test function - runs repeatedly for each virtual user
 */
export default function(data) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  // Execute test scenarios based on weighted random selection
  const scenario = selectScenario();
  
  switch (scenario) {
    case 'listings_search':
      testListingsSearch(headers);
      break;
    case 'booking_flow':
      testBookingFlow(headers);
      break;
    case 'auth_operations':
      testAuthOperations(headers);
      break;
    case 'payment_processing':
      testPaymentProcessing(headers);
      break;
    case 'concurrent_reads':
      testConcurrentReads(headers);
      break;
    default:
      testListingsSearch(headers);
  }

  // Random sleep between 0.5-2s to simulate user think time
  sleep(Math.random() * 1.5 + 0.5);
}

/**
 * Select test scenario with weighted probability
 */
function selectScenario() {
  const rand = Math.random();
  if (rand < 0.4) return 'listings_search';      // 40%
  if (rand < 0.6) return 'booking_flow';          // 20%
  if (rand < 0.75) return 'auth_operations';      // 15%
  if (rand < 0.85) return 'payment_processing';    // 10%
  return 'concurrent_reads';                        // 15%
}

/**
 * Test: Listings Search (high read load)
 */
function testListingsSearch(headers) {
  const params = {
    page: Math.floor(Math.random() * 10) + 1,
    limit: 20,
    sortBy: ['createdAt', 'price', 'rating'][Math.floor(Math.random() * 3)],
    order: Math.random() > 0.5 ? 'asc' : 'desc',
  };
  
  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const response = http.get(`${BASE_URL}/api/listings?${queryString}`, { headers });
  
  const success = check(response, {
    'listings search status is 200': (r) => r.status === 200,
    'listings search response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
  throughput.add(1);
}

/**
 * Test: Booking Flow (write-heavy operations)
 */
function testBookingFlow(headers) {
  // Step 1: Get available listings
  const listingsResponse = http.get(`${BASE_URL}/api/listings?limit=5`, { headers });
  
  if (listingsResponse.status !== 200) {
    errorRate.add(true);
    return;
  }

  // Step 2: Check availability (if authenticated)
  if (AUTH_TOKEN) {
    const availabilityPayload = JSON.stringify({
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 172800000).toISOString(),
    });

    const availabilityResponse = http.post(
      `${BASE_URL}/api/bookings/check-availability`,
      availabilityPayload,
      { headers }
    );

    check(availabilityResponse, {
      'availability check completes': (r) => r.status === 200 || r.status === 400,
    });
  }

  errorRate.add(false);
  throughput.add(2); // Count as 2 operations
}

/**
 * Test: Authentication Operations
 */
function testAuthOperations(headers) {
  // Test login endpoint with invalid credentials (to avoid affecting real users)
  const loginPayload = JSON.stringify({
    email: `stress-test-${Date.now()}@example.com`,
    password: 'StressTestPassword123!',
  });

  const response = http.post(`${BASE_URL}/api/auth/login`, loginPayload, { headers });

  // 401 is expected for invalid credentials
  const success = check(response, {
    'auth returns expected status': (r) => r.status === 401 || r.status === 200 || r.status === 429,
    'auth response time < 300ms': (r) => r.timings.duration < 300,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
  throughput.add(1);
}

/**
 * Test: Payment Processing Simulation
 */
function testPaymentProcessing(headers) {
  // Simulate payment intent creation
  const payload = JSON.stringify({
    amount: Math.floor(Math.random() * 50000) + 1000, // $10-$500
    currency: 'USD',
    bookingId: `stress-booking-${Date.now()}`,
  });

  const response = http.post(
    `${BASE_URL}/api/payments/intent`,
    payload,
    { headers }
  );

  // 401 if not authenticated, 400 if validation fails, 200 if success
  const success = check(response, {
    'payment intent returns valid status': (r) => 
      r.status === 200 || r.status === 400 || r.status === 401,
  });

  errorRate.add(!success);
  throughput.add(1);
}

/**
 * Test: Concurrent Read Operations
 */
function testConcurrentReads(headers) {
  // Fire multiple concurrent requests
  const requests = [
    { method: 'GET', url: `${BASE_URL}/api/listings?limit=10` },
    { method: 'GET', url: `${BASE_URL}/api/categories` },
    { method: 'GET', url: `${BASE_URL}/api/health` },
  ];

  const responses = http.batch(requests.map(r => ({
    method: r.method,
    url: r.url,
    params: { headers },
  })));

  let allSuccess = true;
  responses.forEach((response, index) => {
    const success = check(response, {
      [`concurrent request ${index + 1} succeeds`]: (r) => r.status === 200,
    });
    if (!success) allSuccess = false;
  });

  errorRate.add(!allSuccess);
  throughput.add(requests.length);
}

/**
 * Teardown function - runs once after all VUs complete
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60; // minutes
  console.log(`\nTest completed. Duration: ${duration.toFixed(2)} minutes`);
  console.log('Stress test scenarios executed successfully');
}
