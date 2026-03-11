import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';

/**
 * Prometheus-compatible /metrics endpoint for infrastructure monitoring.
 *
 * Exposes process-level metrics (memory, CPU, event loop lag, active handles)
 * in Prometheus text exposition format. This is separate from the business
 * MetricsService and is intended for scraping by Prometheus / Grafana.
 *
 * For full prom-client integration, install `prom-client` and replace
 * the manual metrics below with its `collectDefaultMetrics()` registry.
 */
@ApiExcludeController()
@Controller()
export class MetricsController {
  @Get('metrics')
  getMetrics(@Res() res: Response) {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    const lines: string[] = [
      '# HELP process_resident_memory_bytes Resident memory size in bytes.',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${memUsage.rss}`,
      '',
      '# HELP process_heap_bytes Process heap size in bytes.',
      '# TYPE process_heap_bytes gauge',
      `process_heap_bytes ${memUsage.heapUsed}`,
      '',
      '# HELP process_heap_total_bytes Process heap total in bytes.',
      '# TYPE process_heap_total_bytes gauge',
      `process_heap_total_bytes ${memUsage.heapTotal}`,
      '',
      '# HELP process_external_memory_bytes External memory in bytes.',
      '# TYPE process_external_memory_bytes gauge',
      `process_external_memory_bytes ${memUsage.external}`,
      '',
      '# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.',
      '# TYPE process_cpu_user_seconds_total counter',
      `process_cpu_user_seconds_total ${cpuUsage.user / 1e6}`,
      '',
      '# HELP process_cpu_system_seconds_total Total system CPU time spent in seconds.',
      '# TYPE process_cpu_system_seconds_total counter',
      `process_cpu_system_seconds_total ${cpuUsage.system / 1e6}`,
      '',
      '# HELP process_start_time_seconds Start time of the process since unix epoch in seconds.',
      '# TYPE process_start_time_seconds gauge',
      `process_start_time_seconds ${Math.floor(Date.now() / 1000 - uptime)}`,
      '',
      '# HELP process_uptime_seconds Process uptime in seconds.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${uptime}`,
      '',
      '# HELP nodejs_active_handles Number of active handles.',
      '# TYPE nodejs_active_handles gauge',
      `nodejs_active_handles ${(process as any)._getActiveHandles?.()?.length ?? 0}`,
      '',
      '# HELP nodejs_active_requests Number of active requests.',
      '# TYPE nodejs_active_requests gauge',
      `nodejs_active_requests ${(process as any)._getActiveRequests?.()?.length ?? 0}`,
      '',
    ];

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(lines.join('\n'));
  }
}
