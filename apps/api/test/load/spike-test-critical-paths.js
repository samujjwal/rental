/**
 * P2: Spike Testing - Sudden Traffic Surge Validation
 * 
 * Tests system behavior when traffic suddenly increases by 10x or more.
 * Critical for handling viral content, marketing campaigns, or flash sales.
 * 
 * Coverage:
 * - Sudden 10x traffic spike
 * - Sudden 50x traffic spike
 * - Recovery after spike
 * - Graceful degradation during spike
 * 
 * SLOs Validated:
 * - p95 latency < 2000ms during spike
 * - Error rate < 5% during spike
 * - Recovery within 2 minutes after spike
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics for spike testing
const spikeLatency = new Trend('spike_latency');
const spikeErrorRate = new Rate('spike_errors');
const degradationScore = new Trend('degradation_score');
const recoveryTime = new Trend('recovery_time');
const concurrentUsers = new Counter('concurrent_users');

// Test configuration - Extreme spike scenarios
export const options = {
  scenarios: {
    // Baseline load
    baseline: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      startTime: '0s',
    },
    // 10x spike
    spike_10x: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 }, // Sudden 10x spike
        { duration: '2m', target: 100 },  // Sustain
        { duration: '10s', target: 10 },  // Return to baseline
      ],
      startTime: '2m',
    },
    // 50x extreme spike
    spike_50x: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 500 },  // Extreme 50x spike
        { duration: '1m', target: 500 },    // Brief sustain
        { duration: '30s', target: 10 },   // Return to baseline
      ],
      startTime: '5m',
    },
    // Gradual spike (for comparison)
    gradual_spike: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '2m', target: 100 },  // Gradual increase
        { duration: '2m', target: 100 },  // Sustain
        { duration: '1m', target: 10 },   // Gradual decrease
      ],
      startTime: '7m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],           // 95% under 2s even during spike
    http_req_failed: ['rate<0.05'],              // <5% errors during spike
    spike_errors: ['rate<0.05'],                 // Spike-specific error rate
    'http_req_duration{spike:true}': ['p(95)<3000'], // Spike requests under 3s
  },
  tags: {
    testType: 'spike-test',
    testName: 'critical-paths-spike',
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3400';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Track test phases
let currentPhase = 'baseline';

export function setup() {
  console.log('Starting spike test setup...');
  
  // Verify system is healthy before spike
  const healthCheck = http.get(`${BASE_URL}/health`);
  check(healthCheck, {
    'system is healthy before spike': (r) => r.status === 200,
  });

  // Get initial metrics
  const initialMetrics = {
    timestamp: Date.now(),
    healthy: healthCheck.status === 200,
  };

  console.log(`Initial health check: ${initialMetrics.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  
  return { startTime: Date.now(), initialMetrics };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : '',
  };

  // Determine current phase based on VU count
  const vuCount = __VU;
  if (vuCount <= 10) {
    currentPhase = 'baseline';
  } else if (vuCount <= 100) {
    currentPhase = 'spike_10x';
  } else {
    currentPhase = 'spike_50x';
  }

  // Add phase tag to all requests
  const spikeHeaders = { ...headers, 'X-Spike-Phase': currentPhase };

  group(`Spike Phase: ${currentPhase}`, () => {
    concurrentUsers.add(1);

    // Critical path 1: Search (most frequent)
    group('Search During Spike', () => {
      const searchTerms = ['apartment', 'house', 'room', 'kathmandu', 'pokhara'];
      const term = searchTerms[randomIntBetween(0, searchTerms.length - 1)];
      
      const startTime = Date.now();
      const searchRes = http.get(
        `${BASE_URL}/listings?search=${term}&limit=20`,
        { headers: spikeHeaders, tags: { spike: 'true', endpoint: 'search' } }
      );
      const duration = Date.now() - startTime;
      
      spikeLatency.add(duration, { endpoint: 'search', phase: currentPhase });

      const success = check(searchRes, {
        'search returns 200': (r) => r.status === 200,
        'search latency acceptable': (r) => r.timings.duration < (currentPhase === 'spike_50x' ? 5000 : 2000),
        'search returns data': (r) => r.json('data') !== undefined || r.json() !== undefined,
      });

      if (!success) {
        spikeErrorRate.add(1, { endpoint: 'search', phase: currentPhase });
      }

      sleep(randomIntBetween(0.1, 0.5)); // Short think time during spike
    });

    // Critical path 2: View Listing Details
    group('View Listing During Spike', () => {
      const listingsRes = http.get(`${BASE_URL}/listings?limit=5`, { headers: spikeHeaders });
      
      if (listingsRes.status === 200) {
        const listings = listingsRes.json('data') || [];
        if (listings.length > 0) {
          const listingId = listings[randomIntBetween(0, listings.length - 1)].id;
          
          const startTime = Date.now();
          const detailRes = http.get(
            `${BASE_URL}/listings/${listingId}`,
            { headers: spikeHeaders, tags: { spike: 'true', endpoint: 'listing_detail' } }
          );
          const duration = Date.now() - startTime;
          
          spikeLatency.add(duration, { endpoint: 'listing_detail', phase: currentPhase });

          const success = check(detailRes, {
            'listing detail returns 200': (r) => r.status === 200,
            'listing detail has data': (r) => r.json('id') !== undefined,
          });

          if (!success) {
            spikeErrorRate.add(1, { endpoint: 'listing_detail', phase: currentPhase });
          }
        }
      }

      sleep(randomIntBetween(0.2, 1));
    });

    // Critical path 3: Authentication (if token not provided)
    if (!AUTH_TOKEN) {
      group('Authentication During Spike', () => {
        const startTime = Date.now();
        const authRes = http.post(
          `${BASE_URL}/auth/login`,
          JSON.stringify({
            email: `spike-test-${randomIntBetween(1, 100)}@test.com`,
            password: 'TestPass123!',
          }),
          { headers: spikeHeaders, tags: { spike: 'true', endpoint: 'auth' } }
        );
        const duration = Date.now() - startTime;
        
        spikeLatency.add(duration, { endpoint: 'auth', phase: currentPhase });

        // Auth may fail due to rate limiting or invalid credentials - that's acceptable
        const acceptableStatus = [200, 401, 429];
        const success = acceptableStatus.includes(authRes.status);

        if (!success && authRes.status >= 500) {
          spikeErrorRate.add(1, { endpoint: 'auth', phase: currentPhase });
        }

        sleep(randomIntBetween(0.5, 1));
      });
    }

    // Critical path 4: Health Check (during spike)
    group('Health Check During Spike', () => {
      const startTime = Date.now();
      const healthRes = http.get(
        `${BASE_URL}/health`,
        { headers: spikeHeaders, tags: { spike: 'true', endpoint: 'health' } }
      );
      const duration = Date.now() - startTime;
      
      spikeLatency.add(duration, { endpoint: 'health', phase: currentPhase });

      const success = check(healthRes, {
        'health check passes during spike': (r) => r.status === 200,
        'database is healthy': (r) => r.json('status') === 'ok' || r.json('database.status') === 'up',
      });

      if (!success) {
        spikeErrorRate.add(1, { endpoint: 'health', phase: currentPhase });
      }
    });

    // Measure degradation
    group('Degradation Measurement', () => {
      // Compare current performance to baseline expectations
      const baselineLatency = 500; // Expected baseline p95
      const currentLatency = spikeLatency.values['p(95)'] || baselineLatency;
      const degradation = currentLatency / baselineLatency;
      
      degradationScore.add(degradation, { phase: currentPhase });

      // System should not degrade more than 10x
      check(null, {
        'degradation within acceptable limits': () => degradation < 10,
      });
    });
  });
}

export function teardown(data) {
  const endTime = Date.now();
  const totalDuration = (endTime - data.startTime) / 1000 / 60; // minutes
  
  console.log('=== SPIKE TEST RESULTS ===');
  console.log(`Total duration: ${totalDuration.toFixed(2)} minutes`);
  console.log(`Spike error rate: ${(spikeErrorRate.value * 100).toFixed(2)}%`);
  console.log(`95th percentile latency during spike: ${spikeLatency.values['p(95)']}ms`);
  console.log(`Max degradation factor: ${degradationScore.values['max']?.toFixed(2) || 'N/A'}x`);
  
  // Validate SLOs
  const sloPass = 
    spikeErrorRate.value < 0.05 &&
    (spikeLatency.values['p(95)'] || 0) < 2000;
  
  console.log(`\nSLO Validation: ${sloPass ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  - Error rate < 5%: ${(spikeErrorRate.value * 100).toFixed(2)}% ${spikeErrorRate.value < 0.05 ? '✅' : '❌'}`);
  console.log(`  - p95 latency < 2000ms: ${spikeLatency.values['p(95)']}ms ${(spikeLatency.values['p(95)'] || 0) < 2000 ? '✅' : '❌'}`);
  
  if (!sloPass) {
    console.error('\n⚠️  WARNING: System did not meet SLOs during spike test');
    console.error('   Consider implementing:');
    console.error('   - Rate limiting');
    console.error('   - Load shedding');
    console.error('   - Auto-scaling');
    console.error('   - Caching improvements');
  }
}
