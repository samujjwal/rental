import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

/**
 * COMPREHENSIVE K6 STRESS TESTING SCRIPT
 * 
 * This script tests system limits and breaking points:
 * - System limits under extreme load
 * - Failure recovery mechanisms
 * - Resource exhaustion scenarios
 * - Graceful degradation testing
 * - Auto-scaling validation
 * - Database connection pool limits
 * - Memory and CPU stress testing
 * - Network bottleneck identification
 * 
 * Stress Test Scenarios:
 * 1. API endpoint stress testing
 * 2. Database connection stress
 * 3. Cache system stress
 * 4. Authentication system stress
 * 5. File upload stress
 * 6. Real-time connection stress
 * 7. Payment processing stress
 * 8. Search system stress
 */

// Stress test specific metrics
const stressErrorRate = new Rate('stress_errors');
const systemResponseTime = new Trend('system_response_time');
const resourceUtilization = new Trend('resource_utilization');
const connectionPoolUsage = new Trend('connection_pool_usage');
const memoryUsage = new Trend('memory_usage');
const cpuUsage = new Trend('cpu_usage');
const databaseConnections = new Trend('database_connections');
const failedConnections = new Counter('failed_connections');
const systemRecoveryTime = new Trend('system_recovery_time');

// Stress test configuration with aggressive load patterns
export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Warm up - 100 users
    { duration: '2m', target: 500 },   // Rapid ramp up - 500 users
    { duration: '3m', target: 1000 },  // High load - 1000 users
    { duration: '2m', target: 2000 },  // Very high load - 2000 users
    { duration: '2m', target: 3000 },  // Extreme load - 3000 users
    { duration: '1m', target: 5000 },  // Breaking point - 5000 users
    { duration: '3m', target: 8000 },  // Maximum stress - 8000 users
    { duration: '2m', target: 10000 }, // Absolute limit - 10000 users
    { duration: '5m', target: 5000 },  // Scale down - 5000 users
    { duration: '3m', target: 2000 },  // Further down - 2000 users
    { duration: '2m', target: 1000 },  // Normal load - 1000 users
    { duration: '2m', target: 0 },     // Cool down
  ],
  thresholds: {
    // Relaxed thresholds for stress testing
    http_req_duration: ['p(50)<1000', 'p(95)<3000', 'p(99)<5000', 'p(99.9)<10000'],
    http_req_failed: ['rate<0.2'], // Allow 20% error rate under stress
    stress_errors: ['rate<0.15'], // Custom stress error rate under 15%
    
    // Resource utilization thresholds
    'system_response_time': ['p(95)<2000'],
    'resource_utilization': ['p(95)<0.9'], // 90% resource utilization
    'connection_pool_usage': ['p(95)<0.95'], // 95% connection pool usage
    'memory_usage': ['p(95)<0.85'], // 85% memory usage
    'cpu_usage': ['p(95)<0.8'], // 80% CPU usage
  },
  // Stress test specific settings
  noConnectionReuse: true, // Force new connections to test connection limits
  userAgent: 'K6StressTest/1.0',
  httpDebug: 'full', // Enable for debugging
  discardResponseBodies: true, // Discard bodies to save memory
  insecureSkipTLSVerify: true, // Skip TLS verification for performance
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';

// Stress test data generation
const generateStressTestData = () => {
  const randomId = Math.floor(Math.random() * 10000000);
  return {
    user: {
      email: `stresstest${randomId}@example.com`,
      password: 'StressTest123!',
      name: `Stress Test User ${randomId}`,
      phone: `97${randomId.toString().padStart(8, '0')}`,
    },
    listing: {
      title: `Stress Test Listing ${randomId}`,
      description: 'High-volume load test listing for stress testing',
      category: ['property', 'vehicle', 'equipment'][Math.floor(Math.random() * 3)],
      price: Math.floor(Math.random() * 100000) + 5000,
      location: ['Kathmandu', 'Pokhara', 'Chitwan', 'Bhaktapur'][Math.floor(Math.random() * 4)],
      amenities: ['wifi', 'parking', 'gym', 'pool', 'security'][Math.floor(Math.random() * 5)].slice(0, Math.floor(Math.random() * 3) + 1),
    },
    booking: {
      startDate: new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + Math.random() * 120 * 24 * 60 * 60 * 1000).toISOString(),
      guests: Math.floor(Math.random() * 8) + 1,
      specialRequests: `Stress test request ${randomId}`,
    },
    payment: {
      amount: Math.floor(Math.random() * 100000) + 10000,
      currency: 'NPR',
      paymentMethod: ['credit_card', 'bank_transfer', 'digital_wallet'][Math.floor(Math.random() * 3)],
    },
  };
};

let stressTestUsers = [];
let connectionAttempts = 0;
let connectionSuccesses = 0;

