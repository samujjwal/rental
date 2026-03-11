import { SecurityMiddleware } from './security.middleware';

describe('SecurityMiddleware', () => {
  let middleware: SecurityMiddleware;
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;
  const mockLogger = {
    logSecurityEvent: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = new SecurityMiddleware({} as any, mockLogger as any);
    mockReq = {
      url: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      body: {},
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    };
    mockRes = {
      removeHeader: jest.fn(),
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('is defined', () => {
    expect(middleware).toBeDefined();
  });

  it('removes X-Powered-By header', () => {
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Powered-By');
  });

  it('sets X-Content-Type-Options header', () => {
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('sets X-Frame-Options header', () => {
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  });

  it('sets X-XSS-Protection header', () => {
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
  });

  it('does not set Content-Security-Policy (handled by Helmet)', () => {
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockRes.setHeader).not.toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.anything(),
    );
  });

  it('calls next()', () => {
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('detects path traversal in URL', () => {
    mockReq.url = '/api/../../../etc/passwd';
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockLogger.logSecurityEvent).toHaveBeenCalledWith(
      'Suspicious Request Detected',
      expect.objectContaining({ url: mockReq.url }),
    );
  });

  it('detects XSS in URL', () => {
    mockReq.url = '/api/test?q=<script>alert(1)</script>';
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockLogger.logSecurityEvent).toHaveBeenCalled();
  });

  it('detects SQL injection in body', () => {
    mockReq.body = { query: "UNION SELECT * FROM users" };
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockLogger.logSecurityEvent).toHaveBeenCalled();
  });

  it('does not log normal requests', () => {
    mockReq.url = '/api/listings';
    mockReq.body = { title: 'Camera for rent' };
    middleware.use(mockReq, mockRes, mockNext);
    expect(mockLogger.logSecurityEvent).not.toHaveBeenCalled();
  });
});
