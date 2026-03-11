import { RateLimit, RATE_LIMIT_KEY } from './rate-limit.decorator';
import { Reflector } from '@nestjs/core';

describe('RateLimit Decorator', () => {
  const reflector = new Reflector();

  it('sets rate limit metadata on handler', () => {
    class TestController {
      @RateLimit({ maxRequests: 10, windowMs: 60000 })
      handler() {}
    }

    const config = reflector.get(RATE_LIMIT_KEY, TestController.prototype.handler);
    expect(config).toEqual({ maxRequests: 10, windowMs: 60000 });
  });

  it('handles different rate limit configurations', () => {
    class TestController {
      @RateLimit({ maxRequests: 100, windowMs: 3600000 })
      handler() {}
    }

    const config = reflector.get(RATE_LIMIT_KEY, TestController.prototype.handler);
    expect(config).toEqual({ maxRequests: 100, windowMs: 3600000 });
  });

  it('exports RATE_LIMIT_KEY constant', () => {
    expect(RATE_LIMIT_KEY).toBe('rateLimit');
  });

  it('sets metadata with minimal config', () => {
    class TestController {
      @RateLimit({ maxRequests: 1, windowMs: 1000 })
      handler() {}
    }

    const config = reflector.get(RATE_LIMIT_KEY, TestController.prototype.handler);
    expect(config.maxRequests).toBe(1);
    expect(config.windowMs).toBe(1000);
  });
});
