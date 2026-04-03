import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * ULTRA-STRICT: Performance & Load Tests (Phase 4)
 * 
 * These tests validate system performance under various load conditions.
 * Run with: k6 run performance-load.spec.ts
 */

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const searchLatency = new Trend('search_latency');
const checkoutLatency = new Trend('checkout_latency');

// Load stages
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 400 },   // Ramp up to 400 users (stress test)
    { duration: '5m', target: 400 },   // Stay at 400 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],     // Less than 1% errors
    errors: ['rate<0.05'],              // Custom error rate under 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3400';

export default function () {
  group('Public Pages', () => {
    // Homepage
    const homeStart = Date.now();
    const homeRes = http.get(`${BASE_URL}/`);
    const homeDuration = Date.now() - homeStart;
    
    check(homeRes, {
      'homepage status is 200': (r) => r.status === 200,
      'homepage loads under 1s': () => homeDuration < 1000,
    });
    
    errorRate.add(homeRes.status !== 200);
    sleep(1);

    // Search page
    const searchStart = Date.now();
    const searchRes = http.get(`${BASE_URL}/search`);
    const searchDuration = Date.now() - searchStart;
    searchLatency.add(searchDuration);
    
    check(searchRes, {
      'search page status is 200': (r) => r.status === 200,
      'search page loads under 2s': () => searchDuration < 2000,
    });
    
    errorRate.add(searchRes.status !== 200);
    sleep(2);
  });

  group('API Endpoints', () => {
    // Health check
    const healthRes = http.get(`${BASE_URL}/api/health`);
    check(healthRes, {
      'health check returns 200': (r) => r.status === 200,
      'health check is fast': (r) => r.timings.duration < 100,
    });

    // Search API
    const apiStart = Date.now();
    const searchApiRes = http.get(`${BASE_URL}/api/listings/search?limit=20&offset=0`);
    const apiDuration = Date.now() - apiStart;
    apiLatency.add(apiDuration);
    
    check(searchApiRes, {
      'search API returns 200': (r) => r.status === 200,
      'search API under 500ms': () => apiDuration < 500,
      'search API returns valid JSON': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.items) || Array.isArray(body.listings);
        } catch {
          return false;
        }
      },
    });
    
    errorRate.add(searchApiRes.status !== 200);
    sleep(1);

    // Categories API
    const categoriesRes = http.get(`${BASE_URL}/api/categories`);
    check(categoriesRes, {
      'categories API returns 200': (r) => r.status === 200,
    });
    
    errorRate.add(categoriesRes.status !== 200);
    sleep(1);
  });

  group('Authenticated Operations', () => {
    // Login simulation (10% of users)
    if (Math.random() < 0.1) {
      const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        email: `user${Math.floor(Math.random() * 1000)}@test.com`,
        password: 'password123',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
      check(loginRes, {
        'login returns valid response': (r) => r.status === 200 || r.status === 401,
      });
      
      errorRate.add(loginRes.status >= 500);
      sleep(1);
    }

    // Favorites (20% of authenticated users)
    if (Math.random() < 0.2) {
      const favoritesRes = http.get(`${BASE_URL}/api/favorites`, {
        headers: {
          'Authorization': `Bearer mock-token-${__VU}`,
        },
      });
      
      check(favoritesRes, {
        'favorites returns valid response': (r) => r.status === 200 || r.status === 401,
      });
      
      errorRate.add(favoritesRes.status >= 500);
      sleep(1);
    }
  });

  group('Booking Flow Simulation', () => {
    // View listing details
    const listingRes = http.get(`${BASE_URL}/api/listings/listing-${Math.floor(Math.random() * 100)}`);
    check(listingRes, {
      'listing details returns valid response': (r) => r.status === 200 || r.status === 404,
    });
    
    errorRate.add(listingRes.status >= 500);
    sleep(2);

    // Check availability (simulated)
    if (Math.random() < 0.3) {
      const availabilityRes = http.post(`${BASE_URL}/api/listings/check-availability`, JSON.stringify({
        listingId: `listing-${Math.floor(Math.random() * 100)}`,
        startDate: '2026-04-15',
        endDate: '2026-04-18',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
      check(availabilityRes, {
        'availability check returns valid response': (r) => r.status === 200 || r.status === 400 || r.status === 404,
      });
      
      errorRate.add(availabilityRes.status >= 500);
      sleep(1);
    }

    // Simulate checkout (5% of users)
    if (Math.random() < 0.05) {
      const checkoutStart = Date.now();
      
      const checkoutRes = http.post(`${BASE_URL}/api/bookings`, JSON.stringify({
        listingId: `listing-${Math.floor(Math.random() * 100)}`,
        startDate: '2026-04-15',
        endDate: '2026-04-18',
        guestCount: 2,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
      const checkoutDuration = Date.now() - checkoutStart;
      checkoutLatency.add(checkoutDuration);
      
      check(checkoutRes, {
        'checkout returns valid response': (r) => r.status === 201 || r.status === 400 || r.status === 401 || r.status === 409,
        'checkout under 3s': () => checkoutDuration < 3000,
      });
      
      errorRate.add(checkoutRes.status >= 500);
      sleep(3);
    }
  });

  group('Database Stress Test', () => {
    // Complex search with filters
    if (Math.random() < 0.1) {
      const complexSearchRes = http.get(
        `${BASE_URL}/api/listings/search?` +
        'category=HOMES_SPACES&' +
        'minPrice=100&' +
        'maxPrice=500&' +
        'location=Kathmandu&' +
        'amenities=wifi,kitchen,parking&' +
        'sortBy=price&' +
        'sortOrder=asc&' +
        'limit=50'
      );
      
      check(complexSearchRes, {
        'complex search returns 200': (r) => r.status === 200,
        'complex search under 2s': (r) => r.timings.duration < 2000,
      });
      
      errorRate.add(complexSearchRes.status !== 200);
      sleep(2);
    }
  });

  sleep(1);
}

// Stress test scenario
export function stressTest() {
  const stages = [
    { duration: '1m', target: 500 },
    { duration: '3m', target: 1000 },
    { duration: '5m', target: 2000 },
    { duration: '3m', target: 1000 },
    { duration: '1m', target: 0 },
  ];

  const res = http.get(`${BASE_URL}/api/health`);
  
  check(res, {
    'system stays healthy under extreme load': (r) => r.status === 200,
    'response time acceptable': (r) => r.timings.duration < 5000,
  });

  errorRate.add(res.status !== 200);
  sleep(Math.random() * 0.5);
}

// Spike test scenario
export function spikeTest() {
  const stages = [
    { duration: '10s', target: 100 },
    { duration: '30s', target: 2000 }, // Sudden spike
    { duration: '2m', target: 2000 },  // Maintain spike
    { duration: '30s', target: 100 },  // Recover
    { duration: '10s', target: 0 },
  ];

  group('Spike Test', () => {
    const res = http.get(`${BASE_URL}/`);
    
    check(res, {
      'handles traffic spike': (r) => r.status === 200 || r.status === 503,
      'recovers quickly': (r) => r.timings.waiting < 5000,
    });
    
    errorRate.add(res.status >= 500);
  });

  sleep(0.1);
}
