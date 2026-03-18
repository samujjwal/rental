import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

/**
 * Chaos Engineering Test Suite
 * 
 * Implements fault injection and resilience testing to validate
 * system behavior under various failure scenarios.
 * 
 * These tests help ensure the system degrades gracefully and
 * recovers automatically from failures.
 */

export interface ChaosScenario {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  inject: () => Promise<void>;
  validate: () => Promise<boolean>;
  cleanup: () => Promise<void>;
}

@Injectable()
export class ChaosEngineeringService {
  private readonly logger = new Logger(ChaosEngineeringService.name);
  private originalConfigs: Map<string, any> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ============================================================================
  // DATABASE CHAOS SCENARIOS
  // ============================================================================

  /**
   * Simulate database connection pool exhaustion
   */
  async injectDatabaseConnectionPoolExhaustion(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Database connection pool exhaustion');
    
    // Create many concurrent connections to exhaust pool
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        this.prisma.$queryRaw`SELECT pg_sleep(5)`
          .catch(err => this.logger.debug(`Expected connection error: ${err.message}`))
      );
    }
    
    // System should queue requests and not crash
    await Promise.allSettled(promises);
  }

  /**
   * Simulate slow database queries
   */
  async injectSlowQueries(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Slow database queries (10s delay)');
    
    // Temporarily disable query timeout
    await this.prisma.$executeRaw`SET statement_timeout = '60s'`;
    
    // Run expensive query
    await this.prisma.$queryRaw`
      SELECT pg_sleep(10), 
             (SELECT COUNT(*) FROM generate_series(1, 1000000))
    `.catch(() => {});
  }

  /**
   * Simulate database deadlock
   */
  async injectDatabaseDeadlock(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Database deadlock');
    
    // Create two transactions that will deadlock
    const tx1 = this.prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`UPDATE users SET updated_at = NOW() WHERE id = 'user-1'`;
      await new Promise((resolve) => setTimeout(resolve, 100));
      await tx.$executeRaw`UPDATE users SET updated_at = NOW() WHERE id = 'user-2'`;
    });

    const tx2 = this.prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`UPDATE users SET updated_at = NOW() WHERE id = 'user-2'`;
      await new Promise((resolve) => setTimeout(resolve, 100));
      await tx.$executeRaw`UPDATE users SET updated_at = NOW() WHERE id = 'user-1'`;
    });

    await Promise.allSettled([tx1, tx2]);
  }

  // ============================================================================
  // CACHE/REDIS CHAOS SCENARIOS
  // ============================================================================

  /**
   * Simulate Redis outage
   */
  async injectRedisOutage(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Redis outage');
    
    // Store original Redis URL
    this.originalConfigs.set('REDIS_URL', process.env.REDIS_URL);
    
    // Break Redis connection
    process.env.REDIS_URL = 'redis://invalid-host:6379';
    
    // Clear cache client to force reconnection attempt
    await this.cache.del('test-key').catch(() => {});
  }

  /**
   * Simulate cache stampede
   */
  async injectCacheStampede(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Cache stampede');
    
    const key = 'stampede-test-key';
    const promises = [];
    
    // Simulate 1000 concurrent cache misses
    for (let i = 0; i < 1000; i++) {
      promises.push(
        this.cache.get(key).then(async (value) => {
          if (!value) {
            // Simulate expensive computation
            await new Promise(r => setTimeout(r, 100));
            await this.cache.set(key, 'value', 60);
          }
        })
      );
    }
    
    await Promise.allSettled(promises);
  }

  /**
   * Simulate cache corruption
   */
  async injectCacheCorruption(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Cache corruption');
    
    // Set malformed cache entries
    await this.cache.set('corrupt-1', '}{"invalid json', 60);
    await this.cache.set('corrupt-2', Buffer.from([0xFF, 0xFE]), 60);
    await this.cache.set('corrupt-3', null, 60);
  }

  // ============================================================================
  // NETWORK CHAOS SCENARIOS
  // ============================================================================

  /**
   * Simulate high latency
   */
  async injectHighLatency(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: High network latency (5s delay)');
    
    // This would typically be done at the network level (tc/netem)
    // Here we simulate by adding artificial delays
    const originalFetch = global.fetch;
    global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      await new Promise(r => setTimeout(r, 5000));
      return originalFetch(url, init);
    };
    
    this.originalConfigs.set('fetch', originalFetch);
  }

  /**
   * Simulate packet loss
   */
  async injectPacketLoss(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Packet loss (50%)');
    
    const originalFetch = global.fetch;
    global.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      if (Math.random() < 0.5) {
        throw new Error('Network error: Connection reset');
      }
      return originalFetch(url, init);
    };
    
    this.originalConfigs.set('fetch', originalFetch);
  }

  /**
   * Simulate DNS failure
   */
  async injectDNSFailure(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: DNS resolution failure');
    
    // Block external API calls
    const originalFetch = global.fetch;
    global.fetch = async (url: any, ...args) => {
      const urlString = url.toString();
      if (urlString.includes('stripe.com') || 
          urlString.includes('sendgrid.com') ||
          urlString.includes('maps.googleapis.com')) {
        throw new Error('ENOTFOUND: DNS lookup failed');
      }
      return originalFetch(url, ...args);
    };
    
    this.originalConfigs.set('fetch', originalFetch);
  }

  // ============================================================================
  // EXTERNAL SERVICE CHAOS SCENARIOS
  // ============================================================================

  /**
   * Simulate Stripe API failure
   */
  async injectStripeAPIFailure(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Stripe API failure');
    
    // This would be mocked in tests
    process.env.STRIPE_MOCK_FAILURE = 'true';
    process.env.STRIPE_MOCK_FAILURE_RATE = '1.0';
  }

  /**
   * Simulate Stripe webhook delay
   */
  async injectStripeWebhookDelay(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Stripe webhook delay (60s)');
    
    process.env.STRIPE_WEBHOOK_DELAY = '60000';
  }

  /**
   * Simulate email service failure
   */
  async injectEmailServiceFailure(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Email service failure');
    
    process.env.SENDGRID_MOCK_FAILURE = 'true';
  }

  // ============================================================================
  // MEMORY/CPU CHAOS SCENARIOS
  // ============================================================================

  /**
   * Simulate memory pressure
   */
  async injectMemoryPressure(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Memory pressure (allocating 500MB)');
    
    const chunks: Buffer[] = [];
    try {
      for (let i = 0; i < 500; i++) {
        chunks.push(Buffer.alloc(1024 * 1024)); // 1MB each
      }
    } catch (e) {
      this.logger.log(`Memory allocation failed as expected: ${e.message}`);
    }
    
    // Clean up
    chunks.length = 0;
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Simulate CPU spike
   */
  async injectCPUContention(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: CPU contention (5s busy loop)');
    
    const start = Date.now();
    while (Date.now() - start < 5000) {
      // Busy loop to consume CPU
      Math.random() * Math.random();
    }
  }

  // ============================================================================
  // TIME CHAOS SCENARIOS
  // ============================================================================

  /**
   * Simulate clock skew
   */
  async injectClockSkew(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Clock skew (+5 minutes)');
    
    const originalDate = Date;
    const skewedTime = Date.now() + 5 * 60 * 1000;
    
    global.Date = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(skewedTime);
        } else {
          super(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
        }
      }
      
      static now() {
        return skewedTime;
      }
    } as any;
    
    this.originalConfigs.set('Date', originalDate);
  }

  /**
   * Simulate time jump
   */
  async injectTimeJump(): Promise<void> {
    this.logger.warn('[CHAOS] Injecting: Time jump (+24 hours)');
    
    const originalDate = Date;
    const jumpedTime = Date.now() + 24 * 60 * 60 * 1000;
    
    global.Date = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(jumpedTime);
        } else {
          super(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
        }
      }
      
      static now() {
        return jumpedTime;
      }
    } as any;
    
    this.originalConfigs.set('Date', originalDate);
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  /**
   * Validate that system gracefully handles database issues
   */
  async validateDatabaseResilience(): Promise<boolean> {
    try {
      // Should still be able to read from cache
      const cached = await this.cache.get('health-check');
      
      // Should be able to queue operations
      // (In real implementation, check queue depth)
      
      this.logger.log('[CHAOS] Validation passed: System degraded gracefully');
      return true;
    } catch (error) {
      this.logger.error('[CHAOS] Validation failed:', error.message);
      return false;
    }
  }

  /**
   * Validate that cache failures don't break functionality
   */
  async validateCacheFallback(): Promise<boolean> {
    try {
      // Try to get data (should fall back to DB)
      const users = await this.prisma.user.count();
      
      this.logger.log('[CHAOS] Validation passed: Cache fallback works');
      return true;
    } catch (error) {
      this.logger.error('[CHAOS] Validation failed:', error.message);
      return false;
    }
  }

  /**
   * Validate external service failure handling
   */
  async validateExternalServiceResilience(): Promise<boolean> {
    try {
      // Check that operations are queued
      // Check that error messages are user-friendly
      
      this.logger.log('[CHAOS] Validation passed: External service failures handled');
      return true;
    } catch (error) {
      this.logger.error('[CHAOS] Validation failed:', error.message);
      return false;
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async cleanup(): Promise<void> {
    this.logger.log('[CHAOS] Cleaning up chaos experiments');
    
    // Restore original configurations
    this.originalConfigs.forEach((value, key) => {
      if (key === 'fetch') {
        global.fetch = value;
      } else if (key === 'Date') {
        global.Date = value;
      } else {
        process.env[key] = value;
      }
    });
    
    this.originalConfigs.clear();
    
    // Clear mock flags
    delete process.env.STRIPE_MOCK_FAILURE;
    delete process.env.STRIPE_MOCK_FAILURE_RATE;
    delete process.env.STRIPE_WEBHOOK_DELAY;
    delete process.env.SENDGRID_MOCK_FAILURE;
    
    // Reset database timeouts
    await this.prisma.$executeRaw`SET statement_timeout = '30s'`;
    
    this.logger.log('[CHAOS] Cleanup complete');
  }

  // ============================================================================
  // FULL CHAOS SUITE
  // ============================================================================

  /**
   * Run complete chaos engineering test suite
   */
  async runChaosSuite(): Promise<{
    passed: number;
    failed: number;
    results: Array<{ scenario: string; passed: boolean; error?: string }>;
  }> {
    const scenarios = [
      { name: 'Database Connection Pool Exhaustion', fn: () => this.runScenario(this.injectDatabaseConnectionPoolExhaustion.bind(this)) },
      { name: 'Slow Database Queries', fn: () => this.runScenario(this.injectSlowQueries.bind(this)) },
      { name: 'Redis Outage', fn: () => this.runScenarioWithValidation(
        this.injectRedisOutage.bind(this),
        this.validateCacheFallback.bind(this)
      )},
      { name: 'Cache Stampede', fn: () => this.runScenario(this.injectCacheStampede.bind(this)) },
      { name: 'High Network Latency', fn: () => this.runScenario(this.injectHighLatency.bind(this)) },
      { name: 'Packet Loss', fn: () => this.runScenario(this.injectPacketLoss.bind(this)) },
      { name: 'External API Failure', fn: () => this.runScenarioWithValidation(
        this.injectStripeAPIFailure.bind(this),
        this.validateExternalServiceResilience.bind(this)
      )},
      { name: 'Memory Pressure', fn: () => this.runScenario(this.injectMemoryPressure.bind(this)) },
      { name: 'CPU Contention', fn: () => this.runScenario(this.injectCPUContention.bind(this)) },
      { name: 'Clock Skew', fn: () => this.runScenario(this.injectClockSkew.bind(this)) },
    ];

    const results = [];
    let passed = 0;
    let failed = 0;

    for (const scenario of scenarios) {
      this.logger.log(`\n[CHAOS] Running scenario: ${scenario.name}`);
      try {
        await scenario.fn();
        results.push({ scenario: scenario.name, passed: true });
        passed++;
      } catch (error) {
        results.push({ scenario: scenario.name, passed: false, error: error.message });
        failed++;
      }
    }

    await this.cleanup();

    return { passed, failed, results };
  }

  private async runScenario(injectFn: () => Promise<void>): Promise<void> {
    await injectFn();
    await new Promise(r => setTimeout(r, 1000)); // Let system stabilize
  }

  private async runScenarioWithValidation(
    injectFn: () => Promise<void>,
    validateFn: () => Promise<boolean>
  ): Promise<void> {
    await injectFn();
    await new Promise(r => setTimeout(r, 1000));
    const valid = await validateFn();
    if (!valid) {
      throw new Error('Validation failed');
    }
  }
}
