/**
 * Bull Queue Trace Context Utilities
 *
 * Propagates distributed trace context (traceId, spanId, requestId) across
 * asynchronous Bull queue boundaries. Without this, the causal link between
 * an incoming HTTP request and the resulting queue job is lost in observability
 * tooling (Sentry, Datadog, etc.).
 *
 * Usage — enqueue side:
 *   queue.add('my-job', withTraceCtx({ ...jobData }, traceId, requestId));
 *
 * Usage — processor side:
 *   @Process('my-job')
 *   async handle(job: Job<MyJobData & TraceCtxPayload>) {
 *     const { traceId, requestId } = extractTraceCtx(job);
 *     const logger = createTracedLogger('MyProcessor', traceId, requestId);
 *     ...
 *   }
 */

import { Logger } from '@nestjs/common';

export interface TraceCtxPayload {
  /** Distributed trace ID from the originating HTTP request. */
  _traceId?: string;
  /** Originating request ID (for correlation in logs). */
  _requestId?: string;
  /** ISO timestamp when the job was enqueued. */
  _enqueuedAt?: string;
}

/**
 * Merges trace context into Bull job data.
 * Call this when adding jobs to a queue to ensure causality is preserved.
 */
export function withTraceCtx<T extends object>(
  data: T,
  traceId?: string,
  requestId?: string,
): T & TraceCtxPayload {
  return {
    ...data,
    _traceId: traceId,
    _requestId: requestId,
    _enqueuedAt: new Date().toISOString(),
  };
}

/**
 * Extracts trace context from a Bull job's data payload.
 */
export function extractTraceCtx(job: { data: TraceCtxPayload }): {
  traceId?: string;
  requestId?: string;
  enqueuedAt?: string;
} {
  return {
    traceId: job.data._traceId,
    requestId: job.data._requestId,
    enqueuedAt: job.data._enqueuedAt,
  };
}

/**
 * Creates a NestJS Logger with trace context baked into every message.
 * Prepends [traceId=...] so log aggregators can correlate across services.
 */
export function createTracedLogger(
  context: string,
  traceId?: string,
  requestId?: string,
): Pick<Logger, 'log' | 'warn' | 'error' | 'debug'> {
  const prefix = [
    traceId ? `traceId=${traceId}` : null,
    requestId ? `reqId=${requestId}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const logger = new Logger(context);

  const tag = (msg: string) => (prefix ? `[${prefix}] ${msg}` : msg);

  return {
    log: (msg: string) => logger.log(tag(msg)),
    warn: (msg: string) => logger.warn(tag(msg)),
    error: (msg: string, ...args: any[]) => logger.error(tag(msg), ...args),
    debug: (msg: string) => logger.debug(tag(msg)),
  };
}
