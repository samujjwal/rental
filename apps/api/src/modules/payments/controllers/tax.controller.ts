import { Controller, Get, Post, Body, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { StripeTaxService } from '../services/stripe-tax.service';

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
    @Body()
    data: {
      amount: number;
      currency: string;
      customerAddress?: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      };
      businessAddress?: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      };
      customerId?: string;
      listingId?: string;
      bookingId?: string;
    },
  ) {
    return this.stripeTaxService.calculateTax(data);
  }

  @Post('transaction')
  @ApiOperation({ summary: 'Create tax transaction' })
  @ApiResponse({ status: 200, description: 'Tax transaction created successfully' })
  async createTaxTransaction(@Body() data: { paymentIntentId: string; taxCalculationId?: string }) {
    return this.stripeTaxService.createTaxTransaction(data.paymentIntentId, data.taxCalculationId);
  }

  @Get('registrations')
  @ApiOperation({ summary: 'Get tax registrations' })
  @ApiResponse({ status: 200, description: 'Tax registrations retrieved successfully' })
  async getTaxRegistrations() {
    return this.stripeTaxService.getTaxRegistrations();
  }

  @Post('register')
  @ApiOperation({ summary: 'Register for tax in a jurisdiction' })
  @ApiResponse({ status: 200, description: 'Tax registration created successfully' })
  async registerForTax(@Body() data: { country: string; state?: string; taxId?: string }) {
    return this.stripeTaxService.registerForTax(data.country, data.state, data.taxId);
  }

  @Get('summary/:userId')
  @ApiOperation({ summary: 'Get user tax summary' })
  @ApiResponse({ status: 200, description: 'Tax summary retrieved successfully' })
  async getUserTaxSummary(@Param('userId') userId: string, @Query('year') year?: number) {
    return this.stripeTaxService.getUserTaxSummary(userId, year);
  }

  @Post('1099')
  @ApiOperation({ summary: 'Generate 1099 form' })
  @ApiResponse({ status: 200, description: '1099 form generated successfully' })
  async generate1099Form(@Body() data: { userId: string; year: number }) {
    return this.stripeTaxService.generate1099Form(data.userId, data.year);
  }

  @Get('jurisdictions')
  @ApiOperation({ summary: 'Get supported tax jurisdictions' })
  @ApiResponse({ status: 200, description: 'Supported jurisdictions retrieved successfully' })
  async getSupportedJurisdictions() {
    return this.stripeTaxService.getSupportedJurisdictions();
  }

  @Get('test')
  @ApiOperation({ summary: 'Test tax calculation' })
  @ApiResponse({ status: 200, description: 'Tax calculation test result' })
  async testTaxCalculation() {
    return this.stripeTaxService.testTaxCalculation();
  }
}
