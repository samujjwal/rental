import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { CountryPolicyPackService } from '../services/country-policy-pack.service';
import { UpsertPolicyPackDto, ValidateBookingDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Country Policy Packs')
@Controller('marketplace/policy-packs')
export class CountryPolicyController {
  constructor(private readonly policyPack: CountryPolicyPackService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all country policy packs' })
  @ApiResponse({ status: 200, description: 'All policy packs returned' })
  async getAllPacks() {
    return this.policyPack.getAllPolicyPacks();
  }

  @Get(':country')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific country policy pack' })
  @ApiResponse({ status: 200, description: 'Policy pack returned' })
  async getPack(@Param('country') country: string) {
    return this.policyPack.getPolicyPack(country);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or update a country policy pack' })
  @ApiResponse({ status: 201, description: 'Policy pack upserted' })
  async upsertPack(@Body() dto: UpsertPolicyPackDto) {
    return this.policyPack.upsertPolicyPack(dto);
  }

  @Post('validate-booking')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate a booking against country policies' })
  @ApiResponse({ status: 200, description: 'Validation result returned' })
  async validateBooking(@Body() dto: ValidateBookingDto) {
    const { country, ...params } = dto;
    return this.policyPack.validateBooking(country, params);
  }

  @Get(':country/payment-methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get supported payment methods for a country' })
  @ApiResponse({ status: 200, description: 'Payment methods returned' })
  async getPaymentMethods(@Param('country') country: string) {
    return this.policyPack.getPaymentMethods(country);
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Seed default policy packs (NP, IN, BD, LK, US)' })
  @ApiResponse({ status: 201, description: 'Default packs seeded' })
  async seedDefaults() {
    return this.policyPack.seedDefaultPacks();
  }
}
