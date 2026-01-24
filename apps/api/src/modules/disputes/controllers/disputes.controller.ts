import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DisputesService, CreateDisputeDto, UpdateDisputeDto } from '../services/disputes.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { DisputeStatus, UserRole } from '@prisma/client';

@ApiTags('disputes')
@ApiBearerAuth()
@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a dispute' })
  async createDispute(@CurrentUser('sub') userId: string, @Body() dto: CreateDisputeDto) {
    return this.disputesService.createDispute(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user disputes' })
  async getUserDisputes(
    @CurrentUser('sub') userId: string,
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
  @Roles(UserRole.ADMIN)
  async getAllDisputes(
    @CurrentUser('sub') userId: string,
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
  @Roles(UserRole.ADMIN)
  async getStats(@CurrentUser('sub') userId: string) {
    return this.disputesService.getDisputeStats(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get dispute details' })
  async getDispute(@Param('id') disputeId: string, @CurrentUser('sub') userId: string) {
    return this.disputesService.getDispute(disputeId, userId);
  }

  @Post(':id/responses')
  @ApiOperation({ summary: 'Add response to dispute' })
  async addResponse(
    @Param('id') disputeId: string,
    @CurrentUser('sub') userId: string,
    @Body() response: { message: string; evidence?: string[] },
  ) {
    return this.disputesService.addResponse(disputeId, userId, response);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update dispute (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateDispute(
    @Param('id') disputeId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateDisputeDto,
  ) {
    return this.disputesService.updateDispute(disputeId, userId, dto);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Close dispute' })
  async closeDispute(
    @Param('id') disputeId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { reason: string },
  ) {
    return this.disputesService.closeDispute(disputeId, userId, body.reason);
  }
}
