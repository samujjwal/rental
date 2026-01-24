import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { InsuranceService } from '../services/insurance.service';

@ApiTags('Insurance')
@Controller('insurance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Get('listings/:listingId/requirement')
  @ApiOperation({ summary: 'Check insurance requirement for listing' })
  @ApiResponse({ status: 200, description: 'Requirement retrieved' })
  async checkRequirement(@Param('listingId') listingId: string) {
    return this.insuranceService.checkInsuranceRequirement(listingId);
  }

  @Post('policies')
  @ApiOperation({ summary: 'Upload insurance policy' })
  @ApiResponse({ status: 201, description: 'Policy uploaded' })
  async uploadPolicy(
    @CurrentUser('id') userId: string,
    @Body('listingId') listingId: string,
    @Body('policyNumber') policyNumber: string,
    @Body('provider') provider: string,
    @Body('type') type: string,
    @Body('coverageAmount') coverageAmount: number,
    @Body('effectiveDate') effectiveDate: Date,
    @Body('expirationDate') expirationDate: Date,
    @Body('documentUrl') documentUrl: string,
  ) {
    return this.insuranceService.uploadInsurancePolicy({
      userId,
      listingId,
      policyNumber,
      provider,
      type,
      coverageAmount,
      effectiveDate,
      expirationDate,
      documentUrl,
    });
  }

  @Put('policies/:policyId/verify')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify insurance policy (admin only)' })
  @ApiResponse({ status: 200, description: 'Policy verified' })
  async verifyPolicy(
    @Param('policyId') policyId: string,
    @CurrentUser('id') adminId: string,
    @Body('approved') approved: boolean,
    @Body('notes') notes?: string,
  ) {
    await this.insuranceService.verifyInsurancePolicy(policyId, adminId, approved, notes);
    return { success: true };
  }

  @Get('listings/:listingId/status')
  @ApiOperation({ summary: 'Check if listing has valid insurance' })
  @ApiResponse({ status: 200, description: 'Insurance status retrieved' })
  async getInsuranceStatus(@Param('listingId') listingId: string) {
    const hasValid = await this.insuranceService.hasValidInsurance(listingId);
    return { listingId, hasValidInsurance: hasValid };
  }

  @Get('policies/expiring')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get expiring policies (admin only)' })
  @ApiResponse({ status: 200, description: 'Expiring policies retrieved' })
  async getExpiringPolicies(@Query('days') days?: number) {
    return this.insuranceService.getExpiringPolicies(days ? parseInt(days.toString()) : 30);
  }

  @Post('policies/:policyId/certificate')
  @ApiOperation({ summary: 'Generate insurance certificate' })
  @ApiResponse({ status: 200, description: 'Certificate generated' })
  async generateCertificate(@Param('policyId') policyId: string) {
    return this.insuranceService.generateCertificate(policyId);
  }
}
