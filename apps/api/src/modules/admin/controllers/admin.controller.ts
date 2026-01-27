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

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@CurrentUser('id') adminId: string, @Param('id') userId: string) {
    return this.adminService.getUserById(adminId, userId);
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

  @Get('organizations')
  @ApiOperation({ summary: 'Get all organizations' })
  async getAllOrganizations(
    @CurrentUser('id') userId: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAllOrganizations(userId, {
      search,
      status,
      plan,
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Get organization by ID' })
  async getOrganizationById(@CurrentUser('id') adminId: string, @Param('id') orgId: string) {
    return this.adminService.getOrganizationById(adminId, orgId);
  }

  @Get('organizations/:id/members')
  @ApiOperation({ summary: 'Get organization members' })
  async getOrganizationMembers(@CurrentUser('id') adminId: string, @Param('id') orgId: string) {
    return this.adminService.getOrganizationMembers(adminId, orgId);
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

  @Get('listings/:id')
  @ApiOperation({ summary: 'Get listing by ID' })
  async getListingById(@CurrentUser('id') adminId: string, @Param('id') listingId: string) {
    return this.adminService.getListingById(adminId, listingId);
  }

  @Get('listings/categories')
  @ApiOperation({ summary: 'Get all categories' })
  async getAllCategories(@CurrentUser('id') adminId: string) {
    return this.adminService.getAllCategories(adminId);
  }

  @Get('listings/pending')
  @ApiOperation({ summary: 'Get pending listings' })
  async getPendingListings(@CurrentUser('id') adminId: string) {
    return this.adminService.getPendingListings(adminId);
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

  @Get('bookings')
  @ApiOperation({ summary: 'Get all bookings' })
  async getAllBookings(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
    @Query('listingId') listingId?: string,
    @Query('renterId') renterId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAllBookings(userId, {
      status,
      listingId,
      renterId,
      ownerId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Get booking by ID' })
  async getBookingById(@CurrentUser('id') adminId: string, @Param('id') bookingId: string) {
    return this.adminService.getBookingById(adminId, bookingId);
  }

  @Get('bookings/calendar')
  @ApiOperation({ summary: 'Get booking calendar' })
  async getBookingCalendar(@CurrentUser('id') adminId: string, @Query('month') month?: string) {
    return this.adminService.getBookingCalendar(adminId, month);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get all payments' })
  async getAllPayments(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('minAmount') minAmount?: number,
    @Query('maxAmount') maxAmount?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAllPayments(userId, {
      status,
      method,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      minAmount,
      maxAmount,
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Get payment by ID' })
  async getPaymentById(@CurrentUser('id') adminId: string, @Param('id') paymentId: string) {
    return this.adminService.getPaymentById(adminId, paymentId);
  }

  @Get('payments/refunds')
  @ApiOperation({ summary: 'Get all refunds' })
  async getAllRefunds(@CurrentUser('id') adminId: string) {
    return this.adminService.getAllRefunds(adminId);
  }

  @Get('payments/payouts')
  @ApiOperation({ summary: 'Get all payouts' })
  async getAllPayouts(@CurrentUser('id') adminId: string) {
    return this.adminService.getAllPayouts(adminId);
  }

  @Get('payments/ledger')
  @ApiOperation({ summary: 'Get financial ledger' })
  async getFinancialLedger(
    @CurrentUser('id') adminId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getFinancialLedger(adminId, {
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Get('settings/general')
  @ApiOperation({ summary: 'Get general settings' })
  async getGeneralSettings(@CurrentUser('id') adminId: string) {
    return this.adminService.getGeneralSettings(adminId);
  }

  @Get('settings/api-keys')
  @ApiOperation({ summary: 'Get API keys' })
  async getApiKeys(@CurrentUser('id') adminId: string) {
    return this.adminService.getApiKeys(adminId);
  }

  @Get('settings/services')
  @ApiOperation({ summary: 'Get service configuration' })
  async getServiceConfig(@CurrentUser('id') adminId: string) {
    return this.adminService.getServiceConfig(adminId);
  }

  @Get('settings/environment')
  @ApiOperation({ summary: 'Get environment variables' })
  async getEnvironmentConfig(@CurrentUser('id') adminId: string) {
    return this.adminService.getEnvironmentConfig(adminId);
  }

  @Get('analytics/users')
  @ApiOperation({ summary: 'Get user analytics' })
  async getUserAnalytics(@CurrentUser('id') adminId: string, @Query('period') period?: string) {
    return this.adminService.getUserAnalytics(adminId, period);
  }

  @Get('analytics/business')
  @ApiOperation({ summary: 'Get business analytics' })
  async getBusinessAnalytics(@CurrentUser('id') adminId: string, @Query('period') period?: string) {
    return this.adminService.getBusinessAnalytics(adminId, period);
  }

  @Get('analytics/performance')
  @ApiOperation({ summary: 'Get performance analytics' })
  async getPerformanceAnalytics(
    @CurrentUser('id') adminId: string,
    @Query('period') period?: string,
  ) {
    return this.adminService.getPerformanceAnalytics(adminId, period);
  }

  @Get('analytics/reports')
  @ApiOperation({ summary: 'Get custom reports' })
  async getCustomReports(@CurrentUser('id') adminId: string) {
    return this.adminService.getCustomReports(adminId);
  }

  @Get('system/overview')
  @ApiOperation({ summary: 'Get system overview' })
  async getSystemOverview(@CurrentUser('id') adminId: string) {
    return this.adminService.getSystemOverview(adminId);
  }

  @Get('system/health')
  @ApiOperation({ summary: 'Get system health' })
  async getSystemHealth(@CurrentUser('id') adminId: string) {
    return this.adminService.getSystemHealth(adminId);
  }

  @Get('system/logs')
  @ApiOperation({ summary: 'Get system logs' })
  async getSystemLogs(
    @CurrentUser('id') adminId: string,
    @Query('level') level?: string,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getSystemLogs(adminId, level, limit);
  }

  @Get('system/audit')
  @ApiOperation({ summary: 'Get audit logs' })
  async getAuditLogs(
    @CurrentUser('id') adminId: string,
    @Query('action') action?: string,
    @Query('userId') targetUserId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAuditLogs(adminId, {
      action,
      userId: targetUserId,
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Get('system/database')
  @ApiOperation({ summary: 'Get database information' })
  async getDatabaseInfo(@CurrentUser('id') adminId: string) {
    return this.adminService.getDatabaseInfo(adminId);
  }

  @Get('system/backups')
  @ApiOperation({ summary: 'Get backup information' })
  async getBackupInfo(@CurrentUser('id') adminId: string) {
    return this.adminService.getBackupInfo(adminId);
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
}
