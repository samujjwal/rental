import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

/**
 * COMPREHENSIVE K6 LOAD TESTING SCRIPT FOR API
 * 
 * This script tests API performance under various load conditions:
 * - API endpoint performance testing
 * - Concurrent user handling validation
 * - Database performance under load
 * - Cache performance verification
 * - System scalability assessment
 * 
 * Test Scenarios:
 * 1. Public API endpoints (listings, categories, search)
 * 2. Authenticated user workflows (profile, bookings, favorites)
 * 3. Booking creation and management
 * 4. Payment processing simulation
 * 5. Search and filtering operations
 * 6. Real-time updates (WebSocket simulation)
 */

// Custom metrics for comprehensive monitoring
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');
const databaseQueryTime = new Trend('database_query_time');
const cacheHitRate = new Rate('cache_hit_rate');
const bookingCreationTime = new Trend('booking_creation_time');
const paymentProcessingTime = new Trend('payment_processing_time');
const searchResponseTime = new Trend('search_response_time');
const concurrentUsers = new Trend('concurrent_users');

// Test configuration with realistic load patterns
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Warm up - 50 users
    { duration: '5m', target: 100 },  // Ramp up to 100 users
    { duration: '10m', target: 200 }, // Normal load - 200 users
    { duration: '5m', target: 300 },  // Increased load - 300 users
    { duration: '3m', target: 500 },  // Peak load - 500 users
    { duration: '2m', target: 1000 }, // Stress test - 1000 users
    { duration: '5m', target: 500 },  // Scale down - 500 users
    { duration: '5m', target: 200 },  // Normal load - 200 users
    { duration: '2m', target: 0 },    // Cool down
  ],
  thresholds: {
    // Response time thresholds (more aggressive for production readiness)
    http_req_duration: ['p(50)<200', 'p(95)<500', 'p(99)<1000', 'p(99.9)<2000'],
    http_req_failed: ['rate<0.01'], // Error rate under 1%
    errors: ['rate<0.02'], // Custom error rate under 2%
    
    // Specific endpoint thresholds
    'api_response_time': ['p(95)<400'],
    'database_query_time': ['p(95)<100'],
    'booking_creation_time': ['p(95)<800'],
    'payment_processing_time': ['p(95)<1500'],
    'search_response_time': ['p(95)<600'],
    
    // System resource thresholds
    'cache_hit_rate': ['rate>0.8'], // Cache hit rate above 80%
  },
  // Connection management
  noConnectionReuse: false,
  userAgent: 'K6LoadTest/1.0',
  httpDebug: 'full', // Enable for debugging
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';

// Test data generation
const generateTestData = () => {
  const randomId = Math.floor(Math.random() * 1000000);
  return {
    user: {
      email: `loadtest${randomId}@example.com`,
      password: 'LoadTest123!',
      name: `Load Test User ${randomId}`,
      phone: `98${randomId.toString().padStart(8, '0')}`,
    },
    listing: {
      title: `Test Listing ${randomId}`,
      description: 'Load test listing for performance testing',
      category: 'property',
      price: Math.floor(Math.random() * 50000) + 10000,
      location: 'Kathmandu',
      amenities: ['wifi', 'parking'],
    },
    booking: {
      startDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
      guests: Math.floor(Math.random() * 4) + 1,
    },
  };
};

let authToken = '';
let testUsers = [];

export function setup() {
  console.log('Setting up load test environment...');
  
  // Create multiple test users for realistic simulation
  for (let i = 0; i < 10; i++) {
    const userData = generateTestData().user;
    
    // Register user
    const registerRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify(userData), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    let token = '';
    if (registerRes.status === 201 || registerRes.status === 200) {
      // Login to get token
      const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
        email: userData.email,
        password: userData.password,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (loginRes.status === 200) {
        const body = JSON.parse(loginRes.body);
        token = body.accessToken;
        testUsers.push({ ...userData, token });
      }
    }
  }
  
  console.log(`Created ${testUsers.length} test users`);
  return { users: testUsers };
}

