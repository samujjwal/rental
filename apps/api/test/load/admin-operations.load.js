/**
 * Admin Operations Load Test
 *
 * Load tests for admin dashboard operations under load:
 *   1. Login as admin
 *   2. Fetch analytics data
 *   3. List users with pagination
 *   4. List listings with filters
 *   5. View audit logs
 *   6. Moderate content
 *
 * Run:
 *   k6 run apps/api/test/load/admin-operations.load.js
 *   k6 run --env API_URL=http://staging:3400 apps/api/test/load/admin-operations.load.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const analyticsLatency = new Trend('analytics_latency');
const userListLatency = new Trend('user_list_latency');
const listingListLatency = new Trend('listing_list_latency');
const auditLogLatency = new Trend('audit_log_latency');
const moderationLatency = new Trend('moderation_latency');
const adminOperationsCounter = new Counter('admin_operations');

// Test configuration - admin operations are less frequent but critical
export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Warm-up
    { duration: '1m', target: 10 },   // Ramp to 10 concurrent admin users
    { duration: '2m', target: 20 },   // Peak: 20 concurrent admin users
    { duration: '1m', target: 10 },   // Ramp down
    { duration: '30s', target: 0 },   // Drain
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    http_req_failed: ['rate<0.02'],           // < 2% failure rate
    errors: ['rate<0.05'],                    // Custom error rate < 5%
    analytics_latency: ['p(95)<2000', 'p(99)<4000'],
    user_list_latency: ['p(95)<1500', 'p(99)<3000'],
    listing_list_latency: ['p(95)<1500', 'p(99)<3000'],
    audit_log_latency: ['p(95)<2000', 'p(99)<4000'],
    moderation_latency: ['p(95)<1000', 'p(99)<2000'],
  },
  ext: {
    loadimpact: {
      name: 'Admin Operations Load Test',
      projectID: 3596745,
    },
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3400';
const ADMIN_PASSWORD = 'AdminTest123!@#';

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

export function setup() {
  console.log(`[admin-operations] Setting up test admin account against ${BASE_URL}`);

  // Register admin
  const adminEmail = `admin_${Date.now()}@loadtest.com`;
  const adminRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({
      email: adminEmail,
      password: ADMIN_PASSWORD,
      firstName: 'LoadTest',
      lastName: 'Admin',
      role: 'admin',
    }),
    { headers: jsonHeaders() },
  );

  const adminData = safeParse(adminRes);
  if (!adminData || !adminData.accessToken) {
    console.error('[setup] Failed to register admin:', adminRes.body);
    return { error: 'admin registration failed' };
  }

  // Create some test data for admin to manage
  const ownerRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({
      email: `owner_${Date.now()}@loadtest.com`,
      password: ADMIN_PASSWORD,
      firstName: 'LoadTest',
      lastName: 'Owner',
      role: 'owner',
    }),
    { headers: jsonHeaders() },
  );

  return {
    adminEmail,
    adminToken: adminData.accessToken,
    adminUserId: adminData.user?.id,
  };
}

export default function (data) {
  if (data.error) {
    console.error('Setup failed, skipping test');
    return;
  }

  const { adminToken } = data;

  group('Admin Dashboard Analytics', () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/admin/analytics?period=7d`,
      { headers: jsonHeaders(adminToken) },
    );
    analyticsLatency.add(Date.now() - start);
    adminOperationsCounter.add(1);

    check(res, {
      'analytics response status 200': (r) => r.status === 200,
      'analytics has data': (r) => {
        const body = safeParse(r);
        return body && (body.users !== undefined || body.listings !== undefined);
      },
    }) || errorRate.add(1);

    sleep(1);
  });

  group('User List with Pagination', () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/admin/users?page=1&limit=20`,
      { headers: jsonHeaders(adminToken) },
    );
    userListLatency.add(Date.now() - start);
    adminOperationsCounter.add(1);

    check(res, {
      'user list response status 200': (r) => r.status === 200,
      'user list has users array': (r) => {
        const body = safeParse(r);
        return body && Array.isArray(body.users);
      },
    }) || errorRate.add(1);

    sleep(1);
  });

  group('Listing List with Filters', () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/admin/listings?status=ACTIVE&page=1&limit=20`,
      { headers: jsonHeaders(adminToken) },
    );
    listingListLatency.add(Date.now() - start);
    adminOperationsCounter.add(1);

    check(res, {
      'listing list response status 200': (r) => r.status === 200,
      'listing list has listings array': (r) => {
        const body = safeParse(r);
        return body && Array.isArray(body.listings);
      },
    }) || errorRate.add(1);

    sleep(1);
  });

  group('Audit Logs View', () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/admin/audit-logs?limit=50`,
      { headers: jsonHeaders(adminToken) },
    );
    auditLogLatency.add(Date.now() - start);
    adminOperationsCounter.add(1);

    check(res, {
      'audit logs response status 200': (r) => r.status === 200,
      'audit logs has logs array': (r) => {
        const body = safeParse(r);
        return body && Array.isArray(body.logs);
      },
    }) || errorRate.add(1);

    sleep(1);
  });

  group('Moderation Queue', () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/admin/moderation/queue?status=PENDING`,
      { headers: jsonHeaders(adminToken) },
    );
    moderationLatency.add(Date.now() - start);
    adminOperationsCounter.add(1);

    check(res, {
      'moderation queue response status 200': (r) => r.status === 200,
      'moderation queue has data': (r) => {
        const body = safeParse(r);
        return body !== null;
      },
    }) || errorRate.add(1);

    sleep(1);
  });

  // Random think time between operations
  sleep(Math.random() * 2 + 1);
}

export function teardown(data) {
  if (data.adminToken) {
    // Cleanup would go here in production
    console.log('[teardown] Admin operations load test completed');
  }
}
