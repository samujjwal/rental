import { RequestIdMiddleware, REQUEST_ID_HEADER } from './request-id.middleware';
import { Request, Response, NextFunction } from 'express';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
    mockReq = { headers: {} };
    mockRes = {
      setHeader: jest.fn(),
    };
    next = jest.fn();
  });

  it('should generate a UUID when no x-request-id header is present', () => {
    middleware.use(mockReq as Request, mockRes as Response, next);

    expect((mockReq as any).requestId).toBeDefined();
    expect((mockReq as any).requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      (mockReq as any).requestId,
    );
    expect(next).toHaveBeenCalled();
  });

  it('should propagate an existing x-request-id header', () => {
    const existingId = 'my-custom-trace-id-123';
    mockReq.headers = { [REQUEST_ID_HEADER]: existingId };

    middleware.use(mockReq as Request, mockRes as Response, next);

    expect((mockReq as any).requestId).toBe(existingId);
    expect(mockRes.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, existingId);
    expect(next).toHaveBeenCalled();
  });

  it('should set the request id on the response header', () => {
    middleware.use(mockReq as Request, mockRes as Response, next);

    expect(mockRes.setHeader).toHaveBeenCalledTimes(1);
    const [headerName, headerValue] = (mockRes.setHeader as jest.Mock).mock.calls[0];
    expect(headerName).toBe('x-request-id');
    expect(typeof headerValue).toBe('string');
    expect(headerValue.length).toBeGreaterThan(0);
  });
});
