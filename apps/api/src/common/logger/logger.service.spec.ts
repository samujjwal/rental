jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };
  return {
    createLogger: jest.fn().mockReturnValue(mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      splat: jest.fn(),
      json: jest.fn(),
      colorize: jest.fn(),
      printf: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
    },
    __mockLogger: mockLogger,
  };
});

jest.mock('winston-daily-rotate-file', () => jest.fn());

import { LoggerService } from './logger.service';

const winston = jest.requireMock('winston');
const mockLogger = winston.__mockLogger;

describe('LoggerService', () => {
  let service: LoggerService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const map: Record<string, string> = {
        LOG_LEVEL: 'info',
        NODE_ENV: 'test',
      };
      return map[key] ?? defaultValue;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LoggerService(mockConfigService as any);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('creates winston logger', () => {
    expect(winston.createLogger).toHaveBeenCalled();
  });

  it('log calls info with context', () => {
    service.log('test message', 'TestContext');
    expect(mockLogger.info).toHaveBeenCalledWith('test message', { context: 'TestContext' });
  });

  it('error calls error with trace', () => {
    service.error('fail', 'stack trace', 'TestCtx');
    expect(mockLogger.error).toHaveBeenCalledWith('fail', { context: 'TestCtx', trace: 'stack trace' });
  });

  it('warn calls warn', () => {
    service.warn('caution', 'WarnCtx');
    expect(mockLogger.warn).toHaveBeenCalledWith('caution', { context: 'WarnCtx' });
  });

  it('debug calls debug', () => {
    service.debug('debug info');
    expect(mockLogger.debug).toHaveBeenCalledWith('debug info', { context: undefined });
  });

  it('verbose calls verbose', () => {
    service.verbose('details');
    expect(mockLogger.verbose).toHaveBeenCalledWith('details', { context: undefined });
  });

  it('logRequest logs HTTP Request', () => {
    const req = { requestId: 'r1', method: 'GET', url: '/api/test', ip: '::1', get: () => 'UA', user: { id: 'u1' } };
    service.logRequest(req);
    expect(mockLogger.info).toHaveBeenCalledWith('HTTP Request', expect.objectContaining({
      method: 'GET',
      url: '/api/test',
      userId: 'u1',
    }));
  });

  it('logResponse logs response with timing', () => {
    const req = { requestId: 'r1', method: 'POST', url: '/api/book', user: { id: 'u1' } };
    const res = { statusCode: 201 };
    service.logResponse(req, res, 42);
    expect(mockLogger.info).toHaveBeenCalledWith('HTTP Response', expect.objectContaining({
      statusCode: 201,
      responseTime: '42ms',
    }));
  });

  it('logSecurityEvent logs as warning', () => {
    service.logSecurityEvent('XSS attempt', { ip: '10.0.0.1' });
    expect(mockLogger.warn).toHaveBeenCalledWith('Security Event', expect.objectContaining({
      event: 'XSS attempt',
      ip: '10.0.0.1',
    }));
  });

  it('logPaymentTransaction logs payment info', () => {
    service.logPaymentTransaction({ amount: 500, currency: 'NPR' });
    expect(mockLogger.info).toHaveBeenCalledWith('Payment Transaction', expect.objectContaining({
      amount: 500,
    }));
  });

  it('logDatabaseQuery logs as debug', () => {
    service.logDatabaseQuery('SELECT * FROM users', 15);
    expect(mockLogger.debug).toHaveBeenCalledWith('Database Query', expect.objectContaining({
      query: 'SELECT * FROM users',
      duration: '15ms',
    }));
  });

  it('logBusinessEvent logs info', () => {
    service.logBusinessEvent('BookingCreated', { bookingId: 'b1' });
    expect(mockLogger.info).toHaveBeenCalledWith('Business Event', expect.objectContaining({
      event: 'BookingCreated',
      bookingId: 'b1',
    }));
  });
});
