import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * TelemetryModule boots OpenTelemetry SDK (when OTEL_ENABLED=true)
 * and Sentry error reporting (when SENTRY_DSN is configured).
 *
 * Both integrations are fully optional — if the environment variables
 * are absent the module is a no-op, making local development friction-free.
 *
 * ### Environment variables
 *
 * | Variable            | Description                                   | Default   |
 * |---------------------|-----------------------------------------------|-----------|
 * | `OTEL_ENABLED`      | Enable OpenTelemetry SDK                      | `false`   |
 * | `OTEL_EXPORTER_URL` | OTLP HTTP exporter endpoint                   | –         |
 * | `OTEL_SERVICE_NAME` | Logical service name reported to the collector | `rental-api` |
 * | `SENTRY_DSN`        | Sentry DSN for error reporting                | –         |
 * | `NODE_ENV`          | Used for Sentry `environment` tag             | `development` |
 */
@Global()
@Module({})
export class TelemetryModule implements OnModuleInit {
  private readonly logger = new Logger(TelemetryModule.name);

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.initOpenTelemetry();
    this.initSentry();
  }

  // ------------------------------------------------------------------
  //  OpenTelemetry
  // ------------------------------------------------------------------
  private async initOpenTelemetry() {
    const enabled = this.config.get<string>('OTEL_ENABLED', 'false') === 'true';
    if (!enabled) {
      this.logger.log('OpenTelemetry is disabled (set OTEL_ENABLED=true to enable)');
      return;
    }

    try {
      // Dynamic requires — these packages are optional peer deps.
       
      const { NodeSDK } = require('@opentelemetry/sdk-node');
       
      const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
       
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
       
      const { Resource } = require('@opentelemetry/resources');
       
      const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');

      const serviceName = this.config.get<string>('OTEL_SERVICE_NAME', 'rental-api');
      const exporterUrl = this.config.get<string>('OTEL_EXPORTER_URL');

      const traceExporter = new OTLPTraceExporter({
        ...(exporterUrl ? { url: exporterUrl } : {}),
      });

      const sdk = new NodeSDK({
        resource: new Resource({
          [ATTR_SERVICE_NAME]: serviceName,
        }),
        traceExporter,
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
          }),
        ],
      });

      sdk.start();
      this.logger.log(`OpenTelemetry started (service: ${serviceName})`);

      // Graceful shutdown
      const shutdown = async () => {
        try {
          await sdk.shutdown();
          this.logger.log('OpenTelemetry SDK shut down');
        } catch (err) {
          this.logger.error('Error shutting down OpenTelemetry', (err as Error).stack);
        }
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    } catch (err) {
      this.logger.warn(
        'OpenTelemetry packages not installed — skipping. ' +
          'Run: pnpm add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node ' +
          '@opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions',
      );
    }
  }

  // ------------------------------------------------------------------
  //  Sentry
  // ------------------------------------------------------------------
  private initSentry() {
    const dsn = this.config.get<string>('SENTRY_DSN');
    if (!dsn) {
      this.logger.log('Sentry is disabled (set SENTRY_DSN to enable)');
      return;
    }

    try {
      // Dynamic import — @sentry/node is an optional peer dep.
       
      const Sentry = require('@sentry/node');

      Sentry.init({
        dsn,
        environment: this.config.get<string>('NODE_ENV', 'development'),
        tracesSampleRate: this.config.get<number>('SENTRY_TRACES_SAMPLE_RATE', 0.1),
        // Ignore common noise
        ignoreErrors: [
          'UnauthorizedException',
          'ForbiddenException',
          'NotFoundException',
          'ThrottlerException',
        ],
      });

      this.logger.log('Sentry error reporting initialised');
    } catch {
      this.logger.warn(
        'Sentry package not installed — skipping. Run: pnpm add @sentry/node',
      );
    }
  }
}
