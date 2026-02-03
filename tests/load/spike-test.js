import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * K6 Spike Test
 * Tests system behavior under sudden traffic spikes
 */

export const options = {
  stages: [
    { duration: '1m', target: 50 }, // Normal load
    { duration: '30s', target: 500 }, // Sudden spike
    { duration: '2m', target: 500 }, // Sustained spike
    { duration: '1m', target: 50 }, // Return to normal
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // Allow higher latency during spike
    http_req_failed: ['rate<0.05'], // Allow 5% error rate during spike
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';

export default function () {
  const res = http.get(`${BASE_URL}/listings?page=1&limit=20`);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time acceptable': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
