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
import { InventoryUnitService } from '../services/inventory-unit.service';
import {
  CreateInventoryUnitDto,
  UpdateInventoryUnitDto,
  ReserveInventoryUnitDto,
} from '../services/inventory-unit.service';

@ApiTags('Inventory Units')
@Controller('listings/:listingId/inventory-units')
export class InventoryUnitController {
  constructor(private readonly inventoryUnitService: InventoryUnitService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOST', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an inventory unit for a listing' })
  @ApiResponse({ status: 201, description: 'Inventory unit created' })
  async create(
    @Param('listingId') listingId: string,
    @Body() dto: Omit<CreateInventoryUnitDto, 'listingId'>,
  ) {
    return this.inventoryUnitService.create({ ...dto, listingId });
  }

  @Get()
  @ApiOperation({ summary: 'Get all inventory units for a listing' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Inventory units retrieved' })
  async findByListing(
    @Param('listingId') listingId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.inventoryUnitService.findByListing(
      listingId,
      includeInactive === 'true',
    );
  }

  @Get('available')
  @ApiOperation({ summary: 'Get available inventory units for a listing within a time range' })
  @ApiQuery({ name: 'startTime', required: true, type: String })
  @ApiQuery({ name: 'endTime', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Available inventory units retrieved' })
  async getAvailableUnits(
    @Param('listingId') listingId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    return this.inventoryUnitService.getAvailableUnits(
      listingId,
      new Date(startTime),
      new Date(endTime),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single inventory unit by ID' })
  @ApiResponse({ status: 200, description: 'Inventory unit retrieved' })
  async findById(@Param('id') id: string) {
    return this.inventoryUnitService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOST', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an inventory unit' })
  @ApiResponse({ status: 200, description: 'Inventory unit updated' })
  async update(@Param('id') id: string, @Body() dto: UpdateInventoryUnitDto) {
    return this.inventoryUnitService.update(id, dto);
  }

  @Post(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOST', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate an inventory unit' })
  @ApiResponse({ status: 200, description: 'Inventory unit deactivated' })
  async deactivate(@Param('id') id: string) {
    return this.inventoryUnitService.deactivate(id);
  }

  @Post(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOST', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate an inventory unit' })
  @ApiResponse({ status: 200, description: 'Inventory unit activated' })
  async activate(@Param('id') id: string) {
    return this.inventoryUnitService.activate(id);
  }

  @Post(':id/reserve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reserve an inventory unit for a booking' })
  @ApiResponse({ status: 200, description: 'Inventory unit reserved' })
  async reserveUnit(
    @Param('listingId') listingId: string,
    @Param('id') inventoryUnitId: string,
    @Body() dto: Omit<ReserveInventoryUnitDto, 'listingId' | 'inventoryUnitId'>,
  ) {
    return this.inventoryUnitService.reserveUnit({
      ...dto,
      listingId,
      inventoryUnitId,
    });
  }

  @Post(':id/release')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Release a reservation for an inventory unit' })
  @ApiResponse({ status: 200, description: 'Reservation released' })
  async releaseUnit(
    @Param('id') inventoryUnitId: string,
    @Body('bookingId') bookingId: string,
  ) {
    return this.inventoryUnitService.releaseUnit(inventoryUnitId, bookingId);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a reservation as booked' })
  @ApiResponse({ status: 200, description: 'Reservation confirmed' })
  async confirmBooking(
    @Param('id') inventoryUnitId: string,
    @Body('bookingId') bookingId: string,
  ) {
    return this.inventoryUnitService.confirmBooking(inventoryUnitId, bookingId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HOST', 'ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an inventory unit' })
  @ApiResponse({ status: 200, description: 'Inventory unit deleted' })
  async delete(@Param('id') id: string) {
    return this.inventoryUnitService.delete(id);
  }
}