export default function (data) {
  const users = data.users || [];
  const currentUser = users[Math.floor(Math.random() * users.length)];
  authToken = currentUser?.token || '';
  
  // Track concurrent users
  concurrentUsers.add(users.length);
  
  group('Public API Endpoints', () => {
    // Test listings search with pagination
    group('GET /listings (search)', () => {
      const params = new URLSearchParams({
        page: Math.floor(Math.random() * 10) + 1,
        limit: 20,
        category: ['property', 'vehicle', 'equipment'][Math.floor(Math.random() * 3)],
        minPrice: Math.floor(Math.random() * 10000),
        maxPrice: Math.floor(Math.random() * 50000) + 10000,
      });
      
      const startTime = Date.now();
      const res = http.get(`${BASE_URL}/listings?${params}`);
      const endTime = Date.now();
      
      check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
        'has listings data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.data && body.data.length >= 0;
          } catch {
            return false;
          }
        },
        'pagination info present': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.pagination !== undefined;
          } catch {
            return false;
          }
        },
      });
      
      apiResponseTime.add(res.timings.duration);
      searchResponseTime.add(res.timings.duration);
      errorRate.add(res.status !== 200);
      
      if (res.status === 200) {
        successfulRequests.add(1);
        
        // Check cache headers
        const cacheControl = res.headers['Cache-Control'];
        if (cacheControl && cacheControl.includes('hit')) {
          cacheHitRate.add(1);
        }
      }
    });

    // Test single listing retrieval
    group('GET /listings/:id', () => {
      const listingIds = ['sample-1', 'sample-2', 'sample-3']; // Sample listing IDs
      const listingId = listingIds[Math.floor(Math.random() * listingIds.length)];
      
      const res = http.get(`${BASE_URL}/listings/${listingId}`);
      
      check(res, {
        'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
        'response time < 300ms': (r) => r.timings.duration < 300,
        'valid JSON response': (r) => {
          try {
            JSON.parse(r.body);
            return true;
          } catch {
            return false;
          }
        },
      });
      
      apiResponseTime.add(res.timings.duration);
    });

    // Test categories endpoint
    group('GET /categories', () => {
      const res = http.get(`${BASE_URL}/categories`);
      
      check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 200ms': (r) => r.timings.duration < 200,
        'has categories array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.data) && body.data.length > 0;
          } catch {
            return false;
          }
        },
      });
      
      apiResponseTime.add(res.timings.duration);
    });

    // Test search suggestions
    group('GET /search/suggestions', () => {
      const queries = ['apartment', 'house', 'car', 'kathmandu', 'pokhara'];
      const query = queries[Math.floor(Math.random() * queries.length)];
      
      const res = http.get(`${BASE_URL}/search/suggestions?q=${query}`);
      
      check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 300ms': (r) => r.timings.duration < 300,
        'has suggestions': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.suggestions && Array.isArray(body.suggestions);
          } catch {
            return false;
          }
        },
      });
      
      searchResponseTime.add(res.timings.duration);
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
          'has user data': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.data && body.data.id;
            } catch {
              return false;
            }
          },
        });
        
        apiResponseTime.add(res.timings.duration);
      });

      // Test user favorites
      group('GET /favorites', () => {
        const res = http.get(`${BASE_URL}/favorites`, { headers });
        
        check(res, {
          'status is 200': (r) => r.status === 200,
          'response time < 300ms': (r) => r.timings.duration < 300,
          'valid favorites response': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.data && Array.isArray(body.data);
            } catch {
              return false;
            }
          },
        });
        
        apiResponseTime.add(res.timings.duration);
      });

      // Test user bookings
      group('GET /bookings', () => {
        const params = new URLSearchParams({
          page: Math.floor(Math.random() * 5) + 1,
          limit: 10,
          status: ['active', 'completed', 'cancelled'][Math.floor(Math.random() * 3)],
        });
        
        const res = http.get(`${BASE_URL}/bookings?${params}`, { headers });
        
        check(res, {
          'status is 200': (r) => r.status === 200,
          'response time < 400ms': (r) => r.timings.duration < 400,
          'has bookings data': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.data && Array.isArray(body.data);
            } catch {
              return false;
            }
          },
        });
        
        apiResponseTime.add(res.timings.duration);
      });

      // Test booking creation (write operation)
      group('POST /bookings', () => {
        const bookingData = generateTestData().booking;
        const listingId = `listing-${Math.floor(Math.random() * 100)}`;
        
        const startTime = Date.now();
        const res = http.post(`${BASE_URL}/bookings`, JSON.stringify({
          listingId,
          ...bookingData,
        }), { headers });
        const endTime = Date.now();
        
        check(res, {
          'status is 201 or 400 or 404': (r) => [201, 400, 404].includes(r.status),
          'response time < 800ms': (r) => r.timings.duration < 800,
          'valid booking response': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.data || body.message; // Either success or error message
            } catch {
              return false;
            }
          },
        });
        
        bookingCreationTime.add(endTime - startTime);
        apiResponseTime.add(res.timings.duration);
        
        if (res.status === 201) {
          successfulRequests.add(1);
        }
      });

      // Test payment processing simulation
      group('POST /payments/process', () => {
        const paymentData = {
          bookingId: `booking-${Math.floor(Math.random() * 1000)}`,
          amount: Math.floor(Math.random() * 50000) + 5000,
          currency: 'NPR',
          paymentMethod: 'credit_card',
          cardInfo: {
            number: '4111111111111111', // Test card number
            expiry: '12/25',
            cvv: '123',
          },
        };
        
        const startTime = Date.now();
        const res = http.post(`${BASE_URL}/payments/process`, JSON.stringify(paymentData), { headers });
        const endTime = Date.now();
        
        check(res, {
          'status is 200, 201, 400 or 404': (r) => [200, 201, 400, 404].includes(r.status),
          'response time < 1500ms': (r) => r.timings.duration < 1500,
          'valid payment response': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.data || body.message || body.error;
            } catch {
              return false;
            }
          },
        });
        
        paymentProcessingTime.add(endTime - startTime);
        apiResponseTime.add(res.timings.duration);
      });

      // Test message sending (real-time simulation)
      group('POST /messages', () => {
        const messageData = {
          recipientId: `user-${Math.floor(Math.random() * 1000)}`,
          listingId: `listing-${Math.floor(Math.random() * 100)}`,
          message: `Load test message ${Math.random().toString(36).substring(7)}`,
          type: 'text',
        };
        
        const res = http.post(`${BASE_URL}/messages`, JSON.stringify(messageData), { headers });
        
        check(res, {
          'status is 201 or 400': (r) => [201, 400].includes(r.status),
          'response time < 500ms': (r) => r.timings.duration < 500,
          'valid message response': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.data || body.message;
            } catch {
              return false;
            }
          },
        });
        
        apiResponseTime.add(res.timings.duration);
      });
    });
  }

  // Database performance simulation (complex queries)
  group('Database Performance Tests', () => {
    // Test complex search with multiple filters
    group('Complex Search Query', () => {
      const complexParams = new URLSearchParams({
        category: 'property',
        location: 'Kathmandu',
        minPrice: 10000,
        maxPrice: 50000,
        amenities: 'wifi,parking,gym',
        availability: 'true',
        sortBy: 'price',
        sortOrder: 'asc',
        page: 1,
        limit: 20,
      });
      
      const startTime = Date.now();
      const res = http.get(`${BASE_URL}/listings/search?${complexParams}`);
      const endTime = Date.now();
      
      check(res, {
        'status is 200': (r) => r.status === 200,
        'complex query time < 800ms': (r) => r.timings.duration < 800,
        'has filtered results': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.data && Array.isArray(body.data);
          } catch {
            return false;
          }
        },
      });
      
      databaseQueryTime.add(endTime - startTime);
      apiResponseTime.add(res.timings.duration);
    });

    // Test analytics endpoint (aggregation queries)
    group('GET /analytics/dashboard', () => {
      if (authToken) {
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        };
        
        const startTime = Date.now();
        const res = http.get(`${BASE_URL}/analytics/dashboard`, { headers });
        const endTime = Date.now();
        
        check(res, {
          'status is 200 or 403': (r) => r.status === 200 || r.status === 403,
          'analytics query time < 1200ms': (r) => r.timings.duration < 1200,
          'valid analytics data': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.data || body.message;
            } catch {
              return false;
            }
          },
        });
        
        databaseQueryTime.add(endTime - startTime);
        apiResponseTime.add(res.timings.duration);
      }
    });
  });

  // Cache performance tests
  group('Cache Performance Tests', () => {
    // Test cached endpoint repeatedly
    group('Cached Endpoint Access', () => {
      const endpoint = `${BASE_URL}/categories`;
      
      // First request (cache miss)
      const firstRes = http.get(endpoint);
      
      // Second request (should be cache hit)
      const secondRes = http.get(endpoint);
      
      check(firstRes, {
        'first request status is 200': (r) => r.status === 200,
        'first request time < 300ms': (r) => r.timings.duration < 300,
      });
      
      check(secondRes, {
        'second request status is 200': (r) => r.status === 200,
        'second request faster than first': (r) => r.timings.duration < firstRes.timings.duration,
        'cache hit response < 100ms': (r) => r.timings.duration < 100,
      });
      
      apiResponseTime.add(firstRes.timings.duration);
      apiResponseTime.add(secondRes.timings.duration);
      
      // Check if second request was faster (indicating cache hit)
      if (secondRes.timings.duration < firstRes.timings.duration) {
        cacheHitRate.add(1);
      }
    });
  });

  // Simulate realistic user think time between actions
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds
}

export function teardown(data) {
  console.log('Load test completed');
  console.log(`Test users created: ${data.users?.length || 0}`);
  
  // Cleanup test data if needed
  if (data.users && data.users.length > 0) {
    console.log('Cleaning up test users...');
    // Could add cleanup logic here
  }
}
