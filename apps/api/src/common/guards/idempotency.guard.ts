import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';

/**
 * Idempotency Key Header
 */
const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
const IDEMPOTENCY_REPLAY_HEADER = 'Idempotency-Replayed';

/**
 * Decorator to mark endpoints as requiring idempotency
 * Usage: Apply @Idempotent() to controller methods that need idempotency
 * 
 * Example:
 * @Post()
 * @Idempotent()
 * async createBooking(@Body() dto: CreateBookingDto) {
 *   return this.bookingsService.create(dto);
 * }
 */
export const Idempotent = () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  Reflect.defineMetadata('idempotent', true, descriptor.value);
  return descriptor;
};

/**
 * Idempotency Interceptor
 * 
 * Provides server-side idempotency for critical mutations by:
 * 1. Checking for Idempotency-Key header
 * 2. Storing successful responses keyed by the idempotency key
 * 3. Returning cached responses for duplicate requests
 * 
 * Note: This is a simplified implementation. For production use, consider:
 * - Using Redis for caching instead of database
 * - Adding request fingerprinting to prevent key reuse across different requests
 * - Implementing proper cache invalidation strategies
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly cache = new Map<string, { response: any; timestamp: Date }>();
  private readonly IDEMPOTENCY_KEY_TTL_HOURS = 24;

  constructor(
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const isIdempotent = this.reflector.get<boolean>('idempotent', handler);

    // Skip idempotency check if endpoint is not marked as idempotent
    if (!isIdempotent) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const idempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER] as string;

    // Require idempotency key for idempotent endpoints
    if (!idempotencyKey) {
      throw new HttpException(
        `${IDEMPOTENCY_KEY_HEADER} header is required for this endpoint`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate idempotency key format (should be a non-empty string)
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0 || idempotencyKey.length > 255) {
      throw new HttpException(
        `${IDEMPOTENCY_KEY_HEADER} must be a string between 1 and 255 characters`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check for existing cached response
    const cached = this.cache.get(idempotencyKey);

    if (cached) {
      // Check if cache is expired
      const ageHours = (Date.now() - cached.timestamp.getTime()) / (1000 * 60 * 60);
      if (ageHours >= this.IDEMPOTENCY_KEY_TTL_HOURS) {
        this.cache.delete(idempotencyKey);
      } else {
        this.logger.log(`Returning cached response for idempotency key: ${idempotencyKey}`);
        response.setHeader(IDEMPOTENCY_REPLAY_HEADER, 'true');
        return new Observable((subscriber) => {
          subscriber.next(cached.response);
          subscriber.complete();
        });
      }
    }

    // Execute the handler and cache the response
    return next.handle().pipe(
      tap((data) => {
        this.cache.set(idempotencyKey, { response: data, timestamp: new Date() });
        this.logger.log(`Cached response for idempotency key: ${idempotencyKey}`);
      }),
    );
  }
}
