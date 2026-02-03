import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

/**
 * K6 Load Testing Script for API
 * Tests API performance under various load conditions
 */

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Spike to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '5m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'], // Error rate under 1%
    errors: ['rate<0.05'], // Custom error rate under 5%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';

// Test data
const testUser = {
  email: 'loadtest@example.com',
  password: 'LoadTest123!',
};

let authToken = '';

export function setup() {
  // Login once to get auth token
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify(testUser), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return { token: body.accessToken };
  }

  return { token: '' };
}

export default function (data) {
  authToken = data.token;

  group('Public API Endpoints', () => {
    // Test listings search
    group('GET /listings', () => {
      const res = http.get(`${BASE_URL}/listings?page=1&limit=20`);

      check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
        'has listings': (r) => JSON.parse(r.body).data.length > 0,
      });

      apiResponseTime.add(res.timings.duration);
      errorRate.add(res.status !== 200);

      if (res.status === 200) {
        successfulRequests.add(1);
      }
    });

    // Test single listing
    group('GET /listings/:id', () => {
      const res = http.get(`${BASE_URL}/listings/sample-id`);

      check(res, {
        'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
        'response time < 300ms': (r) => r.timings.duration < 300,
      });

      apiResponseTime.add(res.timings.duration);
    });

    // Test categories
    group('GET /categories', () => {
      const res = http.get(`${BASE_URL}/categories`);

      check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 200ms': (r) => r.timings.duration < 200,
        'has categories': (r) => JSON.parse(r.body).length > 0,
      });

      apiResponseTime.add(res.timings.duration);
    });
  });

  if (authToken) {
    group('Authenticated API Endpoints', () => {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      };

      // Test user profile
      group('GET /users/me', () => {
        const res = http.get(`${BASE_URL}/users/me`, { headers });

        check(res, {
          'status is 200': (r) => r.status === 200,
          'response time < 200ms': (r) => r.timings.duration < 200,
        });

        apiResponseTime.add(res.timings.duration);
      });

      // Test favorites
      group('GET /favorites', () => {
        const res = http.get(`${BASE_URL}/favorites`, { headers });

        check(res, {
          'status is 200': (r) => r.status === 200,
          'response time < 300ms': (r) => r.timings.duration < 300,
        });

        apiResponseTime.add(res.timings.duration);
      });

      // Test bookings
      group('GET /bookings', () => {
        const res = http.get(`${BASE_URL}/bookings`, { headers });

        check(res, {
          'status is 200': (r) => r.status === 200,
          'response time < 400ms': (r) => r.timings.duration < 400,
        });

        apiResponseTime.add(res.timings.duration);
      });
    });
  }

  // Simulate user think time
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

export function teardown(data) {
  // Cleanup if needed
  console.log('Load test completed');
}
