import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { TaxPolicyEngineService } from '../services/tax-policy-engine.service';
import { UpsertTaxPolicyDto, CalculateTaxDto, UpdatePolicyVersionDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Tax Policy Engine')
@Controller('marketplace/tax')
export class TaxPolicyController {
  constructor(private readonly taxEngine: TaxPolicyEngineService) {}

  @Post('policies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upsert a tax policy for a jurisdiction' })
  @ApiResponse({ status: 201, description: 'Tax policy created/updated' })
  async upsertPolicy(@Body() dto: UpsertTaxPolicyDto) {
    return this.taxEngine.upsertTaxPolicy({
      ...dto,
      effectiveFrom: new Date(dto.effectiveFrom),
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
    });
  }

  @Get('policies')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get applicable tax policies for a jurisdiction' })
  @ApiResponse({ status: 200, description: 'Tax policies returned' })
  async getApplicable(@Query('country') country: string, @Query('region') region?: string) {
    return this.taxEngine.getApplicablePolicies(country, region);
  }

  @Post('calculate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate taxes for a transaction amount' })
  @ApiResponse({ status: 200, description: 'Tax calculation completed' })
  async calculateTax(@Body() dto: CalculateTaxDto) {
    return this.taxEngine.calculateTax(dto.country, dto.amount, {
      region: dto.region,
      date: dto.date ? new Date(dto.date) : undefined,
    });
  }

  @Patch('policies/:policyId/version')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new version of a tax policy (rate change)' })
  @ApiResponse({ status: 200, description: 'Policy version updated' })
  async updateVersion(@Param('policyId') policyId: string, @Body() dto: UpdatePolicyVersionDto) {
    return this.taxEngine.updatePolicyVersion(policyId, dto.newRate, new Date(dto.effectiveFrom));
  }

  @Get('policies/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tax policy history for a country' })
  @ApiResponse({ status: 200, description: 'Policy history returned' })
  async getPolicyHistory(@Query('country') country: string, @Query('taxType') taxType?: string) {
    return this.taxEngine.getPolicyHistory(country, taxType);
  }

  @Post('seed/nepal')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Seed default Nepal tax policies' })
  @ApiResponse({ status: 201, description: 'Nepal tax policies seeded' })
  async seedNepal() {
    return this.taxEngine.seedNepalTaxPolicies();
  }
}
