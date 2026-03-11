import helmet from 'helmet';
import compression from 'compression';
import { setupSecurity } from './security.config';

jest.mock('helmet', () => {
  const fn = jest.fn(() => 'helmet-middleware');
  return fn;
});
jest.mock('compression', () => {
  const fn = jest.fn(() => 'compression-middleware');
  return fn;
});

describe('setupSecurity', () => {
  let app: any;

  beforeEach(() => {
    jest.clearAllMocks();
    app = {
      enableCors: jest.fn(),
      use: jest.fn(),
      set: jest.fn(),
    };
  });

  it('enables CORS with default origins when env not set', () => {
    const orig = process.env.CORS_ORIGINS;
    delete process.env.CORS_ORIGINS;

    setupSecurity(app);

    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: ['http://localhost:3401', 'http://localhost:3400'],
        methods: expect.arrayContaining(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']),
        credentials: true,
        maxAge: 3600,
      }),
    );
    process.env.CORS_ORIGINS = orig;
  });

  it('splits CORS_ORIGINS from env', () => {
    const orig = process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = 'https://a.np,https://b.np';

    setupSecurity(app);

    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: ['https://a.np', 'https://b.np'],
      }),
    );
    process.env.CORS_ORIGINS = orig;
  });

  it('configures helmet with CSP, HSTS, noSniff, frameguard, xssFilter', () => {
    setupSecurity(app);

    expect(helmet).toHaveBeenCalledWith(
      expect.objectContaining({
        contentSecurityPolicy: expect.objectContaining({
          directives: expect.objectContaining({
            defaultSrc: ["'self'"],
          }),
        }),
        hsts: expect.objectContaining({
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }),
        noSniff: true,
        frameguard: { action: 'deny' },
        xssFilter: true,
      }),
    );
  });

  it('applies helmet and compression middleware', () => {
    setupSecurity(app);

    expect(app.use).toHaveBeenCalledWith('helmet-middleware');
    expect(app.use).toHaveBeenCalledWith('compression-middleware');
    expect(compression).toHaveBeenCalled();
  });

  it('sets trust proxy to 1', () => {
    setupSecurity(app);

    expect(app.set).toHaveBeenCalledWith('trust proxy', 1);
  });

  it('includes allowed headers', () => {
    setupSecurity(app);

    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedHeaders: expect.arrayContaining([
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'Accept',
        ]),
      }),
    );
  });
});
