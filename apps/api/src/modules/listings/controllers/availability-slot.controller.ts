import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { AvailabilitySlotService } from '../services/availability-slot.service';
import {
  CreateAvailabilitySlotDto,
  UpdateAvailabilitySlotDto,
  BulkCreateSlotsDto,
  AvailabilityQuery,
} from '../services/availability-slot.service';

@ApiTags('Availability Slots')
@Controller('listings/:listingId/availability-slots')
export class AvailabilitySlotController {
  constructor(private readonly slotService: AvailabilitySlotService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOST', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an availability slot for a listing' })
  @ApiResponse({ status: 201, description: 'Availability slot created' })
  async create(
    @Param('listingId') listingId: string,
    @Body() dto: Omit<CreateAvailabilitySlotDto, 'listingId'>,
  ) {
    return this.slotService.create({ ...dto, listingId });
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOST', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk create availability slots for a listing' })
  @ApiResponse({ status: 201, description: 'Availability slots created' })
  async bulkCreate(
    @Param('listingId') listingId: string,
    @Body() dto: Omit<BulkCreateSlotsDto, 'listingId'>,
  ) {
    return this.slotService.bulkCreate({ ...dto, listingId });
  }

  @Get()
  @ApiOperation({ summary: 'Query available slots for a listing' })
  @ApiQuery({ name: 'inventoryUnitId', required: false, type: String })
  @ApiQuery({ name: 'startTime', required: true, type: String })
  @ApiQuery({ name: 'endTime', required: true, type: String })
  @ApiQuery({ name: 'status', required: false, type: [String] })
  @ApiResponse({ status: 200, description: 'Available slots retrieved' })
  async findAvailable(
    @Param('listingId') listingId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Query('inventoryUnitId') inventoryUnitId?: string,
    @Query('status') status?: string[],
  ) {
    const query: AvailabilityQuery = {
      listingId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    };
    if (inventoryUnitId) query.inventoryUnitId = inventoryUnitId;
    if (status) query.status = status;
    return this.slotService.findAvailable(query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOST', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an availability slot' })
  @ApiResponse({ status: 200, description: 'Availability slot updated' })
  async update(@Param('id') id: string, @Body() dto: UpdateAvailabilitySlotDto) {
    return this.slotService.update(id, dto);
  }

  @Post(':id/reserve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reserve a slot during checkout flow' })
  @ApiResponse({ status: 200, description: 'Slot reserved' })
  async reserve(
    @Param('id') id: string,
    @Body('bookingId') bookingId: string,
  ) {
    return this.slotService.reserve(id, bookingId);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a reservation as booked' })
  @ApiResponse({ status: 200, description: 'Reservation confirmed' })
  async confirmReservation(@Param('id') id: string) {
    return this.slotService.confirmReservation(id);
  }

  @Post(':id/release')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Release a reservation back to available' })
  @ApiResponse({ status: 200, description: 'Reservation released' })
  async releaseReservation(@Param('id') id: string) {
    return this.slotService.releaseReservation(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOST', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an availability slot' })
  @ApiResponse({ status: 200, description: 'Availability slot deleted' })
  async delete(@Param('id') id: string) {
    return this.slotService.delete(id);
  }
}
