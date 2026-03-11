import { AdminController } from './admin.controller';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: any;
  let analyticsService: any;
  let usersService: any;
  let systemService: any;
  let contentService: any;
  let entityService: any;

  beforeEach(() => {
    adminService = {
      getAllListings: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
      getListingById: jest.fn().mockResolvedValue({ id: 'l-1' }),
      deleteListing: jest.fn().mockResolvedValue({ message: 'Deleted' }),
      getAllBookings: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
      getBookingById: jest.fn().mockResolvedValue({ id: 'b-1' }),
      forceSetBookingStatus: jest.fn().mockResolvedValue({ id: 'b-1', status: 'CONFIRMED', _adminOverride: true }),
    };

    analyticsService = {
      getDashboardStats: jest.fn().mockResolvedValue({ users: { total: 100 } }),
      getAnalytics: jest.fn().mockResolvedValue({ growth: { newUsers: 10 } }),
      getUserAnalytics: jest.fn().mockResolvedValue({ activeUsers: 50 }),
      getBusinessAnalytics: jest.fn().mockResolvedValue({ bookings: 30 }),
      getPerformanceAnalytics: jest.fn().mockResolvedValue({ responseTime: 45 }),
      getCustomReports: jest.fn().mockResolvedValue([]),
      getRevenueReport: jest.fn().mockResolvedValue({ revenue: 50000 }),
    };

    usersService = {
      getAllUsers: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
      getUserById: jest.fn().mockResolvedValue({ id: 'user-1' }),
      updateUserRole: jest.fn().mockResolvedValue({ id: 'user-1', role: 'ADMIN' }),
      suspendUser: jest.fn().mockResolvedValue({ suspended: true }),
      activateUser: jest.fn().mockResolvedValue({ activated: true }),
      toggleUserStatus: jest.fn().mockResolvedValue({ id: 'user-1', status: 'SUSPENDED' }),
      getAllOrganizations: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
      getOrganizationById: jest.fn().mockResolvedValue({ id: 'org-1' }),
      getOrganizationMembers: jest.fn().mockResolvedValue([]),
      updateOrganizationStatus: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
      getAllCategories: jest.fn().mockResolvedValue([]),
      getPendingListings: jest.fn().mockResolvedValue([]),
      updateListingStatus: jest.fn().mockResolvedValue({ status: 'ACTIVE' }),
      getBookingCalendar: jest.fn().mockResolvedValue([]),
      getAllPayments: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
      getPaymentById: jest.fn().mockResolvedValue({ id: 'p-1' }),
      getAuditLogs: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
    };

    systemService = {
      getGeneralSettings: jest.fn().mockResolvedValue({ appName: 'GharBatai' }),
      getApiKeys: jest.fn().mockResolvedValue({}),
      getServiceConfig: jest.fn().mockResolvedValue({}),
      getEnvironmentConfig: jest.fn().mockResolvedValue({}),
      getSystemOverview: jest.fn().mockResolvedValue({ version: '1.0' }),
      getSystemHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
      getSystemLogs: jest.fn().mockResolvedValue([]),
      getDatabaseInfo: jest.fn().mockResolvedValue({ size: '100MB' }),
      getBackupInfo: jest.fn().mockResolvedValue({ lastBackup: new Date() }),
    };

    contentService = {
      getReviews: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
      updateReviewStatus: jest.fn().mockResolvedValue({ status: 'APPROVED' }),
      getMessages: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
      getDisputes: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
      updateDisputeStatus: jest.fn().mockResolvedValue({ status: 'RESOLVED' }),
      updateRefundStatus: jest.fn().mockResolvedValue({ status: 'APPROVED' }),
      getRefunds: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
      getPayouts: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
      getLedger: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
    };

    entityService = {
      getEntitySchema: jest.fn().mockResolvedValue({ fields: [] }),
      getEntityData: jest.fn().mockResolvedValue({ data: [] as any[], total: 0 }),
    };

    controller = new AdminController(
      adminService,
      analyticsService,
      usersService,
      systemService,
      contentService,
      entityService,
    );
  });

  describe('getDashboard', () => {
    it('should return dashboard stats', async () => {
      const result = await controller.getDashboard('admin-1');

      expect(result).toBeDefined();
      expect(analyticsService.getDashboardStats).toHaveBeenCalledWith('admin-1');
    });
  });

  describe('getAnalytics', () => {
    it('should return analytics with default period', async () => {
      await controller.getAnalytics('admin-1');

      expect(analyticsService.getAnalytics).toHaveBeenCalled();
    });

    it('should pass period parameter', async () => {
      await controller.getAnalytics('admin-1', 'month' as any);

      expect(analyticsService.getAnalytics).toHaveBeenCalled();
    });
  });

  describe('getAllUsers', () => {
    it('should delegate to users service', async () => {
      const result = await controller.getAllUsers('admin-1');

      expect(result).toBeDefined();
      expect(usersService.getAllUsers).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const result = await controller.getUserById('admin-1', 'user-1');

      expect(result).toBeDefined();
      expect(usersService.getUserById).toHaveBeenCalled();
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      const result = await controller.updateUserRole('admin-1', 'user-1', { role: 'ADMIN' as any });

      expect(result).toBeDefined();
      expect(usersService.updateUserRole).toHaveBeenCalled();
    });
  });

  describe('suspendUser', () => {
    it('should suspend user', async () => {
      const result = await controller.suspendUser('admin-1', 'user-1');

      expect(result).toBeDefined();
    });
  });

  describe('activateUser', () => {
    it('should activate user', async () => {
      const result = await controller.activateUser('admin-1', 'user-1');

      expect(result).toBeDefined();
    });
  });

  describe('getAllListings', () => {
    it('should return all listings', async () => {
      const result = await controller.getAllListings('admin-1');

      expect(result).toBeDefined();
      expect(adminService.getAllListings).toHaveBeenCalled();
    });
  });

  describe('deleteListing', () => {
    it('should delete listing', async () => {
      const result = await controller.deleteListing('admin-1', 'l-1');

      expect(result).toBeDefined();
    });
  });

  describe('getAllBookings', () => {
    it('should return all bookings', async () => {
      const result = await controller.getAllBookings('admin-1');

      expect(result).toBeDefined();
    });
  });

  describe('updateBookingStatus (admin force-set)', () => {
    it('should call forceSetBookingStatus with valid status', async () => {
      const result = await controller.updateBookingStatus('admin-1', 'b-1', 'CONFIRMED');

      expect(result).toBeDefined();
      expect(result._adminOverride).toBe(true);
      expect(adminService.forceSetBookingStatus).toHaveBeenCalledWith('admin-1', 'b-1', 'CONFIRMED');
    });

    it('should throw BadRequestException when status is missing', async () => {
      await expect(controller.updateBookingStatus('admin-1', 'b-1', '' as any)).rejects.toThrow();
    });

    it('should throw BadRequestException for invalid status value', async () => {
      await expect(
        controller.updateBookingStatus('admin-1', 'b-1', 'INVALID_STATUS'),
      ).rejects.toThrow();
    });
  });

  describe('getRevenueReport', () => {
    it('should return revenue report', async () => {
      const result = await controller.getRevenueReport('admin-1', undefined as any, undefined as any);

      expect(result).toBeDefined();
    });
  });

  describe('getGeneralSettings', () => {
    it('should return general settings', async () => {
      const result = await controller.getGeneralSettings('admin-1');

      expect(result).toBeDefined();
      expect(systemService.getGeneralSettings).toHaveBeenCalled();
    });
  });

  describe('getSystemHealth', () => {
    it('should return system health', async () => {
      const result = await controller.getSystemHealth('admin-1');

      expect(result.status).toBe('healthy');
    });
  });

  describe('getSystemLogs', () => {
    it('should return system logs', async () => {
      await controller.getSystemLogs('admin-1');

      expect(systemService.getSystemLogs).toHaveBeenCalled();
    });

    it('should pass level and limit', async () => {
      await controller.getSystemLogs('admin-1', 'error', 50 as any);

      expect(systemService.getSystemLogs).toHaveBeenCalled();
    });
  });

  describe('getReviews', () => {
    it('should delegate to content service', async () => {
      await controller.getReviews('admin-1');

      expect(contentService.getReviews).toHaveBeenCalled();
    });
  });

  describe('updateReviewStatus', () => {
    it('should update review status', async () => {
      await controller.updateReviewStatus('admin-1', 'r-1', { status: 'APPROVED' });

      expect(contentService.updateReviewStatus).toHaveBeenCalled();
    });
  });

  describe('getEntitySchema', () => {
    it('should return entity schema', async () => {
      const result = await controller.getEntitySchema('admin-1', 'users');

      expect(result).toBeDefined();
      expect(entityService.getEntitySchema).toHaveBeenCalled();
    });
  });

  describe('getEntityData', () => {
    it('should return entity data with pagination', async () => {
      const result = await controller.getEntityData('admin-1', 'users');

      expect(result).toBeDefined();
      expect(entityService.getEntityData).toHaveBeenCalled();
    });
  });
});
