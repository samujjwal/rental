import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { FraudIntelligenceService } from '../services/fraud-intelligence.service';
import { AnalyzeRiskDto, RegisterDeviceDto, ResolveSignalDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Fraud Intelligence')
@Controller('marketplace/fraud')
export class FraudIntelligenceController {
  constructor(private readonly fraud: FraudIntelligenceService) {}

  @Post('analyze')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analyze risk for an entity (booking, user, payment)' })
  @ApiResponse({ status: 200, description: 'Risk analysis completed' })
  async analyzeRisk(@Body() dto: AnalyzeRiskDto) {
    return this.fraud.analyzeRisk(dto.entityType, dto.entityId, dto.context);
  }

  @Post('devices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a device fingerprint' })
  @ApiResponse({ status: 201, description: 'Device registered' })
  async registerDevice(@CurrentUser('id') userId: string, @Body() dto: RegisterDeviceDto) {
    return this.fraud.registerDevice(userId, dto.fingerprint, dto.metadata);
  }

  @Get('signals/:entityType/:entityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get fraud signals for an entity' })
  @ApiResponse({ status: 200, description: 'Signals retrieved' })
  async getSignals(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.fraud.getSignals(entityType, entityId);
  }

  @Patch('signals/:signalId/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve a fraud signal' })
  @ApiResponse({ status: 200, description: 'Signal resolved' })
  async resolveSignal(@Param('signalId') signalId: string, @Body() dto: ResolveSignalDto) {
    return this.fraud.resolveSignal(signalId, dto.resolvedBy);
  }

  @Get('risk/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user risk score' })
  @ApiResponse({ status: 200, description: 'Risk score returned' })
  async getUserRiskScore(@Param('userId') userId: string) {
    return this.fraud.getUserRiskScore(userId);
  }
}
