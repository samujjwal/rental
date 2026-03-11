import { WsJwtAuthGuard } from './ws-jwt-auth.guard';

describe('WsJwtAuthGuard', () => {
  let guard: WsJwtAuthGuard;
  let jwtService: any;
  let configService: any;
  let authService: any;

  const createMockClient = (overrides: any = {}) => ({
    handshake: {
      headers: overrides.headers || {},
      query: overrides.query || {},
      auth: overrides.auth || {},
    },
    data: {} as any,
  });

  const createMockContext = (client: any) => ({
    switchToWs: () => ({
      getClient: () => client,
    }),
  } as any);

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', email: 'test@example.com' }),
    };

    configService = {
      get: jest.fn().mockReturnValue('jwt-secret'),
    };

    authService = {
      validateUser: jest.fn().mockResolvedValue({ id: 'user-1', email: 'test@example.com', status: 'ACTIVE' }),
      validateSessionToken: jest.fn().mockResolvedValue(true),
    };

    guard = new WsJwtAuthGuard(jwtService, configService, authService);
  });

  describe('canActivate', () => {
    it('should authenticate with Bearer token in authorization header', async () => {
      const client = createMockClient({
        headers: { authorization: 'Bearer valid-token' },
      });

      const result = await guard.canActivate(createMockContext(client));

      expect(result).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token', { secret: 'jwt-secret' });
      expect(client.data.userId).toBe('user-1');
    });

    it('should authenticate with token in query params', async () => {
      const client = createMockClient({
        query: { token: 'query-token' },
      });

      const result = await guard.canActivate(createMockContext(client));

      expect(result).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('query-token', { secret: 'jwt-secret' });
    });

    it('should authenticate with token in auth object', async () => {
      const client = createMockClient({
        auth: { token: 'auth-token' },
      });

      const result = await guard.canActivate(createMockContext(client));

      expect(result).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('auth-token', { secret: 'jwt-secret' });
    });

    it('should throw WsException when no token is provided', async () => {
      const client = createMockClient();

      await expect(guard.canActivate(createMockContext(client))).rejects.toThrow('Unauthorized');
    });

    it('should throw WsException when JWT verification fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));
      const client = createMockClient({
        headers: { authorization: 'Bearer invalid-token' },
      });

      await expect(guard.canActivate(createMockContext(client))).rejects.toThrow('Unauthorized');
    });

    it('should throw WsException when user is not found', async () => {
      authService.validateUser.mockResolvedValue(null);
      const client = createMockClient({
        headers: { authorization: 'Bearer valid-token' },
      });

      await expect(guard.canActivate(createMockContext(client))).rejects.toThrow('Unauthorized');
    });

    it('should throw WsException when session is invalid', async () => {
      authService.validateSessionToken.mockResolvedValue(false);
      const client = createMockClient({
        headers: { authorization: 'Bearer valid-token' },
      });

      await expect(guard.canActivate(createMockContext(client))).rejects.toThrow('Unauthorized');
    });

    it('should set userId on client data', async () => {
      const client = createMockClient({
        headers: { authorization: 'Bearer valid-token' },
      });

      await guard.canActivate(createMockContext(client));

      expect(client.data.userId).toBe('user-1');
    });

    it('should throw when auth config is missing', async () => {
      configService.get.mockReturnValue(undefined);
      const client = createMockClient({
        headers: { authorization: 'Bearer valid-token' },
      });

      await expect(guard.canActivate(createMockContext(client))).rejects.toThrow('Unauthorized');
    });

    it('should ignore non-Bearer authorization headers', async () => {
      const client = createMockClient({
        headers: { authorization: 'Basic invalid' },
      });

      await expect(guard.canActivate(createMockContext(client))).rejects.toThrow('Unauthorized');
    });
  });
});
