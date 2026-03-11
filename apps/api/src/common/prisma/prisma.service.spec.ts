import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

// Mock PrismaWrapper
jest.mock('@rental-portal/database', () => ({
  PrismaWrapper: class MockPrismaWrapper {
    async $connect() {}
    async $disconnect() {}
  },
}));

describe('PrismaService', () => {
  let service: PrismaService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'DATABASE_URL') return 'postgresql://user:pass@localhost:5432/test';
        return undefined;
      }),
    } as any;

    service = new PrismaService(configService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('throws when DATABASE_URL is not configured', () => {
    const emptyConfig = { get: jest.fn(() => undefined) } as any;
    // Also clear process.env.DATABASE_URL
    const orig = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    expect(() => new PrismaService(emptyConfig)).toThrow('DATABASE_URL is not configured');

    process.env.DATABASE_URL = orig;
  });

  it('falls back to process.env.DATABASE_URL', () => {
    const emptyConfig = { get: jest.fn(() => undefined) } as any;
    const orig = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://env:pass@localhost/db';

    expect(() => new PrismaService(emptyConfig)).not.toThrow();

    process.env.DATABASE_URL = orig;
  });

  describe('onModuleInit', () => {
    it('calls $connect', async () => {
      const spy = jest.spyOn(service, '$connect').mockResolvedValue();
      await service.onModuleInit();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('calls $disconnect', async () => {
      const spy = jest.spyOn(service, '$disconnect').mockResolvedValue();
      await service.onModuleDestroy();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('enableShutdownHooks', () => {
    it('registers beforeExit handler', async () => {
      const processOnSpy = jest.spyOn(process, 'on');
      const mockApp = { close: jest.fn() } as any;

      await service.enableShutdownHooks(mockApp);

      expect(processOnSpy).toHaveBeenCalledWith('beforeExit', expect.any(Function));
      processOnSpy.mockRestore();
    });
  });

  describe('cleanDatabase', () => {
    it('throws in production', async () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(service.cleanDatabase()).rejects.toThrow('Cannot clean database in production');

      process.env.NODE_ENV = orig;
    });

    it('calls deleteMany on model-like properties in non-production', async () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      // Simulate a model property
      (service as any).user = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };

      await service.cleanDatabase();

      expect((service as any).user.deleteMany).toHaveBeenCalled();

      process.env.NODE_ENV = orig;
    });
  });
});
