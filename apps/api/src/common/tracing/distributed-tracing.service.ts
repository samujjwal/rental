import { Injectable, Logger } from '@nestjs/common';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  tags?: Record<string, any>;
  baggage?: Record<string, string>;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'ok' | 'error';
  error?: any;
  tags?: Record<string, any>;
  logs?: Array<{
    timestamp: Date;
    level: string;
    message: string;
    context?: Record<string, any>;
  }>;
  baggage?: Record<string, string>;
}

export interface TraceOptions {
  operationName: string;
  parentSpanId?: string;
  tags?: Record<string, any>;
  baggage?: Record<string, string>;
}

@Injectable()
export class DistributedTracingService {
  private readonly logger = new Logger(DistributedTracingService.name);
  private readonly activeSpans = new Map<string, Span>();
  private readonly traceContext = new Map<string, TraceContext>();

  /**
   * Start a new span
   */
  startSpan(options: TraceOptions): Span {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();

    const span: Span = {
      traceId,
      spanId,
      parentSpanId: options.parentSpanId,
      operationName: options.operationName,
      startTime: new Date(),
      status: 'ok',
      tags: options.tags,
      baggage: options.baggage,
      logs: [],
    };

    this.activeSpans.set(spanId, span);
    
    // Store trace context for propagation
    this.traceContext.set(traceId, {
      traceId,
      spanId,
      parentSpanId: options.parentSpanId,
      operationName: options.operationName,
      startTime: span.startTime,
      tags: options.tags,
      baggage: options.baggage,
    });

    this.logger.debug(`Started span: ${span.operationName}`, {
      traceId,
      spanId,
      parentSpanId: options.parentSpanId,
    });

    return span;
  }

