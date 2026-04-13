import { Test, TestingModule } from '@nestjs/testing';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('ActivityController', () => {
  let controller: ActivityController;
  let activityService: jest.Mocked<ActivityService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'USER',
  };

  const mockRecentActivities = [
    {
      id: 'activity-1',
      type: 'booking_created' as const,
      title: 'Booking Created',
      description: 'Your booking for Cozy Apartment has been created',
      timestamp: '2025-01-15T10:00:00Z',
      entityId: 'booking-1',
      entityType: 'booking' as const,
      metadata: { bookingId: 'booking-1', listingTitle: 'Cozy Apartment' },
    },
    {
      id: 'activity-2',
      type: 'booking_confirmed' as const,
      title: 'Booking Confirmed',
      description: 'Your booking has been confirmed',
      timestamp: '2025-01-15T11:00:00Z',
      entityId: 'booking-1',
      entityType: 'booking' as const,
      metadata: { bookingId: 'booking-1' },
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivityController],
      providers: [
        {
          provide: ActivityService,
          useValue: {
            getRecentActivity: jest.fn(),
            getActivityStats: jest.fn(),
            getUnreadCount: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ActivityController>(ActivityController);
    activityService = module.get(ActivityService) as jest.Mocked<ActivityService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent activities for authenticated user', async () => {
      activityService.getRecentActivity.mockResolvedValue({
        activities: mockRecentActivities,
        total: mockRecentActivities.length,
        nextCursor: null,
        hasMore: false,
      });

      const result = await controller.getRecentActivity(mockUser as any);

      expect(activityService.getRecentActivity).toHaveBeenCalledWith('user-123', {
        limit: 10,
        types: undefined,
        cursor: undefined,
        startDate: undefined,
        endDate: undefined,
      });
      expect(result.activities).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
      expect(result.hasMore).toBe(false);
    });

    it('should parse limit parameter correctly', async () => {
      activityService.getRecentActivity.mockResolvedValue({
        activities: mockRecentActivities.slice(0, 5),
        total: 5,
        nextCursor: null,
        hasMore: false,
      });

      await controller.getRecentActivity(mockUser as any, '5');

      expect(activityService.getRecentActivity).toHaveBeenCalledWith('user-123', {
        limit: 5,
        types: undefined,
        cursor: undefined,
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('should parse types parameter correctly', async () => {
      activityService.getRecentActivity.mockResolvedValue({
        activities: mockRecentActivities,
        total: mockRecentActivities.length,
        nextCursor: null,
        hasMore: false,
      });

      await controller.getRecentActivity(mockUser as any, '10', 'BOOKING_CREATED,BOOKING_APPROVED', 'cursor-123', '2025-01-01', '2025-01-31');

      expect(activityService.getRecentActivity).toHaveBeenCalledWith('user-123', {
        limit: 10,
        types: ['BOOKING_CREATED', 'BOOKING_APPROVED'],
        cursor: 'cursor-123',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });
    });

    it('should handle empty types string', async () => {
      activityService.getRecentActivity.mockResolvedValue({
        activities: mockRecentActivities,
        total: mockRecentActivities.length,
        nextCursor: null,
        hasMore: false,
      });

      await controller.getRecentActivity(mockUser as any, '10', '');

      expect(activityService.getRecentActivity).toHaveBeenCalledWith('user-123', {
        limit: 10,
        types: undefined,
        cursor: undefined,
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('should handle invalid limit gracefully', async () => {
      activityService.getRecentActivity.mockResolvedValue({
        activities: mockRecentActivities,
        total: mockRecentActivities.length,
        nextCursor: null,
        hasMore: false,
      });

      await controller.getRecentActivity(mockUser as any, 'invalid');

      expect(activityService.getRecentActivity).toHaveBeenCalledWith('user-123', {
        limit: NaN, // parseInt('invalid') returns NaN
        types: undefined,
        cursor: undefined,
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('should handle service errors', async () => {
      activityService.getRecentActivity.mockRejectedValue(new Error('Service unavailable'));

      await expect(controller.getRecentActivity(mockUser as any)).rejects.toThrow('Service unavailable');
    });

    it('should handle cursor-based pagination', async () => {
      activityService.getRecentActivity.mockResolvedValue({
        activities: mockRecentActivities,
        total: mockRecentActivities.length,
        nextCursor: 'cursor-next',
        hasMore: true,
      });

      const result = await controller.getRecentActivity(mockUser as any, '10', undefined, 'cursor-prev');

      expect(result.nextCursor).toBe('cursor-next');
      expect(result.hasMore).toBe(true);
    });
  });

  describe('getActivityStats', () => {
    it('should return activity stats with default period', async () => {
      const mockStats = {
        totalActivities: 45,
        byType: {
          BOOKING_CREATED: 20,
          BOOKING_APPROVED: 15,
          MESSAGE_RECEIVED: 10,
        },
        mostActiveDay: '2025-01-15',
        trend: 'up' as const,
        changePercent: 12.5,
      };
      activityService.getActivityStats.mockResolvedValue(mockStats);

      const result = await controller.getActivityStats(mockUser as any);

      expect(activityService.getActivityStats).toHaveBeenCalledWith('user-123', '30d');
      expect(result).toEqual(mockStats);
    });

    it('should accept custom period parameter', async () => {
      const mockStats = {
        totalActivities: 12,
        byType: { BOOKING_CREATED: 7, BOOKING_APPROVED: 5 },
        mostActiveDay: '2025-01-10',
        trend: 'stable' as const,
        changePercent: 0,
      };
      activityService.getActivityStats.mockResolvedValue(mockStats);

      const result = await controller.getActivityStats(mockUser as any, '7d');

      expect(activityService.getActivityStats).toHaveBeenCalledWith('user-123', '7d');
      expect(result).toEqual(mockStats);
    });

    it('should accept 90d period', async () => {
      activityService.getActivityStats.mockResolvedValue({
        totalActivities: 120,
        byType: { booking_created: 50, payment_processed: 70 },
        mostActiveDay: '2025-01-15',
        trend: 'up' as const,
        changePercent: 15.5,
      });

      await controller.getActivityStats(mockUser as any, '90d');

      expect(activityService.getActivityStats).toHaveBeenCalledWith('user-123', '90d');
    });

    it('should handle service errors', async () => {
      activityService.getActivityStats.mockRejectedValue(new Error('Stats calculation failed'));

      await expect(controller.getActivityStats(mockUser as any)).rejects.toThrow('Stats calculation failed');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread activity count', async () => {
      activityService.getUnreadCount.mockResolvedValue({ count: 5 });

      const result = await controller.getUnreadCount(mockUser as any);

      expect(activityService.getUnreadCount).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({ count: 5 });
    });

    it('should return zero when no unread activities', async () => {
      activityService.getUnreadCount.mockResolvedValue({ count: 0 });

      const result = await controller.getUnreadCount(mockUser as any);

      expect(result.count).toBe(0);
    });

    it('should handle service errors', async () => {
      activityService.getUnreadCount.mockRejectedValue(new Error('Count failed'));

      await expect(controller.getUnreadCount(mockUser as any)).rejects.toThrow('Count failed');
    });
  });

  describe('authorization', () => {
    it('should require authentication for all endpoints', () => {
      // Controller has @UseGuards(JwtAuthGuard) at class level
      const metadata = Reflect.getMetadata('__guards__', ActivityController);
      expect(metadata).toBeDefined();
    });

    it('should only return activities for the authenticated user', async () => {
      activityService.getRecentActivity.mockImplementation((userId) => {
        if (userId === 'user-123') {
          return Promise.resolve({ activities: mockRecentActivities, total: mockRecentActivities.length, nextCursor: null, hasMore: false });
        }
        return Promise.resolve({ activities: [], total: 0, nextCursor: null, hasMore: false });
      });

      const result = await controller.getRecentActivity(mockUser as any);
      expect(result.activities).toHaveLength(2);
    });
  });

  describe('pagination edge cases', () => {
    it('should handle very large limit values', async () => {
      activityService.getRecentActivity.mockResolvedValue({
        activities: mockRecentActivities,
        total: mockRecentActivities.length,
        nextCursor: null,
        hasMore: false,
      });

      await controller.getRecentActivity(mockUser as any, '1000');

      expect(activityService.getRecentActivity).toHaveBeenCalledWith('user-123', expect.objectContaining({
        limit: 1000,
      }));
    });

    it('should handle negative limit gracefully', async () => {
      activityService.getRecentActivity.mockResolvedValue({
        activities: mockRecentActivities,
        total: mockRecentActivities.length,
        nextCursor: null,
        hasMore: false,
      });

      await controller.getRecentActivity(mockUser as any, '-5');

      // parseInt('-5', 10) = -5, but service should handle validation
      expect(activityService.getRecentActivity).toHaveBeenCalledWith('user-123', expect.objectContaining({
        limit: -5,
      }));
    });
  });

  describe('date filtering', () => {
    it('should pass date range parameters correctly', async () => {
      activityService.getRecentActivity.mockResolvedValue({
        activities: mockRecentActivities,
        total: mockRecentActivities.length,
        nextCursor: null,
        hasMore: false,
      });

      await controller.getRecentActivity(
        mockUser as any,
        '20',
        undefined,
        undefined,
        '2025-01-01T00:00:00Z',
        '2025-01-31T23:59:59Z'
      );

      expect(activityService.getRecentActivity).toHaveBeenCalledWith('user-123', {
        limit: 20,
        types: undefined,
        cursor: undefined,
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
      });
    });
  });
});
