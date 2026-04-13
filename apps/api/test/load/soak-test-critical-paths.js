/**
 * P3: Performance Soak Tests for Critical Paths
 *
 * Extended duration load tests to detect:
 * - Memory leaks
 * - Connection pool exhaustion
 * - Gradual performance degradation
 * - Resource exhaustion under sustained load
 *
 * Run with: k6 run --duration 30m soak-test-critical-paths.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const bookingSuccessRate = new Rate('booking_success');
const paymentSuccessRate = new Rate('payment_success');
const searchResponseTime = new Trend('search_response_time');
const memoryUsageTrend = new Trend('memory_usage');
const errorCounter = new Counter('errors');

// Test configuration - Soak test: sustained load for extended period
export const options = {
  stages: [
    // Ramp up
    { duration: '5m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 100 }, // Ramp up to 100 users
    // Sustained load (soak phase)
    { duration: '30m', target: 100 }, // Stay at 100 users for 30 minutes
    // Variable load (spike tests during soak)
    { duration: '2m', target: 200 }, // Spike to 200 users
    { duration: '5m', target: 100 }, // Return to 100 users
    { duration: '30m', target: 100 }, // Continue soak at 100 users
    { duration: '2m', target: 200 }, // Another spike
    { duration: '5m', target: 100 }, // Return to 100 users
    { duration: '30m', target: 100 }, // Final soak phase
    // Ramp down
    { duration: '5m', target: 50 },
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'], // Less than 5% errors
    booking_success: ['rate>0.95'], // 95%+ booking success
    payment_success: ['rate>0.98'], // 98%+ payment success
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3400';

// Test data
const testUsers = [
  { email: 'soak-test-1@test.com', password: 'TestPass123!' },
  { email: 'soak-test-2@test.com', password: 'TestPass123!' },
  { email: 'soak-test-3@test.com', password: 'TestPass123!' },
];

let authToken = null;
let userId = null;

export function setup() {
  console.log('Starting soak test setup...');
  
  // Login and get auth token
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: testUsers[0].email,
    password: testUsers[0].password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'has access token': (r) => r.json('accessToken') !== undefined,
  });

  authToken = loginRes.json('accessToken');
  userId = loginRes.json('user.id');

  return { authToken, userId };
}

export default function (data) {
  const token = data.authToken;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  group('Search Listings (High Frequency)', () => {
    const searchTerms = ['apartment', 'house', 'room', 'kathmandu', 'pokhara', 'bhaktapur'];
    const term = searchTerms[randomIntBetween(0, searchTerms.length - 1)];
    
    const startTime = Date.now();
    const searchRes = http.get(
      `${BASE_URL}/listings?search=${term}&limit=20`,
      { headers }
    );
    const duration = Date.now() - startTime;
    searchResponseTime.add(duration);

    const success = check(searchRes, {
      'search status is 200': (r) => r.status === 200,
      'search returns results': (r) => r.json('data') !== undefined,
      'search response time OK': (r) => r.timings.duration < 1000,
    });

    if (!success) {
      errorCounter.add(1);
    }

    sleep(randomIntBetween(1, 3)); // Think time between searches
  });

  group('View Listing Details (Medium Frequency)', () => {
    // Get a listing first
    const listingsRes = http.get(`${BASE_URL}/listings?limit=5`, { headers });
    
    if (listingsRes.status === 200 && listingsRes.json('data')) {
      const listings = listingsRes.json('data');
      if (listings.length > 0) {
        const listingId = listings[randomIntBetween(0, listings.length - 1)].id;
        
        const detailRes = http.get(
          `${BASE_URL}/listings/${listingId}`,
          { headers }
        );

        check(detailRes, {
          'listing detail status is 200': (r) => r.status === 200,
          'listing has required fields': (r) => 
            r.json('id') !== undefined && 
            r.json('title') !== undefined,
        });
      }
    }

    sleep(randomIntBetween(2, 5));
  });

  group('Booking Flow (Low Frequency)', () => {
    // Get available listing
    const listingsRes = http.get(
      `${BASE_URL}/listings?status=AVAILABLE&limit=3`,
      { headers }
    );

    if (listingsRes.status === 200) {
      const listings = listingsRes.json('data') || [];
      
      if (listings.length > 0) {
        const listing = listings[randomIntBetween(0, listings.length - 1)];
        
        // Create booking
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + randomIntBetween(1, 30));
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + randomIntBetween(1, 7));

        const bookingRes = http.post(
          `${BASE_URL}/bookings`,
          JSON.stringify({
            listingId: listing.id,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            guestCount: randomIntBetween(1, 4),
          }),
          { headers }
        );

        const bookingSuccess = check(bookingRes, {
          'booking created': (r) => r.status === 201,
          'booking has ID': (r) => r.json('id') !== undefined,
        });

        bookingSuccessRate.add(bookingSuccess);

        if (bookingSuccess) {
          const bookingId = bookingRes.json('id');
          
          // Get booking details
          http.get(`${BASE_URL}/bookings/${bookingId}`, { headers });

          // Simulate payment intent (don't complete actual payment in soak test)
          const paymentRes = http.post(
            `${BASE_URL}/payments/create-intent`,
            JSON.stringify({
              bookingId: bookingId,
              amount: listing.basePrice * 3, // 3 nights
              currency: listing.currency || 'NPR',
            }),
            { headers }
          );

          const paymentSuccess = check(paymentRes, {
            'payment intent created': (r) => r.status === 201 || r.status === 200,
            'has client secret': (r) => r.json('clientSecret') !== undefined,
          });

          paymentSuccessRate.add(paymentSuccess);

          if (!paymentSuccess) {
            errorCounter.add(1);
          }
        } else {
          errorCounter.add(1);
        }
      }
    }

    sleep(randomIntBetween(5, 10)); // Longer think time between bookings
  });

  group('User Dashboard (Medium Frequency)', () => {
    // Get user profile
    const profileRes = http.get(`${BASE_URL}/users/me`, { headers });
    check(profileRes, {
      'profile load success': (r) => r.status === 200,
    });

    // Get user bookings
    const bookingsRes = http.get(`${BASE_URL}/bookings/my-bookings`, { headers });
    check(bookingsRes, {
      'my bookings loaded': (r) => r.status === 200,
    });

    // Get notifications
    const notificationsRes = http.get(`${BASE_URL}/notifications`, { headers });
    check(notificationsRes, {
      'notifications loaded': (r) => r.status === 200,
    });

    sleep(randomIntBetween(3, 6));
  });

  group('Health Check (Periodic)', () => {
    // Only run for some iterations (every ~20th request)
    if (Math.random() < 0.05) {
      const healthRes = http.get(`${BASE_URL}/health`);
      
      check(healthRes, {
        'health check passes': (r) => r.status === 200,
        'database is healthy': (r) => r.json('status') === 'healthy' || r.json('database.status') === 'up',
      });

      // Log memory if endpoint provides it
      if (healthRes.json('memory')) {
        memoryUsageTrend.add(healthRes.json('memory.used') || 0);
      }
    }
  });
}

export function teardown(data) {
  console.log('Soak test completed');
  console.log(`Final booking success rate: ${bookingSuccessRate.value * 100}%`);
  console.log(`Final payment success rate: ${paymentSuccessRate.value * 100}%`);
  console.log(`Total errors: ${errorCounter.value}`);
  console.log(`95th percentile search response time: ${searchResponseTime.values['p(95)']}ms`);
}
