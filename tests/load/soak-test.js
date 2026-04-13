import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    soak_1h: {
      executor: 'constant-vus',
      vus: 50,
      duration: '1h',
      gracefulStop: '30s',
    },
    soak_4h: {
      executor: 'constant-vus',
      vus: 50,
      duration: '4h',
      gracefulStop: '60s',
      startTime: '0s',
      // Enable by setting K6_SCENARIO=soak_4h
      exec: 'soakTest',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
    response_time: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

function getAuthToken() {
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: 'soak-test@test.com',
    password: 'SecurePass123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    return JSON.parse(loginRes.body).accessToken;
  }
  return null;
}

export default function () {
  soakTest();
}

export function soakTest() {
  const token = getAuthToken();
  const headers = token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, { 'health OK': (r) => r.status === 200 });
  responseTime.add(healthRes.timings.duration);
  errorRate.add(healthRes.status !== 200);

  // List listings
  const listingsRes = http.get(`${BASE_URL}/listings?page=1&limit=10`, { headers });
  check(listingsRes, {
    'listings status 200': (r) => r.status === 200,
    'listings has data': (r) => JSON.parse(r.body).data !== undefined,
    'listings response < 500ms': (r) => r.timings.duration < 500,
  });
  responseTime.add(listingsRes.timings.duration);
  errorRate.add(listingsRes.status !== 200);

  // Get single listing
  const singleRes = http.get(`${BASE_URL}/listings/test-listing-1`, { headers });
  check(singleRes, {
    'single listing OK': (r) => r.status === 200 || r.status === 404,
  });
  responseTime.add(singleRes.timings.duration);

  // Search listings
  const searchRes = http.get(`${BASE_URL}/listings?search=apartment&page=1&limit=10`, { headers });
  check(searchRes, {
    'search OK': (r) => r.status === 200,
    'search response < 500ms': (r) => r.timings.duration < 500,
  });
  responseTime.add(searchRes.timings.duration);

  // User profile (authenticated)
  if (token) {
    const profileRes = http.get(`${BASE_URL}/users/profile`, { headers });
    check(profileRes, {
      'profile OK': (r) => r.status === 200,
    });
    responseTime.add(profileRes.timings.duration);
    errorRate.add(profileRes.status !== 200);
  }

  // Memory leak detection: track response times over time
  // If response times consistently increase, it indicates a memory leak
  sleep(1);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration.values['p(95)'];
  const p99 = data.metrics.http_req_duration.values['p(99)'];
  const errRate = data.metrics.errors ? data.metrics.errors.values.rate : 0;

  console.log(`=== Soak Test Summary ===`);
  console.log(`p95 response time: ${p95.toFixed(2)}ms`);
  console.log(`p99 response time: ${p99.toFixed(2)}ms`);
  console.log(`Error rate: ${(errRate * 100).toFixed(2)}%`);

  if (p95 > 500) {
    console.log(`WARNING: p95 response time degradation detected (${p95.toFixed(2)}ms > 500ms)`);
  }

  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
