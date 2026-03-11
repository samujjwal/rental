import { RolesGuard, ROLES_KEY, PERMISSIONS_KEY, Permission } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: any;

  const createMockContext = (user?: any) => {
    const request = { user };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no roles or permissions required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = createMockContext({ id: 'u-1', role: 'TENANT' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user is not authenticated', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['ADMIN']); // roles
    reflector.getAllAndOverride.mockReturnValueOnce(undefined); // permissions

    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow('User not authenticated');
  });

  it('should allow SUPER_ADMIN access to any role-protected route', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['OPERATIONS_ADMIN']); // roles
    reflector.getAllAndOverride.mockReturnValueOnce(undefined); // permissions

    const context = createMockContext({ id: 'u-1', role: 'SUPER_ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow ADMIN access to any role-protected route', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['OPERATIONS_ADMIN']); // roles
    reflector.getAllAndOverride.mockReturnValueOnce(undefined); // permissions

    const context = createMockContext({ id: 'u-1', role: 'ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow user with matching role', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['OPERATIONS_ADMIN']); // roles
    reflector.getAllAndOverride.mockReturnValueOnce(undefined); // permissions

    const context = createMockContext({ id: 'u-1', role: 'OPERATIONS_ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny user without matching role', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['OPERATIONS_ADMIN']); // roles
    reflector.getAllAndOverride.mockReturnValueOnce(undefined); // permissions

    const context = createMockContext({ id: 'u-1', role: 'TENANT' });
    expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
  });

  it('should allow user with required permissions', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined); // roles
    reflector.getAllAndOverride.mockReturnValueOnce([Permission.VIEW_ANALYTICS]); // permissions

    const context = createMockContext({ id: 'u-1', role: 'FINANCE_ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny user without required permissions', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined); // roles
    reflector.getAllAndOverride.mockReturnValueOnce([Permission.MANAGE_SYSTEM]); // permissions

    const context = createMockContext({ id: 'u-1', role: 'FINANCE_ADMIN' });
    expect(() => guard.canActivate(context)).toThrow('Insufficient permissions for this action');
  });

  it('should check both roles and permissions when both are set', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(['ADMIN']); // roles
    reflector.getAllAndOverride.mockReturnValueOnce([Permission.VIEW_ANALYTICS]); // permissions

    const context = createMockContext({ id: 'u-1', role: 'ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should grant SUPER_ADMIN all permissions', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined); // roles
    reflector.getAllAndOverride.mockReturnValueOnce([
      Permission.MANAGE_SYSTEM,
      Permission.MANAGE_USERS,
      Permission.MANAGE_PAYOUTS,
    ]); // permissions

    const context = createMockContext({ id: 'u-1', role: 'SUPER_ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny OPERATIONS_ADMIN finance permissions', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined); // roles
    reflector.getAllAndOverride.mockReturnValueOnce([Permission.MANAGE_PAYOUTS]); // permissions

    const context = createMockContext({ id: 'u-1', role: 'OPERATIONS_ADMIN' });
    expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
  });

  it('should allow SUPPORT_ADMIN dispute management', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined); // roles
    reflector.getAllAndOverride.mockReturnValueOnce([Permission.MANAGE_DISPUTES, Permission.RESOLVE_DISPUTES]); // permissions

    const context = createMockContext({ id: 'u-1', role: 'SUPPORT_ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should handle unknown role gracefully', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined); // roles
    reflector.getAllAndOverride.mockReturnValueOnce([Permission.VIEW_ANALYTICS]); // permissions

    const context = createMockContext({ id: 'u-1', role: 'UNKNOWN_ROLE' });
    expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
  });
});
