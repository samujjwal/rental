import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      locale?: string;
    }
  }
}

/**
 * Extracts the `Accept-Language` header and attaches a resolved `locale` to
 * the request object so downstream controllers/services can use it.
 *
 * Supported locales are read from the `SUPPORTED_LOCALES` env var
 * (comma-separated, e.g. "en,ne,ja"). Falls back to 'en'.
 */
@Injectable()
export class LocaleInterceptor implements NestInterceptor {
  private static readonly DEFAULT = 'en';
  private static supported: Set<string> | null = null;

  private getSupportedLocales(): Set<string> {
    if (!LocaleInterceptor.supported) {
      const raw = process.env.SUPPORTED_LOCALES || 'en,ne';
      LocaleInterceptor.supported = new Set(
        raw.split(',').map((l) => l.trim().toLowerCase()).filter(Boolean),
      );
      // Always include default
      LocaleInterceptor.supported.add(LocaleInterceptor.DEFAULT);
    }
    return LocaleInterceptor.supported;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['accept-language'] || '';
    request.locale = this.resolve(header);
    return next.handle();
  }

  private resolve(header: string): string {
    const supported = this.getSupportedLocales();
    // Parse Accept-Language: e.g. "ne-NP,ne;q=0.9,en;q=0.8"
    const tags = header
      .split(',')
      .map((part) => {
        const [tag, qPart] = part.trim().split(';');
        const q = qPart ? parseFloat(qPart.replace('q=', '')) : 1;
        return { lang: tag.trim().split('-')[0].toLowerCase(), q };
      })
      .sort((a, b) => b.q - a.q);

    for (const { lang } of tags) {
      if (supported.has(lang)) return lang;
    }
    return LocaleInterceptor.DEFAULT;
  }
}
