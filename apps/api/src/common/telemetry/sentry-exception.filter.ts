import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Global exception filter that:
 * 1. Attaches x-request-id to every error response
 * 2. Maps Prisma database errors to meaningful HTTP status codes
 * 3. Reports unexpected (5xx) errors to Sentry when available
 * 4. Emits structured JSON error bodies
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const requestId = (req as any).requestId ?? req.headers['x-request-id'] ?? null;

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaError(exception);
      status = mapped.status;
      message = mapped.message;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    // Only report 5xx to Sentry
    if (status >= 500) {
      this.reportToSentry(exception, req, requestId);
    }

    // Structured error response
    res.status(status).json({
      statusCode: status,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }

  /**
   * Maps Prisma error codes to appropriate HTTP status codes.
   * Absorbs logic from the previously unused AllExceptionsFilter.
   */
  private mapPrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
  } {
    switch (error.code) {
      case 'P2000':
        return { status: HttpStatus.BAD_REQUEST, message: 'The provided value is too long for the column' };
      case 'P2001':
        return { status: HttpStatus.NOT_FOUND, message: 'Record not found' };
      case 'P2002':
        return { status: HttpStatus.CONFLICT, message: 'A record with these values already exists' };
      case 'P2003':
        return { status: HttpStatus.BAD_REQUEST, message: 'Related record not found' };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Record not found' };
      default:
        return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Database error occurred' };
    }
  }

  private reportToSentry(exception: unknown, req: Request, requestId: string | null) {
    try {
       
      const Sentry = require('@sentry/node');
      Sentry.withScope((scope: any) => {
        scope.setTag('requestId', requestId);
        scope.setExtra('url', req.url);
        scope.setExtra('method', req.method);
        scope.setExtra('ip', req.ip);
        scope.setUser({ id: (req as any).user?.id });
        Sentry.captureException(exception);
      });
    } catch {
      // Sentry not installed — just log
      this.logger.error(
        `Unhandled exception [${requestId}]: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }
  }
}