  /**
   * Finish a span
   */
  finishSpan(spanId: string, error?: any): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(`Attempted to finish non-existent span: ${spanId}`);
      return;
    }

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();

    if (error) {
      span.status = 'error';
      span.error = error;
      this.addLog(spanId, 'error', error.message || 'Unknown error', { error });
    }

    this.logger.debug(`Finished span: ${span.operationName}`, {
      traceId: span.traceId,
      spanId,
      duration: span.duration,
      status: span.status,
    });

    // Remove from active spans
    this.activeSpans.delete(spanId);
    
    // Clean up trace context if no more active spans
    const hasActiveSpans = Array.from(this.activeSpans.values())
      .some(s => s.traceId === span.traceId);
    
    if (!hasActiveSpans) {
      this.traceContext.delete(span.traceId);
    }
  }

  /**
   * Execute a function with tracing
   */
  async withTracing<T>(
    operationName: string,
    fn: (span: Span) => Promise<T>,
    options?: Partial<TraceOptions>,
  ): Promise<T> {
    const span = this.startSpan({
      operationName,
      parentSpanId: options?.parentSpanId,
      tags: options?.tags,
      baggage: options?.baggage,
    });

    try {
      const result = await fn(span);
      this.finishSpan(span.spanId);
      return result;
    } catch (error) {
      this.finishSpan(span.spanId, error);
      throw error;
    }
  }

  /**
   * Execute a sync function with tracing
   */
  withSyncTracing<T>(
    operationName: string,
    fn: (span: Span) => T,
    options?: Partial<TraceOptions>,
  ): T {
    const span = this.startSpan({
      operationName,
      parentSpanId: options?.parentSpanId,
      tags: options?.tags,
      baggage: options?.baggage,
    });

    try {
      const result = fn(span);
      this.finishSpan(span.spanId);
      return result;
    } catch (error) {
      this.finishSpan(span.spanId, error);
      throw error;
    }
  }

  /**
   * Add a log entry to a span
   */
  addLog(spanId: string, level: string, message: string, context?: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(`Attempted to add log to non-existent span: ${spanId}`);
      return;
    }

    if (!span.logs) {
      span.logs = [];
    }

    span.logs.push({
      timestamp: new Date(),
      level,
      message,
      context,
    });

    this.logger.debug(`[${level}] ${message}`, {
      traceId: span.traceId,
      spanId,
      ...context,
    });
  }

  /**
   * Add tags to a span
   */
  addTags(spanId: string, tags: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(`Attempted to add tags to non-existent span: ${spanId}`);
      return;
    }

    span.tags = { ...span.tags, ...tags };
  }

  /**
   * Add baggage to a span (propagates to child spans)
   */
  addBaggage(spanId: string, baggage: Record<string, string>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(`Attempted to add baggage to non-existent span: ${spanId}`);
      return;
    }

    span.baggage = { ...span.baggage, ...baggage };
    
    // Also update trace context
    const traceCtx = this.traceContext.get(span.traceId);
    if (traceCtx) {
      traceCtx.baggage = { ...traceCtx.baggage, ...baggage };
    }
  }

  /**
   * Get current trace context
   */
  getTraceContext(traceId: string): TraceContext | undefined {
    return this.traceContext.get(traceId);
  }

  /**
   * Get active span
   */
  getActiveSpan(spanId: string): Span | undefined {
    return this.activeSpans.get(spanId);
  }

  /**
   * Get all active spans for a trace
   */
  getActiveSpansForTrace(traceId: string): Span[] {
    return Array.from(this.activeSpans.values())
      .filter(span => span.traceId === traceId);
  }

  /**
   * Create child span from parent context
   */
  createChildSpan(
    parentTraceId: string,
    operationName: string,
    tags?: Record<string, any>,
  ): Span | null {
    const parentContext = this.traceContext.get(parentTraceId);
    if (!parentContext) {
      this.logger.warn(`No trace context found for parent trace: ${parentTraceId}`);
      return null;
    }

    return this.startSpan({
      operationName,
      parentSpanId: parentContext.spanId,
      tags,
      baggage: parentContext.baggage,
    });
  }

  /**
   * Inject trace context into headers for propagation
   */
  injectTraceContext(traceId: string, headers: Record<string, string>): void {
    const context = this.traceContext.get(traceId);
    if (!context) {
      return;
    }

    headers['x-trace-id'] = context.traceId;
    headers['x-span-id'] = context.spanId;
    
    if (context.parentSpanId) {
      headers['x-parent-span-id'] = context.parentSpanId;
    }

    // Inject baggage
    if (context.baggage) {
      headers['x-trace-baggage'] = JSON.stringify(context.baggage);
    }
  }

  /**
   * Extract trace context from headers
   */
  extractTraceContext(headers: Record<string, string>): TraceContext | null {
    const traceId = headers['x-trace-id'];
    const spanId = headers['x-span-id'];
    const parentSpanId = headers['x-parent-span-id'];
    const baggageHeader = headers['x-trace-baggage'];

    if (!traceId || !spanId) {
      return null;
    }

    let baggage: Record<string, string> = {};
    if (baggageHeader) {
      try {
        baggage = JSON.parse(baggageHeader);
      } catch (error) {
        this.logger.warn('Failed to parse baggage header', { baggageHeader });
      }
    }

    const context: TraceContext = {
      traceId,
      spanId,
      parentSpanId,
      operationName: 'external-operation',
      startTime: new Date(),
      baggage,
    };

    // Store the extracted context
    this.traceContext.set(traceId, context);

    return context;
  }

  /**
   * Get trace statistics
   */
  getTraceStats(): {
    activeSpans: number;
    activeTraces: number;
    averageDuration: number;
    errorRate: number;
  } {
    const spans = Array.from(this.activeSpans.values());
    const traces = new Set(spans.map(s => s.traceId));

    const completedSpans = spans.filter(s => s.endTime);
    const errorSpans = completedSpans.filter(s => s.status === 'error');

    const averageDuration = completedSpans.length > 0
      ? completedSpans.reduce((sum, s) => sum + (s.duration || 0), 0) / completedSpans.length
      : 0;

    const errorRate = completedSpans.length > 0
      ? errorSpans.length / completedSpans.length
      : 0;

    return {
      activeSpans: spans.length,
      activeTraces: traces.size,
      averageDuration,
      errorRate,
    };
  }

  /**
   * Export trace data for external monitoring
   */
  exportTraceData(traceId: string): any {
    const spans = this.getActiveSpansForTrace(traceId);
    
    return {
      traceId,
      spans: spans.map(span => ({
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        operationName: span.operationName,
        startTime: span.startTime,
        endTime: span.endTime,
        duration: span.duration,
        status: span.status,
        tags: span.tags,
        logs: span.logs,
        baggage: span.baggage,
      })),
    };
  }

  /**
   * Generate unique trace ID
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Generate unique span ID
   */
  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Clean up old traces (prevent memory leaks)
   */
  cleanup(maxAge: number = 3600000): void { // 1 hour default
    const now = Date.now();
    const expiredTraces: string[] = [];

    for (const [traceId, context] of this.traceContext.entries()) {
      if (now - context.startTime.getTime() > maxAge) {
        expiredTraces.push(traceId);
      }
    }

    for (const traceId of expiredTraces) {
      this.traceContext.delete(traceId);
      
      // Remove any spans for expired traces
      const spansToRemove = Array.from(this.activeSpans.entries())
        .filter(([_, span]) => span.traceId === traceId)
        .map(([spanId, _]) => spanId);
      
      for (const spanId of spansToRemove) {
        this.activeSpans.delete(spanId);
      }
    }

    if (expiredTraces.length > 0) {
      this.logger.debug(`Cleaned up ${expiredTraces.length} expired traces`);
    }
  }
}
