import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { GeoDistributionService } from '../services/geo-distribution.service';
import { UpsertRegionDto, SimulateFailoverDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Geo Distribution')
@Controller('marketplace/geo')
export class GeoDistributionController {
  constructor(private readonly geo: GeoDistributionService) {}

  @Get('regions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active regions' })
  @ApiResponse({ status: 200, description: 'Active regions returned' })
  async getActiveRegions() {
    return this.geo.getActiveRegions();
  }

  @Get('regions/:country')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the region configuration for a country' })
  @ApiResponse({ status: 200, description: 'Region config returned' })
  async getRegion(@Param('country') country: string) {
    return this.geo.getRegionForCountry(country);
  }

  @Post('regions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or update a region configuration' })
  @ApiResponse({ status: 201, description: 'Region config upserted' })
  async upsertRegion(@Body() dto: UpsertRegionDto) {
    return this.geo.upsertRegionConfig(dto);
  }

  @Get('routing/:country')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get routing hints for a country (DB, CDN, latency budget)' })
  @ApiResponse({ status: 200, description: 'Routing hints returned' })
  async getRoutingHints(@Param('country') country: string) {
    return this.geo.getRoutingHints(country);
  }

  @Post('failover/simulate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Simulate a regional failover scenario' })
  @ApiResponse({ status: 200, description: 'Failover simulation results' })
  async simulateFailover(@Body() dto: SimulateFailoverDto) {
    return this.geo.simulateFailover(dto.fromRegion, dto.toRegion);
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Seed default region configurations' })
  @ApiResponse({ status: 201, description: 'Regions seeded' })
  async seedRegions() {
    return this.geo.seedRegions();
  }
}
