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
import { UserRole, ClaimStatus } from '@rental-portal/database';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/common/auth';
import { InsuranceService } from '../services/insurance.service';
import { InsuranceClaimsService, ReviewClaimDto } from '../services/insurance-claims.service';
import { UploadPolicyDto, CreateClaimDto } from '../dto/insurance.dto';

@ApiTags('Insurance')
@Controller('insurance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InsuranceController {
  constructor(
    private readonly insuranceService: InsuranceService,
    private readonly claimsService: InsuranceClaimsService,
  ) {}

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
    @Body() dto: UploadPolicyDto,
  ) {
    return this.insuranceService.uploadInsurancePolicy({
      userId,
      listingId: dto.listingId,
      policyNumber: dto.policyNumber,
      provider: dto.provider,
      type: dto.type,
      coverageAmount: dto.coverageAmount,
      effectiveDate: new Date(dto.effectiveDate),
      expirationDate: new Date(dto.expirationDate),
      documentUrl: dto.documentUrl,
    });
  }

  @Put('policies/:policyId/verify')
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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

  // ──── Claims Endpoints ────────────────────────────────────

  @Post('claims')
  @ApiOperation({ summary: 'File an insurance claim' })
  @ApiResponse({ status: 201, description: 'Claim filed successfully' })
  async fileClaim(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateClaimDto,
  ) {
    return this.claimsService.fileClaim(userId, dto);
  }

  @Get('claims/my')
  @ApiOperation({ summary: 'Get my claims' })
  @ApiResponse({ status: 200, description: 'User claims retrieved' })
  async getMyClaims(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
  ) {
    return this.claimsService.getUserClaims(
      userId,
      status ? (status as ClaimStatus) : undefined,
    );
  }

  @Get('claims/admin')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List all claims (admin)' })
  @ApiResponse({ status: 200, description: 'All claims retrieved' })
  async getAllClaims(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.claimsService.getAllClaims(
      status ? (status as ClaimStatus) : undefined,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('claims/stats')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get claim statistics (admin)' })
  @ApiResponse({ status: 200, description: 'Claim statistics' })
  async getClaimStats() {
    return this.claimsService.getClaimStats();
  }

  @Get('claims/:claimId')
  @ApiOperation({ summary: 'Get claim details' })
  @ApiResponse({ status: 200, description: 'Claim retrieved' })
  async getClaim(
    @Param('claimId') claimId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.claimsService.getClaim(
      claimId,
      role === 'ADMIN' ? undefined : userId,
    );
  }

  @Put('claims/:claimId/review')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review a claim (admin only)' })
  @ApiResponse({ status: 200, description: 'Claim reviewed' })
  async reviewClaim(
    @Param('claimId') claimId: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ReviewClaimDto,
  ) {
    return this.claimsService.reviewClaim(claimId, adminId, dto);
  }

  @Put('claims/:claimId/payout')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process payout for approved claim (admin only)' })
  @ApiResponse({ status: 200, description: 'Payout processed' })
  async processClaimPayout(
    @Param('claimId') claimId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.claimsService.processPayout(claimId, adminId);
  }

  @Put('claims/:claimId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending claim' })
  @ApiResponse({ status: 200, description: 'Claim cancelled' })
  async cancelClaim(
    @Param('claimId') claimId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.claimsService.cancelClaim(claimId, userId);
  }
}
