import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import * as path from 'path';
import * as express from 'express';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma/prisma.service';
import { SentryExceptionFilter } from './common/telemetry';
import { I18nExceptionFilter } from './common/filters/i18n-exception.filter';
import { LocaleInterceptor } from './common/interceptors/locale.interceptor';
import { LoggerService } from './common/logger/logger.service';

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap() {
  // ── Startup environment guards ──────────────────────────────────────────────
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }

  if (!process.env.EMAIL_FROM) {
    bootstrapLogger.warn('EMAIL_FROM is not set. Transactional emails may fail SPF/DKIM checks.');
  }

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
    // Remove global CORS to use our custom configuration
  });

  // Use the Winston-based LoggerService as NestJS application logger
  // Outputs structured JSON in production, colorized text in development
  const loggerService = app.get(LoggerService);
  app.useLogger(loggerService);

  const configService = app.get(ConfigService);

  // Trust proxy — required behind nginx/load-balancer for correct client IP + secure cookies
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);
  expressApp.disable('x-powered-by');

  // Compression — gzip/brotli responses (P0 security fix)
  app.use(compression());

  // Cookie parser — required for httpOnly refresh token cookies (B-29)
  app.use(cookieParser());

  // Security headers (helmet) with HSTS for production
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: process.env.NODE_ENV === 'production'
        ? { maxAge: 63072000, includeSubDomains: true, preload: true }
        : false,
    }),
  );

  // CORS - Production-ready configuration
  const rawCorsOrigins = process.env.CORS_ORIGINS || configService.get('corsOrigins') || '';
  const corsOrigins = typeof rawCorsOrigins === 'string' ? rawCorsOrigins.split(',').filter(Boolean) : rawCorsOrigins;

  const isWildcard = corsOrigins.length === 0 || corsOrigins.includes('*');
  if (isWildcard && process.env.NODE_ENV === 'production') {
    throw new Error('[API] CORS_ORIGINS must be explicitly set in production. Wildcard CORS is not allowed.');
  }

  // When credentials are enabled, we cannot use wildcard origin
  if (isWildcard) {
    // In development with wildcard, use specific origins
    app.enableCors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);

        // Allow specific origins for development
        const allowedOrigins = ['http://localhost:3401', 'http://localhost:3400'];
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    });
  } else {
    // Use configured origins
    app.enableCors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    });
  }

  // Global prefix
  app.setGlobalPrefix('api');

  // Serve local uploads — development / local-storage fallback only.
  // In production, files are served via S3/CloudFront, not the API process.
  if (configService.get('NODE_ENV') !== 'production') {
    const localStoragePath = configService.get('LOCAL_STORAGE_PATH') || './uploads';
    app.use('/uploads', express.static(path.resolve(localStoragePath)));
  }

  // API versioning - routes without @Version decorator work without prefix
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global Sentry exception filter (attaches x-request-id, reports 5xx)
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(
    new SentryExceptionFilter(httpAdapter.httpAdapter),
    new I18nExceptionFilter(),
  );

  // Global locale interceptor (resolves Accept-Language → request.locale)
  app.useGlobalInterceptors(new LocaleInterceptor());

  // Prisma shutdown hook
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  // Swagger documentation
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('GharBatai Rentals API')
      .setDescription('GharBatai Rentals - Nepal Rental Marketplace API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management')
      .addTag('listings', 'Listing management')
      .addTag('bookings', 'Booking management')
      .addTag('payments', 'Payment processing')
      .addTag('messaging', 'Real-time messaging')
      .addTag('reviews', 'Reviews and ratings')
      .addTag('disputes', 'Dispute resolution')
      .addTag('admin', 'Admin operations')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get('PORT', 3400);
  await app.listen(port);

  bootstrapLogger.log(`Application is running on: http://localhost:${port}/api`);
  bootstrapLogger.log(`API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
