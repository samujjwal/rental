import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Header, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { ObservabilityService } from '../services/observability.service';
import { RecordHealthCheckDto, DetectAnomalyDto } from '../dto/marketplace.dto';
import { Response } from 'express';

@ApiTags('Marketplace - Observability')
@Controller('marketplace/observability')
export class ObservabilityController {
  constructor(private readonly observability: ObservabilityService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus-compatible metrics endpoint' })
  @ApiResponse({ status: 200, description: 'Prometheus exposition format metrics' })
  async getPrometheusMetrics(@Res() res: Response) {
    const metrics = await this.observability.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  }

  @Get('health')
  @ApiOperation({ summary: 'Get overall system health status' })
  @ApiResponse({ status: 200, description: 'System health returned' })
  async getSystemHealth() {
    return this.observability.getSystemHealth();
  }

  @Post('health-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a service health check result' })
  @ApiResponse({ status: 201, description: 'Health check recorded' })
  async recordHealthCheck(@Body() dto: RecordHealthCheckDto) {
    return this.observability.recordHealthCheck(dto);
  }

  @Post('anomaly/detect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detect an anomaly in a system metric' })
  @ApiResponse({ status: 200, description: 'Anomaly detection result' })
  async detectAnomaly(@Body() dto: DetectAnomalyDto) {
    return this.observability.detectAnomaly(dto);
  }

  @Get('anomalies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recent anomalies' })
  @ApiResponse({ status: 200, description: 'Anomalies returned' })
  async getRecentAnomalies(@Query('hours') hours?: number, @Query('severity') severity?: string) {
    return this.observability.getRecentAnomalies(hours ?? 24, severity);
  }

  @Patch('anomalies/:anomalyId/acknowledge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Acknowledge and resolve an anomaly' })
  @ApiResponse({ status: 200, description: 'Anomaly acknowledged' })
  async acknowledgeAnomaly(@Param('anomalyId') anomalyId: string, @Query('resolvedBy') resolvedBy: string) {
    return this.observability.acknowledgeAnomaly(anomalyId, resolvedBy);
  }

  @Get('sla/:serviceName')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get SLA metrics for a specific service' })
  @ApiResponse({ status: 200, description: 'SLA metrics returned' })
  async getSlaMetrics(@Param('serviceName') serviceName: string, @Query('days') days?: number) {
    return this.observability.getSlaMetrics(serviceName, days ?? 7);
  }
}
