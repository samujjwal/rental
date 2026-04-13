/**
 * Comprehensive Stress Test Suite
 * 
 * Stress testing for critical endpoints to identify breaking points:
 * - Database connection pool exhaustion
 * - Memory pressure under high load
 * - CPU saturation scenarios
 * - Network bottleneck identification
 * - Concurrent write operations
 * - Large dataset queries
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const dbConnectionRate = new Rate('db_connection_rate');
const memoryPressureRate = new Rate('memory_pressure');

// Test configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const TEST_DURATION = '5m';
const STRESS_LEVEL = __ENV.STRESS_LEVEL || 'high'; // low, medium, high, extreme

// Stress levels configuration
const STRESS_CONFIGS = {
  low: { vus: 50, max_vus: 100, duration: '3m' },
  medium: { vus: 100, max_vus: 200, duration: '5m' },
  high: { vus: 200, max_vus: 400, duration: '10m' },
  extreme: { vus: 500, max_vus: 1000, duration: '15m' },
};

const config = STRESS_CONFIGS[STRESS_LEVEL] || STRESS_CONFIGS.high;

export const options = {
  stages: [
    { duration: '1m', target: config.vus * 0.2 }, // Ramp up to 20%
    { duration: '2m', target: config.vus * 0.5 }, // Ramp up to 50%
    { duration: config.duration, target: config.vus }, // Sustained stress
    { duration: '2m', target: config.vus * 0.3 }, // Ramp down
    { duration: '1m', target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // 95% under 2s, 99% under 5s
    http_req_failed: ['rate<0.1'], // Error rate under 10%
    errors: ['rate<0.05'], // Custom error rate under 5%
  },
};

// Test data generators
function generateRandomUser() {
  return `user_${Math.random().toString(36).substr(2, 9)}@test.com`;
}

function generateRandomListing() {
  return {
    title: `Test Listing ${Math.random().toString(36).substr(2, 5)}`,
    basePrice: Math.floor(Math.random() * 5000) + 1000,
    location: ['Kathmandu', 'Pokhara', 'Lalitpur', 'Bhaktapur'][Math.floor(Math.random() * 4)],
  };
}

function generateRandomBooking() {
  const startDate = new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + (Math.random() * 7 + 1) * 24 * 60 * 60 * 1000);
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    guestCount: Math.floor(Math.random() * 4) + 1,
  };
}

// ============================================================================
// STRESS TEST 1: Database Connection Pool Exhaustion
// ============================================================================
export function dbConnectionPoolStress() {
  const url = `${BASE_URL}/api/listings`;
  
  const response = http.get(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
    'has data': (r) => JSON.parse(r.body).data !== undefined,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);

  // Simulate database connection pressure
  if (response.timings.duration > 1000) {
    dbConnectionRate.add(1);
  }

  sleep(Math.random() * 2);
}

// ============================================================================
// STRESS TEST 2: Concurrent Write Operations
// ============================================================================
export function concurrentWriteStress() {
  const listing = generateRandomListing();
  const url = `${BASE_URL}/api/listings`;
  
  const response = http.post(url, JSON.stringify(listing), {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.TEST_TOKEN || 'test-token'}`,
    },
  });

  const success = check(response, {
    'status is 201 or 409': (r) => r.status === 201 || r.status === 409,
    'response time < 3s': (r) => r.timings.duration < 3000,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);

  sleep(Math.random() * 3);
}

// ============================================================================
// STRESS TEST 3: Large Dataset Queries
// ============================================================================
export function largeDatasetQueryStress() {
  const url = `${BASE_URL}/api/listings?page=1&limit=100&sort=price&order=desc`;
  
  const response = http.get(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
    'has 100 listings': (r) => JSON.parse(r.body).data?.length === 100,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);

  sleep(Math.random() * 4);
}

// ============================================================================
// STRESS TEST 4: Memory Pressure Simulation
// ============================================================================
export function memoryPressureStress() {
  // Simulate memory-intensive operations
  const url = `${BASE_URL}/api/analytics/dashboard`;
  
  const response = http.get(url, {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.TEST_TOKEN || 'test-token'}`,
    },
  });

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 3s': (r) => r.timings.duration < 3000,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);

  if (response.timings.duration > 2000) {
    memoryPressureRate.add(1);
  }

  sleep(Math.random() * 2);
}

// ============================================================================
// STRESS TEST 5: CPU Saturation
// ============================================================================
export function cpuSaturationStress() {
  // Simulate CPU-intensive operations
  const url = `${BASE_URL}/api/search?q=test&filters=price:1000-5000,category:apartment`;
  
  const response = http.get(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);

  sleep(Math.random() * 1);
}

// ============================================================================
// STRESS TEST 6: Network Bottleneck
// ============================================================================
export function networkBottleneckStress() {
  const url = `${BASE_URL}/api/listings/listing-id/images`;
  
  const response = http.get(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
    'has images': (r) => JSON.parse(r.body).data?.length > 0,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);

  sleep(Math.random() * 0.5);
}

// ============================================================================
// STRESS TEST 7: Mixed Workload
// ============================================================================
export function mixedWorkloadStress() {
  const scenarios = [
    dbConnectionPoolStress,
    concurrentWriteStress,
    largeDatasetQueryStress,
    memoryPressureStress,
  ];
  
  const selectedScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  selectedScenario();
}

// ============================================================================
// STRESS TEST 8: Booking Flow Under Stress
// ============================================================================
export function bookingFlowStress() {
  const booking = generateRandomBooking();
  const url = `${BASE_URL}/api/bookings`;
  
  const response = http.post(url, JSON.stringify({
    listingId: 'test-listing-id',
    ...booking,
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.TEST_TOKEN || 'test-token'}`,
    },
  });

  const success = check(response, {
    'status is 201 or 409': (r) => r.status === 201 || r.status === 409,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);

  sleep(Math.random() * 5);
}

// ============================================================================
// STRESS TEST 9: Authentication Under Stress
// ============================================================================
export function authStress() {
  const url = `${BASE_URL}/api/auth/login`;
  
  const response = http.post(url, JSON.stringify({
    email: generateRandomUser(),
    password: 'test-password',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);

  sleep(Math.random() * 1);
}

// ============================================================================
// STRESS TEST 10: Search Under Stress
// ============================================================================
export function searchStress() {
  const queries = [
    'apartment',
    'house',
    'room',
    'kathmandu',
    'pokhara',
    'cheap',
    'luxury',
  ];
  
  const query = queries[Math.floor(Math.random() * queries.length)];
  const url = `${BASE_URL}/api/search?q=${query}`;
  
  const response = http.get(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1.5s': (r) => r.timings.duration < 1500,
    'has results': (r) => JSON.parse(r.body).data?.length >= 0,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);

  sleep(Math.random() * 1.5);
}

// Default scenario - mixed workload
export default function () {
  mixedWorkloadStress();
}
