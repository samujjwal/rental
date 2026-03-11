import { LocaleInterceptor } from './locale.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('LocaleInterceptor', () => {
  let interceptor: LocaleInterceptor;

  beforeEach(() => {
    interceptor = new LocaleInterceptor();
  });

  const createMockContext = (acceptLanguage: string) => {
    const request: Record<string, unknown> = {
      headers: { 'accept-language': acceptLanguage },
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    } as unknown as ExecutionContext & { request: Record<string, unknown> };
  };

  const mockCallHandler: CallHandler = {
    handle: () => of('test'),
  };

  it('should resolve "en" for English accept-language', () => {
    const ctx = createMockContext('en-US,en;q=0.9');
    interceptor.intercept(ctx, mockCallHandler);
    expect((ctx as any).request.locale).toBe('en');
  });

  it('should resolve "ne" for Nepali accept-language', () => {
    const ctx = createMockContext('ne-NP,ne;q=0.9,en;q=0.8');
    interceptor.intercept(ctx, mockCallHandler);
    expect((ctx as any).request.locale).toBe('ne');
  });

  it('should resolve highest q-value supported locale', () => {
    const ctx = createMockContext('fr;q=0.9,ne;q=0.8,en;q=0.7');
    interceptor.intercept(ctx, mockCallHandler);
    // fr is not supported, ne is first supported
    expect((ctx as any).request.locale).toBe('ne');
  });

  it('should default to "en" for empty header', () => {
    const ctx = createMockContext('');
    interceptor.intercept(ctx, mockCallHandler);
    expect((ctx as any).request.locale).toBe('en');
  });

  it('should default to "en" for unsupported languages', () => {
    const ctx = createMockContext('de-DE,fr;q=0.9');
    interceptor.intercept(ctx, mockCallHandler);
    expect((ctx as any).request.locale).toBe('en');
  });

  it('should handle wildcard correctly', () => {
    const ctx = createMockContext('*');
    interceptor.intercept(ctx, mockCallHandler);
    expect((ctx as any).request.locale).toBe('en');
  });

  it('should call next handler', (done) => {
    const ctx = createMockContext('en');
    interceptor.intercept(ctx, mockCallHandler).subscribe({
      next: (value) => {
        expect(value).toBe('test');
        done();
      },
    });
  });
});
