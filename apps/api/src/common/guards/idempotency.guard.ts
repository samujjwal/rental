import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { IdempotencyService } from '../idempotency/idempotency.service';

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
 * Provides production-grade server-side idempotency for critical mutations by:
 * 1. Checking for Idempotency-Key header
 * 2. Storing successful responses in durable storage (Postgres/Redis)
 * 3. Using request fingerprinting (route, method, user, body hash) to detect key reuse
 * 4. Returning cached responses for duplicate requests
 * 5. Supporting TTL-based expiration
 * 
 * This implementation uses durable storage and prevents key reuse across different requests.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
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

    // Extract request context for fingerprinting
    const route = request.route?.path || request.url;
    const method = request.method;
    const userId = (request as any).user?.id || null;
    const body = request.body;

    try {
      // Check for existing idempotency record with fingerprinting
      const result = await this.idempotencyService.check({
        key: idempotencyKey,
        userId,
        route,
        method,
        body,
      });

      if (result.isReplay && result.response) {
        this.logger.log(`Returning cached response for idempotency key: ${idempotencyKey}`);
        response.setHeader(IDEMPOTENCY_REPLAY_HEADER, 'true');
        if (result.statusCode) {
          response.status(result.statusCode);
        }
        return new Observable((subscriber) => {
          subscriber.next(result.response);
          subscriber.complete();
        });
      }

      // Execute the handler and store the response
      return next.handle().pipe(
        tap(async (data) => {
          const statusCode = response.statusCode;
          if (result.record) {
            await this.idempotencyService.storeResponse(result.record, data, statusCode);
            this.logger.log(`Stored response for idempotency key: ${idempotencyKey}`);
          }
        }),
      );
    } catch (error) {
      // Handle idempotency check failures (e.g., key reuse with different payload)
      if (error instanceof NotFoundException) {
        throw new HttpException(
          error.message,
          HttpStatus.CONFLICT,
        );
      }
      // Log other errors but don't block the request
      this.logger.error('Idempotency check failed, proceeding with request', error);
      return next.handle();
    }
  }
}
