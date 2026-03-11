import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryModule } from './telemetry.module';

describe('TelemetryModule', () => {
  it('should initialise without errors when OTEL and Sentry are disabled', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryModule,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, fallback?: any) => {
              const map: Record<string, any> = {
                OTEL_ENABLED: 'false',
              };
              return map[key] ?? fallback;
            }),
          },
        },
      ],
    }).compile();

    // Manually trigger onModuleInit
    const telemetry = module.get(TelemetryModule);
    await telemetry.onModuleInit();
    expect(telemetry).toBeDefined();
  });
});
