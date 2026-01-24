import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const searchLatency = new Trend('search_latency');
const geoSearchLatency = new Trend('geo_search_latency');
const autocompleteLatency = new Trend('autocomplete_latency');
const searchCounter = new Counter('searches_performed');
const resultCounter = new Counter('total_results_returned');

// Test configuration - higher VUs for search as it's read-heavy
export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '2m', target: 200 }, // Peak load: 200 concurrent users
    { duration: '1m', target: 100 }, // Ramp down
    { duration: '30s', target: 0 }, // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'], // Search should be fast
    http_req_failed: ['rate<0.01'], // Error rate < 1%
    errors: ['rate<0.03'], // Custom error rate < 3%
    search_latency: ['p(95)<400', 'p(99)<1000'],
    geo_search_latency: ['p(95)<500', 'p(99)<1200'],
    autocomplete_latency: ['p(95)<200', 'p(99)<500'], // Autocomplete must be fast
  },
  ext: {
    loadimpact: {
      name: 'Search Queries Load Test',
      projectID: 3596745,
    },
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const API_VERSION = 'v1';
const API_BASE = `${BASE_URL}/api/${API_VERSION}`;

// Common search queries from different categories
const searchQueries = [
  // Electronics
  'camera',
  'laptop',
  'drone',
  'tablet',
  'headphones',
  // Transportation
  'car',
  'bike',
  'scooter',
  'kayak',
  'boat',
  // Tools
  'drill',
  'saw',
  'ladder',
  'generator',
  'compressor',
  // Sports
  'tent',
  'bicycle',
  'skateboard',
  'surfboard',
  'snowboard',
  // Party
  'projector',
  'speaker',
  'tent',
  'table',
  'chair',
  // Fashion
  'dress',
  'suit',
  'costume',
  'jewelry',
  'bag',
];

// Location coordinates for geo-search (major US cities)
const locations = [
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { name: 'Houston', lat: 29.7604, lon: -95.3698 },
  { name: 'Phoenix', lat: 33.4484, lon: -112.074 },
  { name: 'Philadelphia', lat: 39.9526, lon: -75.1652 },
  { name: 'San Antonio', lat: 29.4241, lon: -98.4936 },
  { name: 'San Diego', lat: 32.7157, lon: -117.1611 },
  { name: 'Dallas', lat: 32.7767, lon: -96.797 },
  { name: 'San Jose', lat: 37.3382, lon: -121.8863 },
];

// Price ranges for filtering
const priceRanges = [
  { min: 0, max: 50 },
  { min: 50, max: 100 },
  { min: 100, max: 200 },
  { min: 200, max: 500 },
];

// Setup function
export function setup() {
  console.log('Preparing search load test...');

  // Create a test user for authenticated searches
  const userSignup = http.post(
    `${API_BASE}/auth/signup`,
    JSON.stringify({
      email: `searcher_${Date.now()}@loadtest.com`,
      password: 'LoadTest123!@#',
      name: 'Load Test Searcher',
      role: 'renter',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  const userData = JSON.parse(userSignup.body);

  return {
    authToken: userData.accessToken,
  };
}

/**
 * Main VU code - simulates different search patterns
 */
export default function (data) {
  const { authToken } = data;

  // Randomly choose a search pattern
  const patterns = [basicSearch, geoSearch, filteredSearch, autocompleteSearch, advancedSearch];

  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  pattern(authToken);

  sleep(Math.random() * 3 + 1); // Random think time 1-4 seconds
}

/**
 * Pattern 1: Basic keyword search
 */
function basicSearch(authToken) {
  group('Basic Search', () => {
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
    const page = Math.floor(Math.random() * 3) + 1; // Pages 1-3
    const limit = 20;

    const searchStart = new Date();
    const res = http.get(`${API_BASE}/search?q=${query}&page=${page}&limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const searchDuration = new Date() - searchStart;
    searchLatency.add(searchDuration);

    const success = check(res, {
      'search successful': (r) => r.status === 200,
      'has results array': (r) => {
        const body = JSON.parse(r.body);
        return Array.isArray(body.results);
      },
      'has pagination': (r) => {
        const body = JSON.parse(r.body);
        return body.total !== undefined && body.page !== undefined;
      },
    });

    if (success) {
      searchCounter.add(1);
      const body = JSON.parse(res.body);
      resultCounter.add(body.results.length);
    } else {
      errorRate.add(1);
    }
  });
}

/**
 * Pattern 2: Geo-spatial search
 */
function geoSearch(authToken) {
  group('Geo-Spatial Search', () => {
    const location = locations[Math.floor(Math.random() * locations.length)];
    const radius = [10, 25, 50, 100][Math.floor(Math.random() * 4)]; // km
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];

    const searchStart = new Date();
    const res = http.get(
      `${API_BASE}/search?q=${query}&latitude=${location.lat}&longitude=${location.lon}&radius=${radius}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    );

    const searchDuration = new Date() - searchStart;
    geoSearchLatency.add(searchDuration);

    const success = check(res, {
      'geo search successful': (r) => r.status === 200,
      'results have distance': (r) => {
        const body = JSON.parse(r.body);
        return body.results.length === 0 || body.results[0].distance !== undefined;
      },
      'results sorted by distance': (r) => {
        const body = JSON.parse(r.body);
        if (body.results.length < 2) return true;
        return body.results[0].distance <= body.results[1].distance;
      },
    });

    if (success) {
      searchCounter.add(1);
      const body = JSON.parse(res.body);
      resultCounter.add(body.results.length);
    } else {
      errorRate.add(1);
    }
  });
}

/**
 * Pattern 3: Filtered search
 */
function filteredSearch(authToken) {
  group('Filtered Search', () => {
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
    const priceRange = priceRanges[Math.floor(Math.random() * priceRanges.length)];
    const bookingMode = ['INSTANT', 'REQUEST'][Math.floor(Math.random() * 2)];

    const params = new URLSearchParams({
      q: query,
      minPrice: priceRange.min.toString(),
      maxPrice: priceRange.max.toString(),
      bookingMode: bookingMode,
      limit: '20',
    });

    const searchStart = new Date();
    const res = http.get(`${API_BASE}/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const searchDuration = new Date() - searchStart;
    searchLatency.add(searchDuration);

    const success = check(res, {
      'filtered search successful': (r) => r.status === 200,
      'results respect price range': (r) => {
        const body = JSON.parse(r.body);
        if (body.results.length === 0) return true;
        return body.results.every(
          (item) => item.pricePerDay >= priceRange.min && item.pricePerDay <= priceRange.max,
        );
      },
      'results respect booking mode': (r) => {
        const body = JSON.parse(r.body);
        if (body.results.length === 0) return true;
        return body.results.every((item) => item.bookingMode === bookingMode);
      },
    });

    if (success) {
      searchCounter.add(1);
      const body = JSON.parse(res.body);
      resultCounter.add(body.results.length);
    } else {
      errorRate.add(1);
    }
  });
}

/**
 * Pattern 4: Autocomplete
 */
function autocompleteSearch(authToken) {
  group('Autocomplete', () => {
    const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
    const prefix = query.substring(0, Math.floor(Math.random() * query.length) + 1);

    const searchStart = new Date();
    const res = http.get(`${API_BASE}/search/autocomplete?q=${prefix}&limit=10`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const searchDuration = new Date() - searchStart;
    autocompleteLatency.add(searchDuration);

    const success = check(res, {
      'autocomplete successful': (r) => r.status === 200,
      'returns suggestions': (r) => {
        const body = JSON.parse(r.body);
        return Array.isArray(body.suggestions);
      },
      'suggestions limited to 10': (r) => {
        const body = JSON.parse(r.body);
        return body.suggestions.length <= 10;
      },
      'fast response': (r) => r.timings.duration < 300, // Must be < 300ms
    });

    if (!success) {
      errorRate.add(1);
    }
  });
}

/**
 * Pattern 5: Advanced search (POST with complex query)
 */
function advancedSearch(authToken) {
  group('Advanced Search', () => {
    const location = locations[Math.floor(Math.random() * locations.length)];
    const priceRange = priceRanges[Math.floor(Math.random() * priceRanges.length)];

    const advancedQuery = {
      keywords: searchQueries.slice(0, 3),
      location: {
        latitude: location.lat,
        longitude: location.lon,
        radius: 50,
      },
      filters: {
        priceRange: {
          min: priceRange.min,
          max: priceRange.max,
        },
        bookingMode: 'INSTANT',
        condition: ['EXCELLENT', 'GOOD'],
      },
      sort: ['price_asc', 'newest', 'distance'][Math.floor(Math.random() * 3)],
      page: 1,
      limit: 20,
    };

    const searchStart = new Date();
    const res = http.post(`${API_BASE}/search/advanced`, JSON.stringify(advancedQuery), {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    const searchDuration = new Date() - searchStart;
    searchLatency.add(searchDuration);

    const success = check(res, {
      'advanced search successful': (r) => r.status === 200,
      'has results': (r) => {
        const body = JSON.parse(r.body);
        return Array.isArray(body.results);
      },
      'respects all filters': (r) => {
        const body = JSON.parse(r.body);
        if (body.results.length === 0) return true;
        return body.results.every(
          (item) =>
            item.pricePerDay >= priceRange.min &&
            item.pricePerDay <= priceRange.max &&
            item.bookingMode === 'INSTANT',
        );
      },
    });

    if (success) {
      searchCounter.add(1);
      const body = JSON.parse(res.body);
      resultCounter.add(body.results.length);
    } else {
      errorRate.add(1);
    }
  });
}

/**
 * Teardown function
 */
export function teardown(data) {
  console.log('Search load test completed.');
}
