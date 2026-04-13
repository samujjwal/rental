/**
 * P2: SLO Validation Tests - Service Level Objective Compliance
 * 
 * Continuous validation of system performance against defined SLOs:
 * - Latency SLOs (p50, p95, p99)
 * - Availability SLOs (uptime %)
 * - Error rate SLOs
 * - Throughput SLOs
 * 
 * This test runs continuously to validate SLO compliance.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter, Gauge } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// SLO Definitions
const SLOS = {
  latency: {
    p50: 200,    // 50% of requests under 200ms
    p95: 500,    // 95% of requests under 500ms
    p99: 1000,   // 99% of requests under 1000ms
  },
  availability: {
    target: 0.999, // 99.9% availability
  },
  errorRate: {
    target: 0.001, // 0.1% error rate
  },
  throughput: {
    min: 100,     // Minimum 100 RPS
    target: 500,  // Target 500 RPS
  },
};

// Custom metrics for SLO tracking
const latencyP50 = new Trend('slo_latency_p50', true);
const latencyP95 = new Trend('slo_latency_p95', true);
const latencyP99 = new Trend('slo_latency_p99', true);
const availabilityRate = new Rate('slo_availability');
const errorRate = new Rate('slo_error_rate');
const throughputRPS = new Gauge('slo_throughput_rps');
const sloViolations = new Counter('slo_violations');

// Track SLO compliance
let totalRequests = 0;
let failedRequests = 0;
let sloCompliantRequests = 0;

export const options = {
  scenarios: {
    // Constant load at target throughput
    slo_validation: {
      executor: 'constant-arrival-rate',
      rate: 500,        // 500 requests per second
      timeUnit: '1s',
      duration: '10m',  // Run for 10 minutes
      preAllocatedVUs: 100,
      maxVUs: 200,
    },
    // Periodic bursts to test burst capacity
    burst_validation: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      stages: [
        { duration: '1m', target: 1000 },  // Burst to 1000 RPS
        { duration: '30s', target: 1000 }, // Sustain
        { duration: '30s', target: 500 },   // Return to normal
      ],
      startTime: '2m',
    },
  },
  thresholds: {
    // SLO-based thresholds
    'http_req_duration{slo:true}': [
      `p(50)<${SLOS.latency.p50}`,
      `p(95)<${SLOS.latency.p95}`,
      `p(99)<${SLOS.latency.p99}`,
    ],
    'http_req_failed{slo:true}': [`rate<${SLOS.errorRate.target}`],
    slo_violations: ['count<10'], // Less than 10 SLO violations
  },
  tags: {
    testType: 'slo-validation',
    testName: 'slo-compliance-check',
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3400';

// Endpoints to test with their SLO requirements
const ENDPOINTS = [
  { path: '/health', method: 'get', weight: 10, sloMultiplier: 0.5 },
  { path: '/categories', method: 'get', weight: 20, sloMultiplier: 1.0 },
  { path: '/listings?limit=20', method: 'get', weight: 40, sloMultiplier: 1.5 },
  { path: '/listings/search?q=test', method: 'get', weight: 15, sloMultiplier: 2.0 },
  { path: '/auth/login', method: 'post', weight: 10, sloMultiplier: 1.0, body: { email: 'test@test.com', password: 'test' } },
  { path: '/users/me', method: 'get', weight: 5, sloMultiplier: 1.0 },
];

function selectEndpoint() {
  const totalWeight = ENDPOINTS.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const endpoint of ENDPOINTS) {
    random -= endpoint.weight;
    if (random <= 0) return endpoint;
  }
  
  return ENDPOINTS[0];
}

function makeRequest(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-SLO-Test': 'true',
  };

  const startTime = Date.now();
  
  let response;
  if (endpoint.method === 'get') {
    response = http.get(url, { 
      headers,
      tags: { slo: 'true', endpoint: endpoint.path },
    });
  } else if (endpoint.method === 'post') {
    response = http.post(url, JSON.stringify(endpoint.body || {}), {
      headers,
      tags: { slo: 'true', endpoint: endpoint.path },
    });
  }

  const duration = Date.now() - startTime;
  
  return { response, duration, endpoint };
}

function validateSLOs(response, duration, endpoint) {
  const sloMultiplier = endpoint.sloMultiplier || 1.0;
  const p50Limit = SLOS.latency.p50 * sloMultiplier;
  const p95Limit = SLOS.latency.p95 * sloMultiplier;
  const p99Limit = SLOS.latency.p99 * sloMultiplier;
  
  // Check availability
  const isAvailable = response.status < 500; // 5xx = unavailable
  availabilityRate.add(isAvailable ? 1 : 0, { endpoint: endpoint.path });
  
  // Check error rate
  const isError = response.status >= 400;
  errorRate.add(isError ? 1 : 0, { endpoint: endpoint.path });
  
  // Record latency
  latencyP50.add(duration, { endpoint: endpoint.path });
  latencyP95.add(duration, { endpoint: endpoint.path });
  latencyP99.add(duration, { endpoint: endpoint.path });
  
  // Track SLO compliance
  const sloCompliant = 
    isAvailable && 
    !isError && 
    duration < p95Limit;
  
  if (!sloCompliant) {
    sloViolations.add(1, { 
      endpoint: endpoint.path,
      reason: isError ? 'error' : (duration >= p95Limit ? 'latency' : 'unavailable'),
    });
  }
  
  totalRequests++;
  if (!isAvailable || isError) failedRequests++;
  if (sloCompliant) sloCompliantRequests++;
  
  return {
    p50Pass: duration < p50Limit,
    p95Pass: duration < p95Limit,
    p99Pass: duration < p99Limit,
    availabilityPass: isAvailable,
    errorPass: !isError,
    overallPass: sloCompliant,
  };
}

export function setup() {
  console.log('=== SLO VALIDATION TEST ===');
  console.log('SLO Targets:');
  console.log(`  Latency p50: ${SLOS.latency.p50}ms`);
  console.log(`  Latency p95: ${SLOS.latency.p95}ms`);
  console.log(`  Latency p99: ${SLOS.latency.p99}ms`);
  console.log(`  Availability: ${(SLOS.availability.target * 100).toFixed(1)}%`);
  console.log(`  Error Rate: ${(SLOS.errorRate.target * 100).toFixed(2)}%`);
  console.log(`  Throughput: ${SLOS.throughput.target} RPS`);
  console.log('');
  
  return { 
    startTime: Date.now(),
    sloTargets: SLOS,
  };
}

export default function (data) {
  const endpoint = selectEndpoint();
  
  group(`SLO Validation: ${endpoint.path}`, () => {
    const { response, duration } = makeRequest(endpoint);
    const sloResults = validateSLOs(response, duration, endpoint);
    
    // Record throughput
    throughputRPS.add(1);
    
    // Validate specific checks
    check(response, {
      [`${endpoint.path} - status is acceptable`]: (r) => 
        r.status < 500, // 5xx = failure
      [`${endpoint.path} - latency p50 < ${SLOS.latency.p50 * endpoint.sloMultiplier}ms`]: () => 
        sloResults.p50Pass,
      [`${endpoint.path} - latency p95 < ${SLOS.latency.p95 * endpoint.sloMultiplier}ms`]: () => 
        sloResults.p95Pass,
    });
    
    // Log SLO violations
    if (!sloResults.overallPass) {
      console.warn(`SLO VIOLATION: ${endpoint.path} - ` +
        `Duration: ${duration}ms, ` +
        `Status: ${response.status}, ` +
        `Available: ${sloResults.availabilityPass}, ` +
        `Error: ${!sloResults.errorPass}`
      );
    }
  });
  
  // Small sleep to control request rate
  sleep(0.01); // 10ms = ~100 RPS per VU
}

export function teardown(data) {
  const endTime = Date.now();
  const duration = (endTime - data.startTime) / 1000;
  const actualRPS = totalRequests / duration;
  
  console.log('\n=== SLO VALIDATION RESULTS ===');
  console.log(`Test Duration: ${duration.toFixed(0)}s`);
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Failed Requests: ${failedRequests}`);
  console.log(`SLO Compliant Requests: ${sloCompliantRequests}`);
  console.log(`Actual Throughput: ${actualRPS.toFixed(2)} RPS`);
  console.log('');
  
  // Calculate actual SLO metrics
  const actualAvailability = (totalRequests - failedRequests) / totalRequests;
  const actualErrorRate = failedRequests / totalRequests;
  const sloComplianceRate = sloCompliantRequests / totalRequests;
  
  console.log('SLO Performance:');
  console.log(`  Availability: ${(actualAvailability * 100).toFixed(3)}% ` +
    `(target: ${(SLOS.availability.target * 100).toFixed(1)}%) ` +
    `${actualAvailability >= SLOS.availability.target ? '✅' : '❌'}`);
  console.log(`  Error Rate: ${(actualErrorRate * 100).toFixed(3)}% ` +
    `(target: <${(SLOS.errorRate.target * 100).toFixed(2)}%) ` +
    `${actualErrorRate < SLOS.errorRate.target ? '✅' : '❌'}`);
  console.log(`  SLO Compliance: ${(sloComplianceRate * 100).toFixed(2)}% ` +
    `${sloComplianceRate > 0.99 ? '✅' : '⚠️'}`);
  console.log(`  Total Violations: ${sloViolations.value}`);
  console.log('');
  
  // Latency percentiles
  console.log('Latency Percentiles:');
  console.log(`  p50: ${latencyP50.values['p(50)']}ms (target: <${SLOS.latency.p50}ms)`);
  console.log(`  p95: ${latencyP95.values['p(95)']}ms (target: <${SLOS.latency.p95}ms)`);
  console.log(`  p99: ${latencyP99.values['p(99)']}ms (target: <${SLOS.latency.p99}ms)`);
  console.log('');
  
  // Final verdict
  const allSlosMet = 
    actualAvailability >= SLOS.availability.target &&
    actualErrorRate < SLOS.errorRate.target &&
    (latencyP95.values['p(95)'] || 0) < SLOS.latency.p95;
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`SLO VALIDATION: ${allSlosMet ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`${'='.repeat(50)}\n`);
  
  if (!allSlosMet) {
    console.error('⚠️  SLOs not met. Consider:');
    if (actualAvailability < SLOS.availability.target) {
      console.error('   - Improving system reliability');
      console.error('   - Implementing better health checks');
    }
    if (actualErrorRate >= SLOS.errorRate.target) {
      console.error('   - Better error handling');
      console.error('   - Input validation improvements');
    }
    if ((latencyP95.values['p(95)'] || 0) >= SLOS.latency.p95) {
      console.error('   - Performance optimization');
      console.error('   - Database query optimization');
      console.error('   - Caching improvements');
      console.error('   - Auto-scaling');
    }
  }
}
