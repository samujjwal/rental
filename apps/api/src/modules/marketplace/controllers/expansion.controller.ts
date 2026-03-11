import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { ExpansionPlannerService } from '../services/expansion-planner.service';
import { EvaluateMarketDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Expansion Planner')
@Controller('marketplace/expansion')
export class ExpansionController {
  constructor(private readonly planner: ExpansionPlannerService) {}

  @Post('evaluate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Evaluate a market for expansion readiness' })
  @ApiResponse({ status: 200, description: 'Market evaluation completed' })
  async evaluateMarket(@Body() dto: EvaluateMarketDto) {
    return this.planner.evaluateMarket(dto.country);
  }

  @Post('simulate/:country')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Simulate expansion into a country' })
  @ApiResponse({ status: 201, description: 'Simulation completed' })
  @HttpCode(HttpStatus.CREATED)
  async simulateExpansion(@Param('country') country: string) {
    return this.planner.simulateExpansion(country);
  }

  @Get('opportunities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ranked market opportunities' })
  @ApiResponse({ status: 200, description: 'Opportunities ranked' })
  async getRankedOpportunities() {
    return this.planner.getRankedOpportunities();
  }
}
