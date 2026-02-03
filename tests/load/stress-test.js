import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * K6 Stress Test
 * Tests system limits and breaking points
 */

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to normal load
    { duration: '5m', target: 200 }, // Increase to high load
    { duration: '5m', target: 300 }, // Push to higher load
    { duration: '5m', target: 400 }, // Push to stress level
    { duration: '5m', target: 500 }, // Push to breaking point
    { duration: '10m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // Relaxed threshold for stress test
    http_req_failed: ['rate<0.1'], // Allow 10% error rate
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';

export default function () {
  const endpoints = ['/listings', '/categories', '/listings/sample-id'];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`);

  check(res, {
    'status is not 5xx': (r) => r.status < 500,
  });

  sleep(Math.random() * 2);
}
