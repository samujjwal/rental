import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AiUsageLedgerService } from '../services/ai-usage-ledger.service';

/**
 * AiTelemetryInterceptor
 *
 * Emits a structured telemetry log entry for every AI API response.
 * Attach to any AI controller or specific route handlers via @UseInterceptors().
 *
 * Emitted fields (all string/number, safe for log indexing):
 *   ai.promptId        — registered prompt identifier
 *   ai.promptVersion   — semver prompt version
 *   ai.fromProvider    — true when the real LLM was called
 *   ai.latencyMs       — provider round-trip time
 *   ai.model           — settled model name as returned by the provider
 *   ai.tokens.prompt   — prompt token count (when available)
 *   ai.tokens.completion — completion token count (when available)
 *   ai.tokens.total    — total token count (when available)
 *   req.correlationId  — x-request-id for cross-service tracing
 *   req.path           — HTTP path
 *   req.method         — HTTP method
 *
 * Usage:
 *   @UseInterceptors(AiTelemetryInterceptor)
 *   @Post('generate-description')
 *   async generateDescription(...) { ... }
 */
@Injectable()
export class AiTelemetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AiTelemetry');

  constructor(private readonly usageLedger: AiUsageLedgerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const correlationId =
      (req.headers['x-request-id'] as string | undefined) ||
      (req as any).requestId ||
      'unknown';
    const path = req.path;
    const method = req.method;
    const start = Date.now();

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        if (!responseBody || typeof responseBody !== 'object') return;

        const body = responseBody as Record<string, any>;

        // Normalise the response shape — AI endpoints return different shapes:
        //   generateListingDescription → { description, promptId, promptVersion, fromProvider, latencyMs, model, usage }
        //   generateListingSuggestions → { suggestions, promptId, promptVersion, fromProvider, latencyMs, model, usage }
        //   market-insights            → aggregated DB data (no LLM call, skip telemetry)
        if (!('promptId' in body)) return;

        const entry: Record<string, any> = {
          event: 'ai.completion',
          'req.correlationId': correlationId,
          'req.path': path,
          'req.method': method,
          'req.wallMs': Date.now() - start,
          'ai.promptId': body['promptId'] ?? 'unknown',
          'ai.promptVersion': body['promptVersion'] ?? 'unknown',
          'ai.fromProvider': Boolean(body['fromProvider']),
          'ai.latencyMs': typeof body['latencyMs'] === 'number' ? body['latencyMs'] : null,
          'ai.model': body['model'] ?? 'unknown',
        };

        if (body['usage'] && typeof body['usage'] === 'object') {
          const u = body['usage'] as Record<string, number>;
          entry['ai.tokens.prompt'] = u['promptTokens'] ?? null;
          entry['ai.tokens.completion'] = u['completionTokens'] ?? null;
          entry['ai.tokens.total'] = u['totalTokens'] ?? null;
        }

        // Structured JSON log — consumed by OpenTelemetry / log aggregators
        this.logger.log(JSON.stringify(entry));

        // Persist token usage to the ledger for cost tracking and budget enforcement
        if (body['fromProvider'] && body['usage'] && typeof body['usage'] === 'object') {
          const u = body['usage'] as Record<string, number>;
          const reqUser = (req as any).user;
          void this.usageLedger.record({
            userId: reqUser?.id ?? reqUser?.sub,
            organizationId: reqUser?.organizationId,
            promptId: body['promptId'] ?? 'unknown',
            promptVersion: body['promptVersion'] ?? 'unknown',
            model: body['model'] ?? 'unknown',
            inputTokens: u['promptTokens'] ?? 0,
            outputTokens: u['completionTokens'] ?? 0,
          });
        }
      }),
    );
  }
}
