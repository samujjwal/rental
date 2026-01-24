import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  FulfillmentService,
  CreateConditionReportDto,
  UpdateFulfillmentDto,
} from '../services/fulfillment.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';

@ApiTags('fulfillment')
@ApiBearerAuth()
@Controller('fulfillment')
@UseGuards(JwtAuthGuard)
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Post('condition-reports')
  @ApiOperation({ summary: 'Create condition report' })
  async createConditionReport(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConditionReportDto,
  ) {
    return this.fulfillmentService.createConditionReport(userId, dto);
  }

  @Get('bookings/:bookingId/condition-reports')
  @ApiOperation({ summary: 'Get booking condition reports' })
  async getBookingReports(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.fulfillmentService.getBookingReports(bookingId, userId);
  }

  @Get('condition-reports/:id')
  @ApiOperation({ summary: 'Get condition report' })
  async getReport(@Param('id') reportId: string, @CurrentUser('id') userId: string) {
    return this.fulfillmentService.getReport(reportId, userId);
  }

  @Patch('condition-reports/:id')
  @ApiOperation({ summary: 'Update condition report (within 24 hours)' })
  async updateReport(
    @Param('id') reportId: string,
    @CurrentUser('id') userId: string,
    @Body() updates: Partial<CreateConditionReportDto>,
  ) {
    return this.fulfillmentService.updateReport(reportId, userId, updates);
  }

  @Get('bookings/:bookingId')
  @ApiOperation({ summary: 'Get fulfillment details' })
  async getFulfillment(@Param('bookingId') bookingId: string, @CurrentUser('id') userId: string) {
    return this.fulfillmentService.getFulfillment(bookingId, userId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update fulfillment status' })
  async updateStatus(
    @Param('id') fulfillmentId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateFulfillmentDto,
  ) {
    return this.fulfillmentService.updateFulfillmentStatus(fulfillmentId, userId, dto);
  }

  @Post('bookings/:bookingId/damage-claim')
  @ApiOperation({ summary: 'Record damage claim' })
  async recordDamageClaim(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @Body()
    claim: {
      description: string;
      estimatedCost: number;
      photos: string[];
      reportId?: string;
    },
  ) {
    return this.fulfillmentService.recordDamageClaim(bookingId, userId, claim);
  }
}
