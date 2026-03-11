import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, tap } from 'rxjs';
import { Response } from 'express';

/**
 * Interceptor that automatically sets the refresh token as an httpOnly
 * secure cookie whenever an auth response contains a `refreshToken` field.
 *
 * This prevents XSS from stealing refresh tokens stored in localStorage.
 * Mobile clients can still read refreshToken from the JSON body.
 */
@Injectable()
export class RefreshTokenCookieInterceptor implements NestInterceptor {
  static readonly COOKIE_NAME = 'refresh_token';

  constructor(private readonly configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap((data) => {
        if (data && typeof data === 'object' && 'refreshToken' in data) {
          const response = context.switchToHttp().getResponse<Response>();
          const isProduction = this.configService.get('NODE_ENV') === 'production';
          const sessionExpiryDays = this.configService.get<number>('auth.sessionExpiryDays', 7);

          response.cookie(RefreshTokenCookieInterceptor.COOKIE_NAME, (data as { refreshToken: string }).refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            path: '/api/auth', // Only sent to auth endpoints
            maxAge: sessionExpiryDays * 24 * 60 * 60 * 1000,
          });
        }
      }),
    );
  }
}
