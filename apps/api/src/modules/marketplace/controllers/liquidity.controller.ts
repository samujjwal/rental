import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { LiquidityEngineService } from '../services/liquidity-engine.service';
import { HealthMetricsQueryDto, HealthHistoryQueryDto, SupplyGapQueryDto, CreateCampaignDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Liquidity Engine')
@Controller('marketplace/liquidity')
export class LiquidityController {
  constructor(private readonly liquidityEngine: LiquidityEngineService) {}

  @Get('health')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate marketplace health metrics for a country' })
  @ApiResponse({ status: 200, description: 'Health metrics calculated' })
  async getHealthMetrics(@Query() query: HealthMetricsQueryDto) {
    return this.liquidityEngine.calculateHealthMetrics(query.country, query.region);
  }

  @Get('health/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get historical health metrics' })
  @ApiResponse({ status: 200, description: 'Health history retrieved' })
  async getHealthHistory(@Query() query: HealthHistoryQueryDto) {
    return this.liquidityEngine.getHealthHistory(query.country, query.days, query.region);
  }

  @Get('supply-gaps')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Identify regions with supply gaps below threshold' })
  @ApiResponse({ status: 200, description: 'Supply gaps identified' })
  async identifySupplyGaps(@Query() query: SupplyGapQueryDto) {
    return this.liquidityEngine.identifySupplyGaps(query.threshold);
  }

  @Post('campaigns')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a host activation campaign' })
  @ApiResponse({ status: 201, description: 'Campaign created' })
  async createCampaign(@Body() dto: CreateCampaignDto) {
    return this.liquidityEngine.createActivationCampaign({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    });
  }
}
