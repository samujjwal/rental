import { LocalAuthGuard } from './local-auth.guard';

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;

  beforeEach(() => {
    guard = new LocalAuthGuard();
  });

  it('is defined', () => {
    expect(guard).toBeDefined();
  });

  it('extends AuthGuard("local")', () => {
    expect(guard).toBeInstanceOf(LocalAuthGuard);
    expect(guard.canActivate).toBeDefined();
  });
});
