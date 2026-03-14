import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DisputesService } from '../services/disputes.service';
import { DisputeEscalationService } from '../services/dispute-escalation.service';
import { CreateDisputeDto, UpdateDisputeDto, AddResponseDto, CloseDisputeDto } from '../dto/dispute.dto';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/common/auth';
import { DisputeStatus, UserRole } from '@rental-portal/database';

type AsyncMethodResult<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>;

@ApiTags('disputes')
@ApiBearerAuth()
@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(
    private readonly disputesService: DisputesService,
    private readonly escalationService: DisputeEscalationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a dispute' })
  async createDispute(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDisputeDto,
  ) {
    // Support alias fields: reason → type, requestedAmount → amount
    const resolvedType = dto.type || dto.reason;
    const resolvedAmount = dto.amount ?? dto.requestedAmount;
    const resolvedTitle = dto.title || dto.reason || dto.type || 'Dispute';
    const resolvedEvidence = dto.evidence?.map((e: any) =>
      typeof e === 'string' ? e : e.url,
    );
    const dispute = await this.disputesService.createDispute(userId, {
      ...dto,
      type: resolvedType as any,
      amount: resolvedAmount,
      title: resolvedTitle,
      evidence: resolvedEvidence,
    });
    // Return alias fields alongside canonical fields for backward compat
    return {
      ...dispute,
      reason: (dispute as any).type,
      requestedAmount: (dispute as any).amount !== null && (dispute as any).amount !== undefined
        ? Number((dispute as any).amount)
        : undefined,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get user disputes' })
  async getUserDisputes(
    @CurrentUser('id') userId: string,
    @Query('status') status?: DisputeStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.disputesService.getUserDisputes(userId, {
      status,
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Get('admin/all')
  @ApiOperation({ summary: 'Get all disputes (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, 'SUPER_ADMIN' as any, 'OPERATIONS_ADMIN' as any, 'SUPPORT_ADMIN' as any)
  async getAllDisputes(
    @CurrentUser('id') userId: string,
    @Query('status') status?: DisputeStatus,
    @Query('reason') reason?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.disputesService.getAllDisputes(userId, {
      status,
      reason,
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Get('admin/stats')
  @ApiOperation({ summary: 'Get dispute statistics (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, 'SUPER_ADMIN' as any, 'OPERATIONS_ADMIN' as any, 'SUPPORT_ADMIN' as any)
  async getStats(@CurrentUser('id') userId: string) {
    return this.disputesService.getDisputeStats(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get dispute details' })
  async getDispute(@Param('id') disputeId: string, @CurrentUser('id') userId: string) {
    return this.disputesService.getDispute(disputeId, userId);
  }

  @Post(':id/responses')
  @ApiOperation({ summary: 'Add response to dispute' })
  async addResponse(
    @Param('id') disputeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddResponseDto,
  ) {
    return this.disputesService.addResponse(disputeId, userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update dispute (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateDispute(
    @Param('id') disputeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDisputeDto,
  ): Promise<AsyncMethodResult<DisputesService['updateDispute']>> {
    return this.disputesService.updateDispute(disputeId, userId, dto);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close dispute (initiator or admin)' })
  async closeDispute(
    @Param('id') disputeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CloseDisputeDto,
  ): Promise<AsyncMethodResult<DisputesService['closeDispute']>> {
    return this.disputesService.closeDispute(disputeId, userId, dto.reason);
  }

  @Post(':id/escalate')
  @ApiOperation({ summary: 'Escalate a dispute to the next level' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, 'SUPER_ADMIN' as any, 'OPERATIONS_ADMIN' as any, 'SUPPORT_ADMIN' as any)
  async escalateDispute(
    @Param('id') disputeId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { reason: string },
  ) {
    return this.escalationService.escalateDispute(disputeId, body.reason, userId);
  }

  @Get(':id/escalations')
  @ApiOperation({ summary: 'Get escalation history for a dispute' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, 'SUPER_ADMIN' as any, 'OPERATIONS_ADMIN' as any, 'SUPPORT_ADMIN' as any)
  async getEscalationHistory(@Param('id') disputeId: string) {
    return this.escalationService.getEscalationHistory(disputeId);
  }

  @Post('admin/check-sla')
  @ApiOperation({ summary: 'Check and auto-escalate overdue disputes (admin)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, 'SUPER_ADMIN' as any, 'OPERATIONS_ADMIN' as any, 'SUPPORT_ADMIN' as any)
  async checkSlaEscalations(@CurrentUser('id') userId: string) {
    return this.escalationService.processAutoEscalations();
  }

  // ─── Evidence ──────────────────────────────────────────────────────────────

  @Post(':id/evidence')
  @ApiOperation({ summary: 'Add evidence to a dispute' })
  async addEvidence(
    @Param('id') disputeId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { type: string; url: string; description?: string },
  ) {
    return this.disputesService.addEvidence(disputeId, userId, body);
  }

  @Get(':id/evidence')
  @ApiOperation({ summary: 'List evidence for a dispute' })
  async listEvidence(@Param('id') disputeId: string) {
    return this.disputesService.listEvidence(disputeId);
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message in a dispute thread' })
  async sendMessage(
    @Param('id') disputeId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { content: string; type?: string },
  ) {
    return this.disputesService.sendMessage(disputeId, userId, body);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get messages for a dispute' })
  async getMessages(@Param('id') disputeId: string) {
    return this.disputesService.getMessages(disputeId);
  }

  // ─── Payout ────────────────────────────────────────────────────────────────

  @Post(':id/payout')
  @ApiOperation({ summary: 'Process payout for a resolved dispute' })
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, 'SUPER_ADMIN' as any)
  async processPayout(
    @Param('id') disputeId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { amount: number; currency: string; method?: string },
  ) {
    return this.disputesService.processDisputePayout(disputeId, userId, body);
  }
}
