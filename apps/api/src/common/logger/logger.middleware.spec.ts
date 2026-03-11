import { LoggerMiddleware } from './logger.middleware';

describe('LoggerMiddleware', () => {
  let middleware: LoggerMiddleware;
  const mockLogger = {
    logRequest: jest.fn(),
    logResponse: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = new LoggerMiddleware(mockLogger as any);
  });

  it('is defined', () => {
    expect(middleware).toBeDefined();
  });

  it('logs the request', () => {
    const mockReq = { requestId: 'req-1', method: 'GET', url: '/api/test' } as any;
    const finishCb: Array<(...args: unknown[]) => void> = [];
    const mockRes = { on: jest.fn((_event: string, cb: (...args: unknown[]) => void) => finishCb.push(cb)) } as any;
    const mockNext = jest.fn();

    middleware.use(mockReq, mockRes, mockNext);
    expect(mockLogger.logRequest).toHaveBeenCalledWith(mockReq);
  });

  it('calls next', () => {
    const mockReq = {} as any;
    const mockRes = { on: jest.fn() } as any;
    const mockNext = jest.fn();

    middleware.use(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('logs response on finish event', () => {
    const mockReq = { method: 'GET', url: '/api/test' } as any;
    let finishCallback: (() => void) | undefined;
    const mockRes = {
      on: jest.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishCallback = cb;
      }),
    } as any;
    const mockNext = jest.fn();

    middleware.use(mockReq, mockRes, mockNext);
    expect(finishCallback).toBeDefined();

    // Simulate response finish
    finishCallback!();
    expect(mockLogger.logResponse).toHaveBeenCalledWith(
      mockReq,
      mockRes,
      expect.any(Number),
    );
  });

  it('measures response time', () => {
    const mockReq = {} as any;
    let finishCallback: (() => void) | undefined;
    const mockRes = {
      on: jest.fn((_e: string, cb: () => void) => { finishCallback = cb; }),
    } as any;

    middleware.use(mockReq, mockRes, jest.fn());
    finishCallback!();

    const responseTime = mockLogger.logResponse.mock.calls[0][2];
    expect(typeof responseTime).toBe('number');
    expect(responseTime).toBeGreaterThanOrEqual(0);
  });
});
