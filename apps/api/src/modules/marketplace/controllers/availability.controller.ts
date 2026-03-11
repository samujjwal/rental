import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@/common/auth';
import { AvailabilityGraphService } from '../services/availability-graph.service';
import { AvailabilityCheckDto, BulkAvailabilityCheckDto, ReserveSlotDto, CalendarHeatmapQueryDto } from '../dto/marketplace.dto';

@ApiTags('Marketplace - Real-Time Availability')
@Controller('marketplace/availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityGraphService) {}

  @Post('check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check real-time availability for a listing (single)' })
  @ApiResponse({ status: 200, description: 'Availability status returned' })
  async checkAvailability(@Body() dto: AvailabilityCheckDto) {
    return this.availability.checkRealTimeAvailability(
      dto.listingId,
      new Date(dto.startDate),
      new Date(dto.endDate),
    );
  }

  @Post('check/bulk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk check availability for multiple listings' })
  @ApiResponse({ status: 200, description: 'Bulk availability map returned' })
  async bulkCheck(@Body() dto: BulkAvailabilityCheckDto) {
    const result = await this.availability.bulkCheckAvailability(
      dto.listingIds,
      new Date(dto.startDate),
      new Date(dto.endDate),
    );
    // Convert Map to plain object for JSON serialization
    return Object.fromEntries(result);
  }

  @Get('calendar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get calendar heatmap for a listing month' })
  @ApiResponse({ status: 200, description: 'Calendar heatmap returned' })
  async getCalendarHeatmap(@Query() query: CalendarHeatmapQueryDto) {
    return this.availability.getCalendarHeatmap(query.listingId, query.year, query.month);
  }

  @Post('reserve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reserve an availability slot (atomic locking)' })
  @ApiResponse({ status: 201, description: 'Slot reserved' })
  @ApiResponse({ status: 409, description: 'Slot already booked (concurrency conflict)' })
  async reserveSlot(@CurrentUser('id') userId: string, @Body() dto: ReserveSlotDto) {
    return this.availability.reserveSlot({
      ...dto,
      userId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    });
  }

  @Get('occupancy/:listingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get occupancy statistics for a listing' })
  @ApiResponse({ status: 200, description: 'Occupancy stats returned' })
  async getOccupancy(@Param('listingId') listingId: string, @Query('days') days?: number) {
    return this.availability.getOccupancyStats(listingId, days ?? 90);
  }
}
