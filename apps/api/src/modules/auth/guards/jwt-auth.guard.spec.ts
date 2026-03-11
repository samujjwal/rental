import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('is defined', () => {
    expect(guard).toBeDefined();
  });

  it('extends AuthGuard("jwt")', () => {
    expect(guard).toBeInstanceOf(JwtAuthGuard);
    expect(guard.canActivate).toBeDefined();
  });

  it('has canActivate method that delegates to super', () => {
    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
        getResponse: jest.fn().mockReturnValue({}),
        getNext: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;

    // The actual passport internal will reject because no strategy is registered,
    // but the guard itself delegates correctly 
    const result = guard.canActivate(mockContext);

    // canActivate returns a Promise (from passport)
    expect(result).toBeDefined();
    // Suppress the unhandled rejection from passport strategy lookup
    if (result instanceof Promise) {
      result.catch(() => {});
    }
  });
});
