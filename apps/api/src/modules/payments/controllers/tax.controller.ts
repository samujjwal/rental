import { Controller, Get, Post, Body, Query, UseGuards, Param, ForbiddenException, NotFoundException } from '@nestjs/common';
import { i18nNotFound, i18nForbidden } from '@/common/errors/i18n-exceptions';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { StripeTaxService } from '../services/stripe-tax.service';
import {
  CalculateTaxDto,
  CreateTaxTransactionDto,
  RegisterForTaxDto,
  Generate1099Dto,
} from '../dto/tax.dto';

@ApiTags('tax')
@Controller('tax')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TaxController {
  constructor(private readonly stripeTaxService: StripeTaxService) {}

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate tax for a transaction' })
  @ApiResponse({ status: 200, description: 'Tax calculated successfully' })
  async calculateTax(
    @Body() data: CalculateTaxDto,
  ) {
    return this.stripeTaxService.calculateTax(data);
  }

  @Post('transaction')
  @ApiOperation({ summary: 'Create tax transaction' })
  @ApiResponse({ status: 200, description: 'Tax transaction created successfully' })
  async createTaxTransaction(@Body() data: CreateTaxTransactionDto) {
    return this.stripeTaxService.createTaxTransaction(data.paymentIntentId, data.taxCalculationId);
  }

  @Get('registrations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get tax registrations' })
  @ApiResponse({ status: 200, description: 'Tax registrations retrieved successfully' })
  async getTaxRegistrations() {
    return this.stripeTaxService.getTaxRegistrations();
  }

  @Post('register')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Register for tax in a jurisdiction' })
  @ApiResponse({ status: 200, description: 'Tax registration created successfully' })
  async registerForTax(@Body() data: RegisterForTaxDto) {
    return this.stripeTaxService.registerForTax(data.country, data.state, data.taxId);
  }

  @Get('summary/:userId')
  @ApiOperation({ summary: 'Get user tax summary' })
  @ApiResponse({ status: 200, description: 'Tax summary retrieved successfully' })
  async getUserTaxSummary(
    @CurrentUser('id') currentUserId: string,
    @Param('userId') userId: string,
    @Query('year') year?: number,
  ) {
    if (currentUserId !== userId) {
      throw i18nForbidden('payment.unauthorizedTaxAccess');
    }
    return this.stripeTaxService.getUserTaxSummary(userId, year);
  }

  @Post('1099')
  @ApiOperation({ summary: 'Generate 1099 form' })
  @ApiResponse({ status: 200, description: '1099 form generated successfully' })
  async generate1099Form(
    @CurrentUser('id') currentUserId: string,
    @Body() data: Generate1099Dto,
  ) {
    if (currentUserId !== data.userId) {
      throw i18nForbidden('payment.unauthorized1099Access');
    }
    return this.stripeTaxService.generate1099Form(data.userId, data.year);
  }

  @Get('jurisdictions')
  @ApiOperation({ summary: 'Get supported tax jurisdictions' })
  @ApiResponse({ status: 200, description: 'Supported jurisdictions retrieved successfully' })
  async getSupportedJurisdictions() {
    return this.stripeTaxService.getSupportedJurisdictions();
  }

  @Get('test')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Test tax calculation' })
  @ApiResponse({ status: 200, description: 'Tax calculation test result' })
  async testTaxCalculation() {
    if (process.env.NODE_ENV === 'production') {
      throw i18nNotFound('common.notFound');
    }
    return this.stripeTaxService.testTaxCalculation();
  }
}
