import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from '../services/admin.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { UserRole, ListingStatus } from '@rental-portal/database';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboard(@CurrentUser('id') userId: string) {
    return this.adminService.getDashboardStats(userId);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get analytics data' })
  async getAnalytics(
    @CurrentUser('id') userId: string,
    @Query('period') period?: 'day' | 'week' | 'month' | 'year',
  ) {
    return this.adminService.getAnalytics(userId, period);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  async getAllUsers(
    @CurrentUser('id') userId: string,
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAllUsers(userId, {
      role,
      search,
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  async updateUserRole(
    @CurrentUser('id') adminId: string,
    @Param('id') userId: string,
    @Body() body: { role: UserRole },
  ) {
    return this.adminService.updateUserRole(adminId, userId, body.role);
  }

  @Post('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend user' })
  async suspendUser(@CurrentUser('id') adminId: string, @Param('id') userId: string) {
    return this.adminService.toggleUserStatus(adminId, userId, true);
  }

  @Post('users/:id/activate')
  @ApiOperation({ summary: 'Activate user' })
  async activateUser(@CurrentUser('id') adminId: string, @Param('id') userId: string) {
    return this.adminService.toggleUserStatus(adminId, userId, false);
  }

  @Get('listings')
  @ApiOperation({ summary: 'Get all listings' })
  async getAllListings(
    @CurrentUser('id') userId: string,
    @Query('status') status?: ListingStatus,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAllListings(userId, {
      status,
      categoryId,
      search,
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Patch('listings/:id/status')
  @ApiOperation({ summary: 'Update listing status' })
  async updateListingStatus(
    @CurrentUser('id') adminId: string,
    @Param('id') listingId: string,
    @Body() body: { status: ListingStatus; reason?: string },
  ) {
    return this.adminService.updateListingStatus(adminId, listingId, body.status, body.reason);
  }

  @Delete('listings/:id')
  @ApiOperation({ summary: 'Delete listing' })
  async deleteListing(@CurrentUser('id') adminId: string, @Param('id') listingId: string) {
    await this.adminService.deleteListing(adminId, listingId);
    return { message: 'Listing deleted successfully' };
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue report' })
  async getRevenueReport(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.adminService.getRevenueReport(userId, new Date(startDate), new Date(endDate));
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs' })
  async getAuditLogs(
    @CurrentUser('id') userId: string,
    @Query('action') action?: string,
    @Query('targetUserId') targetUserId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAuditLogs(userId, {
      action,
      targetUserId,
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }
}
