/**
 * K6 SLO Baseline Test — Rental Portal
 *
 * This file is the CANONICAL source of SLO thresholds for all k6 load tests.
 * All other test files in tests/load/ MUST import thresholds from here.
 *
 * Baseline scenario: steady-state at 50 VUs for 10 minutes.
 * Use this as the nightly CI smoke-level performance gate.
 *
 * Source of truth: docs/SLO.md §6 — Load Test Baseline Thresholds
 *
 * Run:  k6 run --env API_URL=http://localhost:3000/api tests/load/slo-baseline.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Canonical SLO thresholds (mirror of docs/SLO.md §6) ────────────────────
export const SLO_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
  search_latency: ['p(95)<400'],
  listing_latency: ['p(95)<300'],
  booking_latency: ['p(95)<800'],
  auth_latency: ['p(95)<500'],
  ai_latency: ['p(95)<8000'],
  failed_checks: ['rate<0.02'],
};

// ── Custom metrics ─────────────────────────────────────────────────────────
const searchLatency = new Trend('search_latency', true);
const listingLatency = new Trend('listing_latency', true);
const bookingLatency = new Trend('booking_latency', true);
const authLatency = new Trend('auth_latency', true);
const aiLatency = new Trend('ai_latency', true);
const failedChecks = new Rate('failed_checks');

// ── Baseline scenario: steady 50 VUs × 10 min ─────────────────────────────
export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
    },
  },
  thresholds: SLO_THRESHOLDS,
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'loadtest@example.com', password: 'LoadTest123!' }),
    { headers: JSON_HEADERS },
  );
  if (res.status === 200) {
    return { token: JSON.parse(res.body).accessToken || '' };
  }
  return { token: '' };
}

export default function (data) {
  const authHeaders = {
    ...JSON_HEADERS,
    Authorization: `Bearer ${data.token}`,
  };

  group('Auth', () => {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: 'loadtest@example.com', password: 'LoadTest123!' }),
      { headers: JSON_HEADERS },
    );
    authLatency.add(res.timings.duration);
    const ok = check(res, {
      'auth: status 200': (r) => r.status === 200,
      'auth: p95 < 500 ms': (r) => r.timings.duration < 500,
    });
    failedChecks.add(!ok);
  });

  sleep(1);

  group('Listings search', () => {
    const res = http.get(`${BASE_URL}/listings?page=1&limit=10`);
    searchLatency.add(res.timings.duration);
    const ok = check(res, {
      'listings: status 200': (r) => r.status === 200,
      'listings: p95 < 400 ms': (r) => r.timings.duration < 400,
      'listings: has data': (r) => {
        try { return JSON.parse(r.body).data != null; } catch { return false; }
      },
    });
    failedChecks.add(!ok);
  });

  sleep(1);

  group('Listing detail', () => {
    const listRes = http.get(`${BASE_URL}/listings?page=1&limit=1`);
    if (listRes.status === 200) {
      const listings = JSON.parse(listRes.body).data;
      if (listings && listings.length > 0) {
        const detailRes = http.get(`${BASE_URL}/listings/${listings[0].id}`);
        listingLatency.add(detailRes.timings.duration);
        const ok = check(detailRes, {
          'detail: status 200': (r) => r.status === 200,
          'detail: p95 < 300 ms': (r) => r.timings.duration < 300,
        });
        failedChecks.add(!ok);
      }
    }
  });

  sleep(2);
}

export function handleSummary(data) {
  const passed = Object.entries(data.metrics)
    .filter(([, m]) => m.thresholds)
    .every(([, m]) => Object.values(m.thresholds).every((t) => !t.ok === false));

  return {
    stdout: JSON.stringify(
      {
        slo_baseline_passed: passed,
        timestamp: new Date().toISOString(),
        metrics: {
          p95_http: data.metrics.http_req_duration?.values?.['p(95)'],
          p99_http: data.metrics.http_req_duration?.values?.['p(99)'],
          error_rate: data.metrics.http_req_failed?.values?.rate,
          search_p95: data.metrics.search_latency?.values?.['p(95)'],
          listing_p95: data.metrics.listing_latency?.values?.['p(95)'],
          auth_p95: data.metrics.auth_latency?.values?.['p(95)'],
        },
      },
      null,
      2,
    ),
  };
}