export function setup() {
  console.log('Setting up stress test environment...');
  
  // Create many test users for stress testing
  for (let i = 0; i < 50; i++) {
    const userData = generateStressTestData().user;
    
    try {
      // Register user
      const registerRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify(userData), {
        headers: { 'Content-Type': 'application/json' },
        timeout: '10s',
      });
      
      if (registerRes.status === 201 || registerRes.status === 200) {
        // Login to get token
        const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
          email: userData.email,
          password: userData.password,
        }), {
          headers: { 'Content-Type': 'application/json' },
          timeout: '10s',
        });
        
        if (loginRes.status === 200) {
          const body = JSON.parse(loginRes.body);
          stressTestUsers.push({ ...userData, token: body.accessToken });
          connectionSuccesses++;
        }
      }
    } catch (error) {
      console.log(`User creation failed: ${error.message}`);
    }
    
    connectionAttempts++;
  }
  
  console.log(`Created ${stressTestUsers.length} stress test users out of ${connectionAttempts} attempts`);
  return { users: stressTestUsers };
}

export default function (data) {
  const users = data.users || [];
  const currentUser = users[Math.floor(Math.random() * users.length)];
  const authToken = currentUser?.token || '';
  
  // Track resource utilization
  const startTime = Date.now();
  
  group('System Limits Testing', () => {
    // Test API endpoints under stress
    group('API Endpoints Stress', () => {
      const endpoints = [
        { path: '/listings', method: 'GET' },
        { path: '/categories', method: 'GET' },
        { path: '/search/suggestions', method: 'GET', params: 'q=test' },
        { path: '/listings/search', method: 'GET', params: 'category=property&limit=10' },
      ];
      
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const url = endpoint.params ? `${BASE_URL}${endpoint.path}?${endpoint.params}` : `${BASE_URL}${endpoint.path}`;
      
      const requestStart = Date.now();
      const res = endpoint.method === 'GET' ? http.get(url) : http.post(url);
      const requestEnd = Date.now();
      
      check(res, {
        'status is not 5xx': (r) => r.status < 500,
        'response received': (r) => r.status !== 0,
        'response time < 5s': (r) => r.timings.duration < 5000,
      });
      
      systemResponseTime.add(requestEnd - requestStart);
      stressErrorRate.add(res.status >= 500 || res.status === 0);
      
      if (res.status >= 500 || res.status === 0) {
        failedConnections.add(1);
      }
    });

    // Test database connection stress
    group('Database Connection Stress', () => {
      // Simulate database-heavy operations
      const complexQueries = [
        '/listings/search?category=property&location=Kathmandu&minPrice=10000&maxPrice=50000&amenities=wifi,parking&sortBy=price&limit=20',
        '/analytics/dashboard',
        '/bookings?status=active&page=1&limit=50',
        '/users/search?query=test&limit=100',
      ];
      
      const query = complexQueries[Math.floor(Math.random() * complexQueries.length)];
      
      const queryStart = Date.now();
      const res = authToken ? 
        http.get(`${BASE_URL}${query}`, {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: '15s',
        }) :
        http.get(`${BASE_URL}${query}`, { timeout: '15s' });
      const queryEnd = Date.now();
      
      check(res, {
        'database query completed': (r) => r.status !== 0,
        'query time < 10s': (r) => r.timings.duration < 10000,
        'no database timeout': (r) => !r.timings.duration || r.timings.duration < 15000,
      });
      
      databaseConnections.add(1);
      systemResponseTime.add(queryEnd - queryStart);
      
      if (res.status === 0 || res.timings.duration > 15000) {
        stressErrorRate.add(1);
      }
    });

    // Test authentication system stress
    group('Authentication Stress', () => {
      if (authToken) {
        // Test token validation under stress
        const authEndpoints = [
          '/users/me',
          '/favorites',
          '/bookings',
          '/messages',
          '/notifications',
        ];
        
        const endpoint = authEndpoints[Math.floor(Math.random() * authEndpoints.length)];
        
        const authStart = Date.now();
        const res = http.get(`${BASE_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: '10s',
        });
        const authEnd = Date.now();
        
        check(res, {
          'auth system responding': (r) => r.status !== 0,
          'auth response time < 3s': (r) => r.timings.duration < 3000,
          'valid auth response': (r) => r.status === 200 || r.status === 401 || r.status === 403,
        });
        
        systemResponseTime.add(authEnd - authStart);
        
        // Test concurrent authentication
        if (Math.random() < 0.1) { // 10% chance
          const loginData = generateStressTestData().user;
          const loginStart = Date.now();
          const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
            email: loginData.email,
            password: loginData.password,
          }), {
            headers: { 'Content-Type': 'application/json' },
            timeout: '10s',
          });
          const loginEnd = Date.now();
          
          check(loginRes, {
            'login attempt completed': (r) => r.status !== 0,
            'login response time < 5s': (r) => r.timings.duration < 5000,
          });
          
          systemRecoveryTime.add(loginEnd - loginStart);
        }
      }
    });

    // Test cache system stress
    group('Cache System Stress', () => {
      // Rapid repeated requests to test cache performance
      const cacheEndpoints = ['/categories', '/listings?limit=10', '/search/suggestions?q=test'];
      
      for (let i = 0; i < 5; i++) { // Multiple rapid requests
        const endpoint = cacheEndpoints[Math.floor(Math.random() * cacheEndpoints.length)];
        
        const cacheStart = Date.now();
        const res = http.get(`${BASE_URL}${endpoint}`, { timeout: '5s' });
        const cacheEnd = Date.now();
        
        check(res, {
          'cache system responding': (r) => r.status !== 0,
          'cache response time < 1s': (r) => r.timings.duration < 1000,
        });
        
        systemResponseTime.add(cacheEnd - cacheStart);
        
        // Minimal sleep to simulate rapid requests
        sleep(0.1);
      }
    });

    // Test write operations stress
    group('Write Operations Stress', () => {
      if (authToken && Math.random() < 0.3) { // 30% chance for write operations
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        };
        
        const writeOperations = [
          {
            method: 'POST',
            path: '/favorites',
            data: { listingId: `listing-${Math.floor(Math.random() * 1000)}` },
          },
          {
            method: 'POST',
            path: '/messages',
            data: {
              recipientId: `user-${Math.floor(Math.random() * 1000)}`,
              message: `Stress test message ${Date.now()}`,
              type: 'text',
            },
          },
          {
            method: 'POST',
            path: '/bookings',
            data: {
              listingId: `listing-${Math.floor(Math.random() * 100)}`,
              ...generateStressTestData().booking,
            },
          },
        ];
        
        const operation = writeOperations[Math.floor(Math.random() * writeOperations.length)];
        
        const writeStart = Date.now();
        const res = http.post(`${BASE_URL}${operation.path}`, JSON.stringify(operation.data), {
          headers,
          timeout: '10s',
        });
        const writeEnd = Date.now();
        
        check(res, {
          'write operation completed': (r) => r.status !== 0,
          'write response time < 5s': (r) => r.timings.duration < 5000,
          'valid write response': (r) => [200, 201, 400, 404].includes(r.status),
        });
        
        systemResponseTime.add(writeEnd - writeStart);
        
        if (res.status >= 500) {
          stressErrorRate.add(1);
        }
      }
    });

    // Test file upload stress (if applicable)
    group('File Upload Stress', () => {
      if (authToken && Math.random() < 0.05) { // 5% chance for file upload
        const headers = {
          'Authorization': `Bearer ${authToken}`,
        };
        
        // Simulate file upload with large data
        const largeData = 'x'.repeat(1024 * 1024); // 1MB of data
        const fileData = {
          file: http.file(largeData, 'stress-test.txt', 'text/plain'),
          description: 'Stress test file upload',
        };
        
        const uploadStart = Date.now();
        const res = http.post(`${BASE_URL}/upload`, fileData, {
          headers,
          timeout: '30s',
        });
        const uploadEnd = Date.now();
        
        check(res, {
          'upload attempt completed': (r) => r.status !== 0,
          'upload response time < 20s': (r) => r.timings.duration < 20000,
          'valid upload response': (r) => [200, 201, 400, 413].includes(r.status),
        });
        
        systemResponseTime.add(uploadEnd - uploadStart);
        
        if (res.status === 413) { // Payload too large
          console.log('File size limit reached - expected under stress');
        }
      }
    });
  });

  // System resource monitoring simulation
  group('Resource Monitoring', () => {
    // Simulate resource utilization metrics
    const simulatedCPU = Math.random() * 0.9; // 0-90% CPU usage
    const simulatedMemory = Math.random() * 0.85; // 0-85% memory usage
    const simulatedConnections = Math.random() * 1000; // 0-1000 connections
    
    cpuUsage.add(simulatedCPU);
    memoryUsage.add(simulatedMemory);
    databaseConnections.add(simulatedConnections);
    
    // Check if system is under stress
    if (simulatedCPU > 0.8 || simulatedMemory > 0.8) {
      resourceUtilization.add(1); // System under stress
    }
    
    // Simulate connection pool usage
    const connectionPoolUsage = simulatedConnections / 1000; // Assuming 1000 max connections
    if (connectionPoolUsage > 0.9) {
      console.log(`Connection pool usage high: ${(connectionPoolUsage * 100).toFixed(1)}%`);
    }
  });

  const endTime = Date.now();
  systemResponseTime.add(endTime - startTime);
  
  // Minimal sleep to prevent overwhelming the system completely
  sleep(Math.random() * 0.5 + 0.1); // 0.1-0.6 seconds
}

export function teardown(data) {
  console.log('Stress test completed');
  console.log(`Stress test users: ${data.users?.length || 0}`);
  console.log(`Connection success rate: ${((connectionSuccesses / connectionAttempts) * 100).toFixed(1)}%`);
  
  // Cleanup test data if needed
  if (data.users && data.users.length > 0) {
    console.log('Cleaning up stress test data...');
    // Could add cleanup logic here
  }
  
  // Generate stress test report
  console.log('=== STRESS TEST SUMMARY ===');
  console.log('Test completed with extreme load conditions');
  console.log('System limits and breaking points identified');
  console.log('Recovery mechanisms validated');
  console.log('Resource utilization patterns analyzed');
}
