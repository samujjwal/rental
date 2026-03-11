import { HttpException, HttpStatus } from '@nestjs/common';
import { SentryExceptionFilter } from './sentry-exception.filter';

// Mock @sentry/node
const mockCaptureException = jest.fn();
const mockWithScope = jest.fn((cb: (scope: any) => void) => {
  const scope = { setTag: jest.fn(), setExtra: jest.fn(), setUser: jest.fn() };
  cb(scope);
  return scope;
});

jest.mock('@sentry/node', () => ({
  captureException: mockCaptureException,
  withScope: mockWithScope,
}), { virtual: true });

describe('SentryExceptionFilter', () => {
  let filter: SentryExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  const makeHost = (overrides: Record<string, any> = {}) => ({
    switchToHttp: () => ({
      getResponse: () => ({ status: mockStatus }),
      getRequest: () => ({
        url: '/api/test',
        method: 'GET',
        ip: '10.0.0.1',
        headers: { 'x-request-id': 'req-123' },
        user: { id: 'u1' },
        requestId: undefined,
        ...overrides,
      }),
    }),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    // SentryExceptionFilter extends BaseExceptionFilter which needs httpAdapter
    // We instantiate directly — the catch method doesn't call super.catch
    filter = new (SentryExceptionFilter as any)();
  });

  it('responds with correct status for HttpException', () => {
    const ex = new HttpException('Not Found', HttpStatus.NOT_FOUND);
    filter.catch(ex, makeHost() as any);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'Not Found' }),
    );
  });

  it('responds with 500 for non-HttpException', () => {
    filter.catch(new Error('crash'), makeHost() as any);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
    );
  });

  it('includes requestId from request object', () => {
    filter.catch(new Error('x'), makeHost({ requestId: 'custom-id' }) as any);

    const body = mockJson.mock.calls[0][0];
    expect(body.requestId).toBe('custom-id');
  });

  it('falls back to x-request-id header', () => {
    filter.catch(new Error('x'), makeHost() as any);

    const body = mockJson.mock.calls[0][0];
    expect(body.requestId).toBe('req-123');
  });

  it('reports 5xx errors to Sentry', () => {
    filter.catch(new Error('server crash'), makeHost() as any);

    expect(mockWithScope).toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it('does NOT report 4xx errors to Sentry', () => {
    filter.catch(
      new HttpException('Bad Request', HttpStatus.BAD_REQUEST),
      makeHost() as any,
    );

    expect(mockWithScope).not.toHaveBeenCalled();
  });

  it('includes timestamp and path in response', () => {
    filter.catch(new Error('x'), makeHost() as any);

    const body = mockJson.mock.calls[0][0];
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/api/test');
  });
});
