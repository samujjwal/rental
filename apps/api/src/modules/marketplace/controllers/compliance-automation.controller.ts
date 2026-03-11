import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { ComplianceAutomationService } from '../services/compliance-automation.service';
import { GenerateAuditTrailDto, RegulatoryReportQueryDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Compliance Automation')
@Controller('marketplace/compliance')
export class ComplianceAutomationController {
  constructor(private readonly compliance: ComplianceAutomationService) {}

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check user compliance status (KYC, documents) (admin only)' })
  @ApiResponse({ status: 200, description: 'User compliance status returned' })
  async checkUserCompliance(@Param('userId') userId: string) {
    return this.compliance.checkUserCompliance(userId);
  }

  @Get('listing/:listingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check listing compliance status' })
  @ApiResponse({ status: 200, description: 'Listing compliance status returned' })
  async checkListingCompliance(@Param('listingId') listingId: string) {
    return this.compliance.checkListingCompliance(listingId);
  }

  @Post('audit-trail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate an audit trail entry (admin only)' })
  @ApiResponse({ status: 201, description: 'Audit trail entry created' })
  async generateAuditTrail(@CurrentUser('id') performedBy: string, @Body() dto: GenerateAuditTrailDto) {
    return this.compliance.generateAuditTrail({ ...dto, performedBy });
  }

  @Get('audit-trail/:entityType/:entityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit trail for an entity' })
  @ApiResponse({ status: 200, description: 'Audit trail returned' })
  async getAuditTrail(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.compliance.getAuditTrail(entityType, entityId);
  }

  @Get('data-retention')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check data retention compliance status (GDPR)' })
  @ApiResponse({ status: 200, description: 'Data retention status returned' })
  async checkDataRetention() {
    return this.compliance.checkDataRetention();
  }

  @Post('regulatory-report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a regulatory report for a country and date range' })
  @ApiResponse({ status: 200, description: 'Regulatory report generated' })
  async generateReport(@Body() dto: RegulatoryReportQueryDto) {
    return this.compliance.generateRegulatoryReport(
      dto.country,
      new Date(dto.startDate),
      new Date(dto.endDate),
    );
  }
}
