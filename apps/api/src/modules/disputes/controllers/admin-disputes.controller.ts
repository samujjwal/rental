import { Controller, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DisputesService } from '../services/disputes.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/common/auth';
import { UserRole } from '@rental-portal/database';

@ApiTags('admin-disputes')
@ApiBearerAuth()
@Controller('admin/disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, 'SUPER_ADMIN' as any, 'OPERATIONS_ADMIN' as any, 'SUPPORT_ADMIN' as any)
export class AdminDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign a dispute to an admin' })
  async assignDispute(
    @Param('id') disputeId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { adminId?: string },
  ) {
    return this.disputesService.assignDispute(disputeId, body.adminId ?? userId);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve a dispute' })
  async resolveDispute(
    @Param('id') disputeId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { decision: string; refundAmount?: number; reason?: string; notes?: string },
  ) {
    return this.disputesService.resolveDisputeAdmin(disputeId, userId, body);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject / dismiss a dispute' })
  async rejectDispute(
    @Param('id') disputeId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { reason?: string; notes?: string },
  ) {
    return this.disputesService.rejectDispute(disputeId, userId, body);
  }
}
