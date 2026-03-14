// Disable throttling for e2e tests so rate-limit decorators don't reject requests
process.env.DISABLE_THROTTLE = 'true';
process.env.SAFETY_CHECKS_FAIL_OPEN = 'true';

// Override Redis and DB settings for e2e environment.
// The workspace-root .env (REDIS_PORT=3479, DB port=3432) must not take
// precedence over the app-level .env during e2e tests.
// Setting them here in setupFiles ensures they are applied before any NestJS
// module (and its ConfigModule) starts loading env files.
process.env.REDIS_PORT = '3480';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_URL = 'redis://localhost:3480';
process.env.DATABASE_URL = 'postgresql://rental_user:rental_password@localhost:3433/rental_portal_e2e?schema=public';
