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
  BadRequestException,
} from '@nestjs/common';
import { i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from '../services/admin.service';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { AdminUsersService } from '../services/admin-users.service';
import { AdminSystemService } from '../services/admin-system.service';
import { AdminContentService } from '../services/admin-content.service';
import { AdminEntityService } from '../services/admin-entity.service';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/common/auth';
import { UserRole, ListingStatus, OrganizationStatus, DisputeStatus, BookingStatus } from '@rental-portal/database';
import { UpdateUserRoleDto } from '../dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATIONS_ADMIN, UserRole.FINANCE_ADMIN, UserRole.SUPPORT_ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly analyticsService: AdminAnalyticsService,
    private readonly usersService: AdminUsersService,
    private readonly systemService: AdminSystemService,
    private readonly contentService: AdminContentService,
    private readonly entityService: AdminEntityService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboard(@CurrentUser('id') userId: string) {
    return this.analyticsService.getDashboardStats(userId);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get analytics data' })
  async getAnalytics(
    @CurrentUser('id') userId: string,
    @Query('period') period?: 'day' | 'week' | 'month' | 'year',
  ) {
    return this.analyticsService.getAnalytics(userId, period);
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
    return this.usersService.getAllUsers(userId, {
      role,
      search,
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@CurrentUser('id') adminId: string, @Param('id') userId: string) {
    return this.usersService.getUserById(adminId, userId);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  async updateUserRole(
    @CurrentUser('id') adminId: string,
    @Param('id') userId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateUserRole(adminId, userId, dto.role);
  }

  @Post('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend user' })
  async suspendUser(@CurrentUser('id') adminId: string, @Param('id') userId: string) {
    return this.usersService.toggleUserStatus(adminId, userId, true);
  }

  @Post('users/:id/activate')
  @ApiOperation({ summary: 'Activate user' })
  async activateUser(@CurrentUser('id') adminId: string, @Param('id') userId: string) {
    return this.usersService.toggleUserStatus(adminId, userId, false);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'Get all organizations' })
  async getAllOrganizations(
    @CurrentUser('id') userId: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAllOrganizations(userId, {
      search,
      status,
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

  @Patch('organizations/:id/status')
  @ApiOperation({ summary: 'Update organization status' })
  async updateOrganizationStatus(
    @CurrentUser('id') adminId: string,
    @Param('id') orgId: string,
    @Body('status') status: string,
  ) {
    if (!status || typeof status !== 'string') {
      throw i18nBadRequest('validation.statusRequired');
    }
    if (!Object.values(OrganizationStatus).includes(status as OrganizationStatus)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${Object.values(OrganizationStatus).join(', ')}`);
    }
    return this.adminService.updateOrganizationStatus(adminId, orgId, status as OrganizationStatus);
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

  @Get('listings/categories')
  @ApiOperation({ summary: 'Get all categories' })
  async getAllCategories(@CurrentUser('id') adminId: string) {
    return this.adminService.getAllCategories(adminId);
  }

  @Get('listings/pending')
  @ApiOperation({ summary: 'Get listings pending admin approval' })
  async getPendingListings(@CurrentUser('id') adminId: string) {
    return this.adminService.getPendingListings(adminId);
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Get listing by ID' })
  async getListingById(@CurrentUser('id') adminId: string, @Param('id') listingId: string) {
    return this.adminService.getListingById(adminId, listingId);
  }

  @Post('listings/:id/approve')
  @ApiOperation({ summary: 'Approve a listing — makes it AVAILABLE and bookable' })
  async approveListing(@CurrentUser('id') adminId: string, @Param('id') listingId: string) {
    return this.adminService.approveListing(adminId, listingId);
  }

  @Post('listings/:id/reject')
  @ApiOperation({ summary: 'Reject a listing — resets it to DRAFT so the owner can fix it' })
  async rejectListing(
    @CurrentUser('id') adminId: string,
    @Param('id') listingId: string,
    @Body() body: { reason?: string },
  ) {
    return this.adminService.rejectListing(adminId, listingId, body?.reason);
  }

  @Patch('listings/:id/status')
  @ApiOperation({ summary: 'Update listing status (generic override)' })
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

  @Patch('bookings/:id/status')
  @ApiOperation({
    summary: 'Force-set booking status (admin override)',
    description:
      'Directly sets booking status, bypassing the state machine and Stripe. ' +
      'Intended for admin intervention and E2E test environments.',
  })
  async updateBookingStatus(
    @CurrentUser('id') adminId: string,
    @Param('id') bookingId: string,
    @Body('status') status: string,
  ) {
    if (!status || typeof status !== 'string') {
      throw i18nBadRequest('validation.statusRequired');
    }
    if (!Object.values(BookingStatus).includes(status as BookingStatus)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${Object.values(BookingStatus).join(', ')}`,
      );
    }
    return this.adminService.forceSetBookingStatus(adminId, bookingId, status);
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
  async getAllRefunds(
    @CurrentUser('id') adminId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.getAllRefunds(adminId);
  }

  @Get('payments/payouts')
  @ApiOperation({ summary: 'Get all payouts' })
  async getAllPayouts(
    @CurrentUser('id') adminId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
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
    return this.systemService.getGeneralSettings(adminId);
  }

  @Get('settings/api-keys')
  @ApiOperation({ summary: 'Get API keys' })
  async getApiKeys(@CurrentUser('id') adminId: string) {
    return this.systemService.getApiKeys(adminId);
  }

  @Get('settings/services')
  @ApiOperation({ summary: 'Get service configuration' })
  async getServiceConfig(@CurrentUser('id') adminId: string) {
    return this.systemService.getServiceConfig(adminId);
  }

  @Get('settings/environment')
  @ApiOperation({ summary: 'Get environment variables' })
  async getEnvironmentConfig(@CurrentUser('id') adminId: string) {
    return this.systemService.getEnvironmentConfig(adminId);
  }

  @Get('analytics/users')
  @ApiOperation({ summary: 'Get user analytics' })
  async getUserAnalytics(@CurrentUser('id') adminId: string, @Query('period') period?: string) {
    return this.analyticsService.getUserAnalytics(adminId, period);
  }

  @Get('analytics/business')
  @ApiOperation({ summary: 'Get business analytics' })
  async getBusinessAnalytics(@CurrentUser('id') adminId: string, @Query('period') period?: string) {
    return this.analyticsService.getBusinessAnalytics(adminId, period);
  }

  @Get('analytics/performance')
  @ApiOperation({ summary: 'Get performance analytics' })
  async getPerformanceAnalytics(
    @CurrentUser('id') adminId: string,
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getPerformanceAnalytics(adminId, period);
  }

  @Get('analytics/reports')
  @ApiOperation({ summary: 'Get custom reports' })
  async getCustomReports(@CurrentUser('id') adminId: string) {
    return this.analyticsService.getCustomReports(adminId);
  }

  @Get('system/overview')
  @ApiOperation({ summary: 'Get system overview' })
  async getSystemOverview(@CurrentUser('id') adminId: string) {
    return this.systemService.getSystemOverview(adminId);
  }

  @Get('system/health')
  @ApiOperation({ summary: 'Get system health' })
  async getSystemHealth(@CurrentUser('id') adminId: string) {
    return this.systemService.getSystemHealth(adminId);
  }

  @Get('system/logs')
  @ApiOperation({ summary: 'Get system logs' })
  async getSystemLogs(
    @CurrentUser('id') adminId: string,
    @Query('level') level?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
  ) {
    return this.systemService.getSystemLogs(adminId, level, limit, search);
  }

  @Get('system/audit')
  @ApiOperation({ summary: 'Get audit logs' })
  async getAuditLogs(
    @CurrentUser('id') adminId: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('userId') targetUserId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAuditLogs(adminId, {
      action,
      entity,
      userId: targetUserId,
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  @Get('system/database')
  @ApiOperation({ summary: 'Get database information' })
  async getDatabaseInfo(@CurrentUser('id') adminId: string) {
    return this.systemService.getDatabaseInfo(adminId);
  }

  @Get('system/backups')
  @ApiOperation({ summary: 'Get backup information' })
  async getBackupInfo(@CurrentUser('id') adminId: string) {
    return this.systemService.getBackupInfo(adminId);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue report' })
  async getRevenueReport(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getRevenueReport(userId, new Date(startDate), new Date(endDate));
  }

  // ==================== CONTENT MANAGEMENT ====================

  @Get('reviews')
  @ApiOperation({ summary: 'Get all reviews' })
  async getReviews(
    @CurrentUser('id') adminId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.contentService.getReviews(adminId, {
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
      status,
      search,
    });
  }

  @Patch('reviews/:id/status')
  @ApiOperation({ summary: 'Update review status' })
  async updateReviewStatus(
    @CurrentUser('id') adminId: string,
    @Param('id') reviewId: string,
    @Body() body: { status: string },
  ) {
    return this.contentService.updateReviewStatus(adminId, reviewId, body.status);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Get all messages/conversations' })
  async getMessages(
    @CurrentUser('id') adminId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.contentService.getMessages(adminId, {
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
    });
  }

  // ==================== DISPUTES ====================

  @Get('disputes')
  @ApiOperation({ summary: 'Get disputes' })
  async getDisputes(
    @CurrentUser('id') adminId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.contentService.getDisputes(adminId, {
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
      status,
    });
  }
  @Patch('disputes/:id/status')
  @ApiOperation({ summary: 'Update dispute status' })
  async updateDisputeStatus(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    if (!status || typeof status !== 'string') {
      throw i18nBadRequest('validation.statusRequired');
    }
    if (!Object.values(DisputeStatus).includes(status as DisputeStatus)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${Object.values(DisputeStatus).join(', ')}`);
    }
    return this.contentService.updateDisputeStatus(adminId, id, status as DisputeStatus);
  }

  @Patch('refunds/:id/status')
  @ApiOperation({ summary: 'Update refund status' })
  async updateRefundStatus(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    if (!status || typeof status !== 'string') {
      throw i18nBadRequest('validation.statusRequired');
    }
    return this.contentService.updateRefundStatus(adminId, id, status as any);
  }
  // ==================== SCHEMA ENDPOINTS FOR DYNAMIC ADMIN UI ====================

  @Get('schema/:entity')
  @ApiOperation({ summary: 'Get entity schema for dynamic admin UI' })
  async getEntitySchema(@CurrentUser('id') adminId: string, @Param('entity') entity: string) {
    return this.entityService.getEntitySchema(adminId, entity);
  }

  @Get(':entity')
  @ApiOperation({ summary: 'Get entity data with pagination, filtering, and sorting' })
  async getEntityData(
    @CurrentUser('id') adminId: string,
    @Param('entity') entity: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('filters') filters?: string,
  ) {
    // Parse filters from JSON string if provided
    let parsedFilters: any[] | undefined;
    if (filters) {
      try {
        parsedFilters = JSON.parse(filters);
      } catch (error) {
        throw i18nBadRequest('admin.invalidFiltersFormat');
      }
    }

    return this.entityService.getEntityData(adminId, entity, {
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
      search,
      sortBy,
      sortOrder,
      filters: parsedFilters,
    });
  }
}
