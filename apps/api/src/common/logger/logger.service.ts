import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import DailyRotateFile = require('winston-daily-rotate-file');
import { sanitizeLogData, getCorrelationId, generateCorrelationId } from './redaction.util';

interface LogContext {
  context?: string;
  correlationId?: string;
  [key: string]: any;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private static currentCorrelationId: string | null = null;

  constructor(private configService: ConfigService) {
    const logLevel = this.configService.get('LOG_LEVEL', 'info');
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    // Define log format with correlation ID
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format((info) => {
        // Add correlation ID to all logs
        if (!info.correlationId) {
          info.correlationId = LoggerService.currentCorrelationId || generateCorrelationId();
        }
        // Sanitize sensitive data
        return sanitizeLogData(info);
      })(),
      winston.format.json(),
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, context, trace, correlationId }) => {
        const correlationPrefix = correlationId ? `[${correlationId}] ` : '';
        return `${timestamp} ${correlationPrefix}[${context || 'Application'}] ${level}: ${message}${trace ? `\n${trace}` : ''}`;
      }),
    );

    // Create transports
    const transports: winston.transport[] = [
      // Console transport
      new winston.transports.Console({
        format: isProduction ? logFormat : consoleFormat,
      }),
    ];

    // Add file transports for production
    if (isProduction) {
      // Error log
      transports.push(
        new DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxFiles: '30d',
          maxSize: '20m',
          format: logFormat,
        }),
      );

      // Combined log
      transports.push(
        new DailyRotateFile({
          filename: 'logs/combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '30d',
          maxSize: '20m',
          format: logFormat,
        }),
      );

      // Application log
      transports.push(
        new DailyRotateFile({
          filename: 'logs/app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'info',
          maxFiles: '14d',
          maxSize: '20m',
          format: logFormat,
        }),
      );
    }

    // Create logger instance
    this.logger = winston.createLogger({
      level: logLevel,
      format: logFormat,
      transports,
      exitOnError: false,
    });
  }

  /**
   * Set the current correlation ID for this request context
   */
  static setCorrelationId(correlationId: string): void {
    LoggerService.currentCorrelationId = correlationId;
  }

  /**
   * Get the current correlation ID
   */
  static getCorrelationId(): string | null {
    return LoggerService.currentCorrelationId;
  }

  /**
   * Clear the current correlation ID
   */
  static clearCorrelationId(): void {
    LoggerService.currentCorrelationId = null;
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { context, trace });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }

  // Additional methods for structured logging
  logRequest(req: any, context?: string) {
    const correlationId = getCorrelationId(req.headers || {});
    LoggerService.setCorrelationId(correlationId);

    this.logger.info('HTTP Request', {
      context: context || 'HTTP',
      correlationId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
    });
  }

  logResponse(req: any, res: any, responseTime: number, context?: string) {
    this.logger.info('HTTP Response', {
      context: context || 'HTTP',
      correlationId: req.requestId || LoggerService.currentCorrelationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userId: req.user?.id,
    });
  }

  logDatabaseQuery(query: string, duration: number, context?: string) {
    this.logger.debug('Database Query', {
      context: context || 'Database',
      correlationId: LoggerService.currentCorrelationId,
      query: query.substring(0, 500), // Truncate long queries
      duration: `${duration}ms`,
    });
  }

  logPaymentTransaction(transactionData: any, context?: string) {
    this.logger.info('Payment Transaction', {
      context: context || 'Payment',
      correlationId: LoggerService.currentCorrelationId,
      ...sanitizeLogData(transactionData),
    });
  }

  logSecurityEvent(event: string, details: any, context?: string) {
    this.logger.warn('Security Event', {
      context: context || 'Security',
      correlationId: LoggerService.currentCorrelationId,
      event,
      ...sanitizeLogData(details),
    });
  }

  logBusinessEvent(event: string, details: any, context?: string) {
    this.logger.info('Business Event', {
      context: context || 'Business',
      correlationId: LoggerService.currentCorrelationId,
      event,
      ...sanitizeLogData(details),
    });
  }
}
