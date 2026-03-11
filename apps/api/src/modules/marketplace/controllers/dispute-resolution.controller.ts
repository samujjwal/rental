import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, RolesGuard, Roles } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import { DisputeResolutionService } from '../services/dispute-resolution.service';
import { FileDisputeDto, SubmitEvidenceDto, ResolveDisputeDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Dispute Resolution')
@Controller('marketplace/disputes')
export class DisputeResolutionController {
  constructor(private readonly disputes: DisputeResolutionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'File a new dispute against a booking' })
  @ApiResponse({ status: 201, description: 'Dispute filed' })
  async fileDispute(@CurrentUser('id') userId: string, @Body() dto: FileDisputeDto) {
    return this.disputes.fileDispute({ ...dto, claimantId: userId });
  }

  @Post(':disputeId/evidence')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit additional evidence for a dispute' })
  @ApiResponse({ status: 200, description: 'Evidence submitted' })
  async submitEvidence(
    @Param('disputeId') disputeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitEvidenceDto,
  ) {
    return this.disputes.submitEvidence(disputeId, userId, dto);
  }

  @Get(':disputeId/analysis')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AI-powered dispute analysis and recommendation' })
  @ApiResponse({ status: 200, description: 'Analysis generated' })
  async analyzeDispute(@Param('disputeId') disputeId: string) {
    return this.disputes.analyzeDispute(disputeId);
  }

  @Patch(':disputeId/mediation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign a mediator and start mediation' })
  @ApiResponse({ status: 200, description: 'Mediation started' })
  async startMediation(@Param('disputeId') disputeId: string, @CurrentUser('id') mediatorId: string) {
    return this.disputes.startMediation(disputeId, mediatorId);
  }

  @Patch(':disputeId/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue a binding resolution for a dispute' })
  @ApiResponse({ status: 200, description: 'Dispute resolved' })
  async resolve(
    @Param('disputeId') disputeId: string,
    @CurrentUser('id') resolvedBy: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputes.resolve(disputeId, { ...dto, resolvedBy });
  }

  @Get('sla')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get disputes with SLA tracking metadata' })
  @ApiResponse({ status: 200, description: 'Disputes with SLA data returned' })
  async getWithSla(@Query('status') status?: string, @Query('limit') limit?: number) {
    return this.disputes.getDisputesWithSla(status, limit ?? 50);
  }
}
