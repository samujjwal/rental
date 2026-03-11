import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import {
  getLocalizedMessage,
  type MessageKey,
  type SupportedLocale,
} from '../i18n/messages';

@Catch(HttpException)
export class I18nExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const locale = ((request as any).locale || 'en') as SupportedLocale;

    let message: string;
    let messageKey: string | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const resp = exceptionResponse as Record<string, any>;
      messageKey = resp.messageKey;
      message = resp.message || exception.message;
    } else {
      message = exception.message;
    }

    // If there's a messageKey, translate it
    if (messageKey) {
      message = getLocalizedMessage(messageKey as MessageKey, locale);
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(process.env.NODE_ENV !== 'production' && messageKey ? { messageKey } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
