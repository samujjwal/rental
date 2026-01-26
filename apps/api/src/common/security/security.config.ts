import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';

export function setupSecurity(app: INestApplication): void {
  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3401',
      'http://localhost:3400',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    maxAge: 3600, // Cache preflight requests for 1 hour
  });

  // Security headers with Helmet
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
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      frameguard: {
        action: 'deny',
      },
      xssFilter: true,
    }),
  );

  // Enable compression
  app.use(compression());

  // Trust proxy (for apps behind reverse proxy like nginx)
  (app as any).set('trust proxy', 1);
}
