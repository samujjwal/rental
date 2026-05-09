/**
 * Dead Letter Queue (DLQ) Controller
 * 
 * Provides REST API endpoints for DLQ management:
 * - Get queue statistics
 * - Inspect failed jobs
 * - Retry jobs
 * - Delete/purge jobs
 */

import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, RequireMFA, MfaGuard } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { DLQService, DLQMessage, DLQStats, RetryOptions } from './dlq.service';

@ApiTags('admin-dlq')
@Controller('admin/dlq')
@UseGuards(RolesGuard, MfaGuard)
@ApiBearerAuth()
@Roles('ADMIN', 'SUPER_ADMIN', 'OPERATIONS_ADMIN')
export class DLQController {
  constructor(private readonly dlqService: DLQService) {}

  /**
   * Get statistics for all queues
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get statistics for all queues' })
  @ApiResponse({ status: 200, description: 'Returns statistics for all queues' })
  async getAllQueueStats(): Promise<DLQStats[]> {
    return this.dlqService.getAllQueueStats();
  }

  /**
   * Get statistics for a specific queue
   */
  @Get('stats/:queueName')
  @ApiOperation({ summary: 'Get statistics for a specific queue' })
  @ApiResponse({ status: 200, description: 'Returns statistics for the queue' })
  async getQueueStats(@Param('queueName') queueName: string): Promise<DLQStats> {
    return this.dlqService.getQueueStats(queueName);
  }

  /**
   * Get failed jobs from a queue
   */
  @Get('failed/:queueName')
  @ApiOperation({ summary: 'Get failed jobs from a queue' })
  @ApiResponse({ status: 200, description: 'Returns failed jobs' })
  async getFailedJobs(
    @Param('queueName') queueName: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ): Promise<DLQMessage[]> {
    return this.dlqService.getFailedJobs(queueName, limit, offset);
  }

  /**
   * Get a specific failed job
   */
  @Get('failed/:queueName/:jobId')
  @ApiOperation({ summary: 'Get a specific failed job' })
  @ApiResponse({ status: 200, description: 'Returns the failed job' })
  async getFailedJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ): Promise<DLQMessage | null> {
    return this.dlqService.getFailedJob(queueName, jobId);
  }

  /**
   * Retry a failed job
   */
  @Post('retry/:queueName/:jobId')
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiResponse({ status: 200, description: 'Job retried successfully' })
  @RequireMFA()
  async retryJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
    @Body() options: RetryOptions = {},
  ): Promise<void> {
    return this.dlqService.retryJob(queueName, jobId, options);
  }

  /**
   * Retry multiple failed jobs in bulk
   */
  @Post('retry/bulk/:queueName')
  @ApiOperation({ summary: 'Retry multiple failed jobs in bulk' })
  @ApiResponse({ status: 200, description: 'Bulk retry completed' })
  @RequireMFA()
  async retryBulkJobs(
    @Param('queueName') queueName: string,
    @Body() body: { jobIds: string[]; options?: RetryOptions },
  ): Promise<{ succeeded: string[]; failed: { jobId: string; error: string }[] }> {
    return this.dlqService.retryBulkJobs(queueName, body.jobIds, body.options || {});
  }

  /**
   * Move a failed job to waiting
   */
  @Post('move-to-waiting/:queueName/:jobId')
  @ApiOperation({ summary: 'Move a failed job to waiting queue' })
  @ApiResponse({ status: 200, description: 'Job moved to waiting successfully' })
  @RequireMFA()
  async moveToWaiting(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ): Promise<void> {
    return this.dlqService.moveToWaiting(queueName, jobId);
  }

  /**
   * Delete a failed job
   */
  @Delete('failed/:queueName/:jobId')
  @ApiOperation({ summary: 'Delete a failed job' })
  @ApiResponse({ status: 200, description: 'Job deleted successfully' })
  @RequireMFA()
  async deleteJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ): Promise<void> {
    return this.dlqService.deleteJob(queueName, jobId);
  }

  /**
   * Purge all failed jobs from a queue
   */
  @Delete('purge/:queueName')
  @ApiOperation({ summary: 'Purge all failed jobs from a queue' })
  @ApiResponse({ status: 200, description: 'Returns number of purged jobs' })
  @RequireMFA()
  async purgeFailedJobs(@Param('queueName') queueName: string): Promise<{ count: number }> {
    const count = await this.dlqService.purgeFailedJobs(queueName);
    return { count };
  }

  /**
   * Purge failed jobs older than specified hours
   */
  @Delete('purge/:queueName/old')
  @ApiOperation({ summary: 'Purge failed jobs older than specified hours' })
  @ApiResponse({ status: 200, description: 'Returns number of purged jobs' })
  @RequireMFA()
  async purgeOldFailedJobs(
    @Param('queueName') queueName: string,
    @Query('olderThanHours') olderThanHours: number = 24,
  ): Promise<{ count: number }> {
    const count = await this.dlqService.purgeOldFailedJobs(queueName, olderThanHours);
    return { count };
  }

  /**
   * Get all queue names
   */
  @Get('queues')
  @ApiOperation({ summary: 'Get all available queue names' })
  @ApiResponse({ status: 200, description: 'Returns queue names' })
  async getQueueNames(): Promise<string[]> {
    return this.dlqService.getQueueNames();
  }
}
