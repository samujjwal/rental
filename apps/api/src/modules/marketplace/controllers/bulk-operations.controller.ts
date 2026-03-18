/**
 * Owner Bulk Operations API
 * 
 * Enables owners to perform bulk actions on their listings,
 * bookings, and other resources for improved efficiency.
 */

import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/common/auth';
import { UserRole } from '@rental-portal/database';
import {
  BulkArchiveListingsDto,
  BulkOperationResult,
  BulkRespondToBookingsDto,
  BulkUpdateAvailabilityDto,
  BulkUpdateListingsDto,
} from '../dto/bulk-operations.dto';
import { BulkOperationsService } from '../services/bulk-operations.service';

@ApiTags('Owner Bulk Operations')
@Controller('owner/bulk')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.HOST, UserRole.ADMIN)
@ApiBearerAuth()
export class BulkOperationsController {
  constructor(private readonly bulkService: BulkOperationsService) {}

  @Post('listings/update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk update multiple listings' })
  @ApiResponse({ status: 200, description: 'Listings updated' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 403, description: 'Not authorized for some listings' })
  async bulkUpdateListings(
    @CurrentUser('id') userId: string,
    @Body() dto: BulkUpdateListingsDto,
  ): Promise<BulkOperationResult> {
    return this.bulkService.bulkUpdateListings(userId, dto);
  }

  @Post('availability/update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk update availability for multiple listings' })
  @ApiResponse({ status: 200, description: 'Availability updated' })
  async bulkUpdateAvailability(
    @CurrentUser('id') userId: string,
    @Body() dto: BulkUpdateAvailabilityDto,
  ): Promise<BulkOperationResult> {
    return this.bulkService.bulkUpdateAvailability(userId, dto);
  }

  @Post('bookings/respond')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk respond to booking requests' })
  @ApiResponse({ status: 200, description: 'Responses processed' })
  async bulkRespondToBookings(
    @CurrentUser('id') userId: string,
    @Body() dto: BulkRespondToBookingsDto,
  ): Promise<BulkOperationResult> {
    return this.bulkService.bulkRespondToBookings(userId, dto);
  }

  @Post('listings/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk archive multiple listings' })
  @ApiResponse({ status: 200, description: 'Listings archived' })
  async bulkArchiveListings(
    @CurrentUser('id') userId: string,
    @Body() dto: BulkArchiveListingsDto,
  ): Promise<BulkOperationResult> {
    return this.bulkService.bulkArchiveListings(userId, dto);
  }

  @Post('listings/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export listing data to CSV/Excel' })
  @ApiResponse({ status: 200, description: 'Export generated' })
  async exportListings(
    @CurrentUser('id') userId: string,
    @Body() filters: { status?: string; dateFrom?: string; dateTo?: string },
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    return this.bulkService.exportListings(userId, filters);
  }
}
