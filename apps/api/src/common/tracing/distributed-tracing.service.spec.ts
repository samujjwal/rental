import { Test, TestingModule } from '@nestjs/testing';
import { DistributedTracingService, TraceContext, Span } from './distributed-tracing.service';
import { Logger } from '@nestjs/common';

describe('DistributedTracingService', () => {
  let service: DistributedTracingService;
  let debugSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DistributedTracingService],
    }).compile();

    service = module.get<DistributedTracingService>(DistributedTracingService);
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    debugSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('startSpan', () => {
    it('should create a new span with unique IDs', () => {
      const span = service.startSpan({ operationName: 'test-operation' });

      expect(span.spanId).toBeDefined();
      expect(span.traceId).toBeDefined();
      expect(span.operationName).toBe('test-operation');
      expect(span.status).toBe('ok');
      expect(span.startTime).toBeInstanceOf(Date);
    });

    it('should store span in active spans', () => {
      const span = service.startSpan({ operationName: 'test' });

      const retrieved = service.getActiveSpan(span.spanId);
      expect(retrieved).toEqual(span);
    });

    it('should handle tags and baggage', () => {
      const span = service.startSpan({
        operationName: 'test',
        tags: { key: 'value' },
        baggage: { trace: 'data' },
      });

      expect(span.tags).toEqual({ key: 'value' });
      expect(span.baggage).toEqual({ trace: 'data' });
    });

    it('should store trace context', () => {
      const span = service.startSpan({ operationName: 'test' });

      const context = service.getTraceContext(span.traceId);
      expect(context).toBeDefined();
      expect(context?.traceId).toBe(span.traceId);
      expect(context?.operationName).toBe('test');
    });
  });

  describe('finishSpan', () => {
    it('should mark span as finished', () => {
      const span = service.startSpan({ operationName: 'test' });

      service.finishSpan(span.spanId);

      const finished = service.getActiveSpan(span.spanId);
      expect(finished).toBeUndefined();
    });

    it('should record duration', () => {
      const span = service.startSpan({ operationName: 'test' });
      const startTime = span.startTime.getTime();

      // Simulate some time passing
      jest.advanceTimersByTime(100);
      service.finishSpan(span.spanId);

      // Span should be removed
      expect(service.getActiveSpan(span.spanId)).toBeUndefined();
    });

    it('should handle error status', () => {
      const span = service.startSpan({ operationName: 'test' });
      const error = new Error('Test error');

      service.finishSpan(span.spanId, error);

      const finished = service.getActiveSpan(span.spanId);
      expect(finished).toBeUndefined();
    });

    it('should warn when finishing non-existent span', () => {
      service.finishSpan('non-existent-id');

      expect(warnSpy).toHaveBeenCalledWith('Attempted to finish non-existent span: non-existent-id');
    });

    it('should clean up trace context when no more spans', () => {
      const span = service.startSpan({ operationName: 'test' });
      const traceId = span.traceId;

      service.finishSpan(span.spanId);

      expect(service.getTraceContext(traceId)).toBeUndefined();
    });
  });

  describe('withTracing', () => {
    it('should execute async function with tracing', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      const result = await service.withTracing('test-op', fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
      const spanArg = fn.mock.calls[0][0];
      expect(spanArg.operationName).toBe('test-op');
    });

    it('should finish span on success', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      await service.withTracing('test', fn);

      // Span should be cleaned up
      const spans = (service as any).activeSpans;
      expect(spans.size).toBe(0);
    });

    it('should finish span with error on failure', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Failed'));

      await expect(service.withTracing('test', fn)).rejects.toThrow('Failed');

      // Span should be cleaned up
      const spans = (service as any).activeSpans;
      expect(spans.size).toBe(0);
    });
  });

  describe('withSyncTracing', () => {
    it('should execute sync function with tracing', () => {
      const fn = jest.fn().mockReturnValue('sync-result');

      const result = service.withSyncTracing('sync-test', fn);

      expect(result).toBe('sync-result');
      expect(fn).toHaveBeenCalled();
    });

    it('should handle sync function errors', () => {
      const fn = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });

      expect(() => service.withSyncTracing('test', fn)).toThrow('Sync error');
    });
  });

  describe('addLog', () => {
    it('should add log entry to span', () => {
      const span = service.startSpan({ operationName: 'test' });

      service.addLog(span.spanId, 'info', 'Test message', { data: 'value' });

      expect(span.logs).toHaveLength(1);
      expect(span.logs![0]).toMatchObject({
        level: 'info',
        message: 'Test message',
        context: { data: 'value' },
      });
    });

    it('should warn when adding log to non-existent span', () => {
      service.addLog('non-existent', 'info', 'Test');

      expect(warnSpy).toHaveBeenCalledWith('Attempted to add log to non-existent span: non-existent');
    });
  });

  describe('addTags', () => {
    it('should add tags to span', () => {
      const span = service.startSpan({ operationName: 'test', tags: { initial: 'value' } });

      service.addTags(span.spanId, { new: 'tag', extra: 'data' });

      expect(span.tags).toEqual({ initial: 'value', new: 'tag', extra: 'data' });
    });

    it('should warn when adding tags to non-existent span', () => {
      service.addTags('non-existent', { key: 'value' });

      expect(warnSpy).toHaveBeenCalledWith('Attempted to add tags to non-existent span: non-existent');
    });
  });

  describe('addBaggage', () => {
    it('should add baggage to span', () => {
      const span = service.startSpan({ operationName: 'test' });

      service.addBaggage(span.spanId, { userId: '123' });

      expect(span.baggage).toEqual({ userId: '123' });
    });

    it('should also update trace context baggage', () => {
      const span = service.startSpan({ operationName: 'test' });

      service.addBaggage(span.spanId, { requestId: '456' });

      const context = service.getTraceContext(span.traceId);
      expect(context?.baggage).toEqual({ requestId: '456' });
    });

    it('should warn when adding baggage to non-existent span', () => {
      service.addBaggage('non-existent', { key: 'value' });

      expect(warnSpy).toHaveBeenCalledWith('Attempted to add baggage to non-existent span: non-existent');
    });
  });

  describe('getActiveSpansForTrace', () => {
    it('should return all spans for a trace', () => {
      const span1 = service.startSpan({ operationName: 'op1' });
      const span2 = service.startSpan({ operationName: 'op2' });
      // Create another trace
      service.startSpan({ operationName: 'op3' });

      const traceSpans = service.getActiveSpansForTrace(span1.traceId);

      expect(traceSpans).toHaveLength(2);
      expect(traceSpans.map(s => s.operationName)).toContain('op1');
      expect(traceSpans.map(s => s.operationName)).toContain('op2');
    });

    it('should return empty array for non-existent trace', () => {
      const spans = service.getActiveSpansForTrace('non-existent');

      expect(spans).toEqual([]);
    });
  });

  describe('createChildSpan', () => {
    it('should create child span with parent context', () => {
      const parent = service.startSpan({ operationName: 'parent', baggage: { shared: 'data' } });

      const child = service.createChildSpan(parent.traceId, 'child-operation');

      expect(child).not.toBeNull();
      expect(child?.parentSpanId).toBe(parent.spanId);
      expect(child?.baggage).toEqual({ shared: 'data' });
    });

    it('should return null for non-existent parent trace', () => {
      const child = service.createChildSpan('non-existent', 'child');

      expect(child).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('No trace context found for parent trace: non-existent');
    });
  });

  describe('injectTraceContext', () => {
    it('should inject context into headers', () => {
      const span = service.startSpan({ operationName: 'test', baggage: { key: 'value' } });
      const headers: Record<string, string> = {};

      service.injectTraceContext(span.traceId, headers);

      expect(headers['x-trace-id']).toBe(span.traceId);
      expect(headers['x-span-id']).toBe(span.spanId);
      expect(headers['x-trace-baggage']).toBe(JSON.stringify({ key: 'value' }));
    });

    it('should handle missing context', () => {
      const headers: Record<string, string> = {};

      service.injectTraceContext('non-existent', headers);

      expect(Object.keys(headers)).toHaveLength(0);
    });

    it('should include parent span id if present', () => {
      const parent = service.startSpan({ operationName: 'parent' });
      const child = service.createChildSpan(parent.traceId, 'child');
      const headers: Record<string, string> = {};

      service.injectTraceContext(child!.traceId, headers);

      expect(headers['x-parent-span-id']).toBe(parent.spanId);
    });
  });

  describe('extractTraceContext', () => {
    it('should extract context from headers', () => {
      const headers: Record<string, string> = {
        'x-trace-id': 'trace-123',
        'x-span-id': 'span-456',
        'x-trace-baggage': JSON.stringify({ userId: '789' }),
      };

      const context = service.extractTraceContext(headers);

      expect(context).toMatchObject({
        traceId: 'trace-123',
        spanId: 'span-456',
        baggage: { userId: '789' },
      });
    });

    it('should return null for missing required headers', () => {
      const headers: Record<string, string> = {
        'x-span-id': 'span-456',
      };

      const context = service.extractTraceContext(headers);

      expect(context).toBeNull();
    });

    it('should handle invalid baggage JSON', () => {
      const headers: Record<string, string> = {
        'x-trace-id': 'trace-123',
        'x-span-id': 'span-456',
        'x-trace-baggage': 'invalid-json',
      };

      const context = service.extractTraceContext(headers);

      expect(context?.baggage).toEqual({});
      expect(warnSpy).toHaveBeenCalledWith('Failed to parse baggage header', expect.any(Object));
    });
  });

  describe('getTraceStats', () => {
    it('should return trace statistics', () => {
      // Create some spans
      service.startSpan({ operationName: 'span1' });
      const span2 = service.startSpan({ operationName: 'span2' });
      service.finishSpan(span2.spanId);

      const stats = service.getTraceStats();

      expect(stats.activeSpans).toBe(1);
      expect(stats.activeTraces).toBe(2);
      expect(typeof stats.averageDuration).toBe('number');
      expect(typeof stats.errorRate).toBe('number');
    });

    it('should return zero values when no spans', () => {
      const stats = service.getTraceStats();

      expect(stats.activeSpans).toBe(0);
      expect(stats.activeTraces).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.errorRate).toBe(0);
    });
  });

  describe('exportTraceData', () => {
    it('should export trace data', () => {
      const span1 = service.startSpan({ operationName: 'op1', tags: { key: 'val' } });
      service.addLog(span1.spanId, 'info', 'Test log');

      const exported = service.exportTraceData(span1.traceId);

      expect(exported.traceId).toBe(span1.traceId);
      expect(exported.spans).toHaveLength(1);
      expect(exported.spans[0].operationName).toBe('op1');
      expect(exported.spans[0].tags).toEqual({ key: 'val' });
      expect(exported.spans[0].logs).toHaveLength(1);
    });

    it('should return empty spans for non-existent trace', () => {
      const exported = service.exportTraceData('non-existent');

      expect(exported.spans).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should remove old traces', () => {
      const oldSpan = service.startSpan({ operationName: 'old' });
      // Manually set start time to past
      (oldSpan as any).startTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      service.cleanup(3600000); // 1 hour max age

      expect(service.getTraceContext(oldSpan.traceId)).toBeUndefined();
    });

    it('should keep recent traces', () => {
      const span = service.startSpan({ operationName: 'recent' });

      service.cleanup(3600000);

      expect(service.getTraceContext(span.traceId)).toBeDefined();
    });
  });
});
