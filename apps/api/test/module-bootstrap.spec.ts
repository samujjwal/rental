/**
 * Module Bootstrap Validation Test
 *
 * This test validates that the application can bootstrap successfully
 * with all modules loaded. It catches:
 * - Circular dependencies
 * - Missing providers
 * - Invalid constructor signatures
 * - Module resolution errors
 *
 * Run with: pnpm test -- --testPathPatterns module-bootstrap
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('Module Bootstrap Validation', () => {
  it('should bootstrap AppModule successfully', async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      expect(moduleFixture).toBeDefined();
      expect(moduleFixture.get(AppModule)).toBeDefined();
    } catch (error) {
      if (error instanceof Error) {
        fail(`Application bootstrap failed: ${error.message}\n${error.stack}`);
      }
      throw error;
    }
  }, 60000); // 60s timeout for full bootstrap

  it('should resolve all module dependencies', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    await app.close();

    // If we reach here, all dependencies resolved successfully
    expect(true).toBe(true);
  }, 60000);
});
