import { Test, TestingModule } from '@nestjs/testing';
import { InventoryManagementService } from './inventory-management.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import { AvailabilityRepository } from '../../availability/repositories/availability.repository';
import { BookingRepository } from '../../bookings/repositories/booking.repository';
import { ListingRepository } from '../../listings/repositories/listing.repository';
import { CacheService } from '../../cache/services/cache.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * INVENTORY MANAGEMENT TESTS
 * 
 * These tests validate inventory management functionality:
 * - Inventory allocation and tracking
 * - Inventory reconciliation and reporting
 * - Inventory optimization and analytics
 * - Multi-channel inventory synchronization
 * - Inventory conflict resolution
 * - Real-time inventory updates
 * - Inventory forecasting and planning
 * - Inventory audit trails and compliance
 * 
 * Business Truth Validated:
 * - Inventory is allocated accurately across bookings
 * - Inventory tracking maintains data integrity
 * - Reconciliation identifies and resolves discrepancies
 * - Optimization maximizes inventory utilization
 * - Multi-channel sync prevents overbooking
 * - Real-time updates maintain consistency
 */

describe('InventoryManagementService', () => {
  let inventoryManagementService: InventoryManagementService;
  let inventoryRepository: InventoryRepository;
  let availabilityRepository: AvailabilityRepository;
  let bookingRepository: BookingRepository;
  let listingRepository: ListingRepository;
  let cacheService: CacheService;
  let configService: ConfigService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryManagementService,
        {
          provide: InventoryRepository,
          useValue: {
            createInventory: jest.fn(),
            updateInventory: jest.fn(),
            deleteInventory: jest.fn(),
            findInventoryByListing: jest.fn(),
            findInventoryByCategory: jest.fn(),
            allocateInventory: jest.fn(),
            releaseInventory: jest.fn(),
            reconcileInventory: jest.fn(),
            getInventoryStats: jest.fn(),
            bulkUpdateInventory: jest.fn(),
            findInventoryConflicts: jest.fn(),
            syncInventory: jest.fn(),
            auditInventory: jest.fn(),
          },
        },
        {
          provide: AvailabilityRepository,
          useValue: {
            findAvailability: jest.fn(),
            updateAvailability: jest.fn(),
            syncAvailability: jest.fn(),
          },
        },
        {
          provide: BookingRepository,
          useValue: {
            findBookingsByInventory: jest.fn(),
            updateBookingInventory: jest.fn(),
            findConfirmedBookings: jest.fn(),
            findPendingBookings: jest.fn(),
          },
        },
        {
          provide: ListingRepository,
          useValue: {
            findById: jest.fn(),
            findActiveListings: jest.fn(),
            updateListingInventory: jest.fn(),
            getListingsByCategory: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            flush: jest.fn(),
            getMultiple: jest.fn(),
            setMultiple: jest.fn(),
            invalidatePattern: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(3600), // 1 hour cache
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    inventoryManagementService = module.get<InventoryManagementService>(InventoryManagementService);
    inventoryRepository = module.get<InventoryRepository>(InventoryRepository);
    availabilityRepository = module.get<AvailabilityRepository>(AvailabilityRepository);
    bookingRepository = module.get<BookingRepository>(BookingRepository);
    listingRepository = module.get<ListingRepository>(ListingRepository);
    cacheService = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  describe('Inventory Allocation', () => {
    it('should allocate inventory for a new booking', async () => {
      // Arrange
      const listingId = 'listing-123';
      const bookingId = 'booking-456';
      const allocationRequest = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-05'),
        quantity: 2,
        inventoryType: 'units',
      };

      const availableInventory = [
        {
          id: 'inv-1',
          listingId,
          date: '2024-06-01',
          totalUnits: 10,
          allocatedUnits: 3,
          availableUnits: 7,
        },
        {
          id: 'inv-2',
          listingId,
          date: '2024-06-02',
          totalUnits: 10,
          allocatedUnits: 3,
          availableUnits: 7,
        },
      ];

      const allocatedInventory = [
        {
          id: 'inv-1',
          listingId,
          date: '2024-06-01',
          totalUnits: 10,
          allocatedUnits: 5, // 3 + 2
          availableUnits: 5, // 7 - 2
          bookingAllocations: [
            { bookingId: 'booking-456', units: 2, allocatedAt: new Date() },
          ],
        },
      ];

      inventoryRepository.findInventoryByListing.mockResolvedValue(availableInventory);
      inventoryRepository.allocateInventory.mockResolvedValue(allocatedInventory);
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await inventoryManagementService.allocateInventory(listingId, bookingId, allocationRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.allocatedUnits).toBe(2);
      expect(result.allocationDetails).toHaveLength(4); // 4 days
      expect(result.allocationDetails[0].availableUnits).toBe(5);
      expect(inventoryRepository.allocateInventory).toHaveBeenCalledWith(listingId, bookingId, allocationRequest);
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('inventory:'),
        expect.any(Object),
        3600
      );
    });

    it('should reject allocation when insufficient inventory', async () => {
      // Arrange
      const listingId = 'listing-789';
      const bookingId = 'booking-insufficient';
      const allocationRequest = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-03'),
        quantity: 5,
        inventoryType: 'units',
      };

      const limitedInventory = [
        {
          id: 'inv-1',
          listingId,
          date: '2024-06-01',
          totalUnits: 10,
          allocatedUnits: 8,
          availableUnits: 2, // Only 2 available
        },
      ];

      inventoryRepository.findInventoryByListing.mockResolvedValue(limitedInventory);

      // Act
      const result = await inventoryManagementService.allocateInventory(listingId, bookingId, allocationRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.reason).toBe('insufficient_inventory');
      expect(result.availableUnits).toBe(2);
      expect(result.requestedUnits).toBe(5);
      expect(result.shortage).toBe(3);
      expect(inventoryRepository.allocateInventory).not.toHaveBeenCalled();
    });

    it('should handle partial inventory allocation', async () => {
      // Arrange
      const listingId = 'listing-partial';
      const bookingId = 'booking-partial';
      const allocationRequest = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-05'),
        quantity: 3,
        inventoryType: 'units',
        allowPartialAllocation: true,
      };

      const variableInventory = [
        {
          id: 'inv-1',
          listingId,
          date: '2024-06-01',
          totalUnits: 10,
          allocatedUnits: 8,
          availableUnits: 2,
        },
        {
          id: 'inv-2',
          listingId,
          date: '2024-06-02',
          totalUnits: 10,
          allocatedUnits: 7,
          availableUnits: 3,
        },
        {
          id: 'inv-3',
          listingId,
          date: '2024-06-03',
          totalUnits: 10,
          allocatedUnits: 9,
          availableUnits: 1,
        },
      ];

      inventoryRepository.findInventoryByListing.mockResolvedValue(variableInventory);

      // Act
      const result = await inventoryManagementService.allocateInventory(listingId, bookingId, allocationRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.isPartialAllocation).toBe(true);
      expect(result.allocatedUnits).toBe(3);
      expect(result.allocationDetails[0].availableUnits).toBe(0); // June 1: 2 - 2 = 0
      expect(result.allocationDetails[1].availableUnits).toBe(0); // June 2: 3 - 1 = 2 (but only 1 allocated)
      expect(result.allocationDetails[2].availableUnits).toBe(0); // June 3: 1 - 1 = 0
    });

    it('should allocate inventory with priority rules', async () => {
      // Arrange
      const listingId = 'listing-priority';
      const bookingId = 'booking-priority';
      const allocationRequest = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-03'),
        quantity: 2,
        inventoryType: 'units',
        priority: 'high',
      };

      const inventoryWithPriority = [
        {
          id: 'inv-1',
          listingId,
          date: '2024-06-01',
          totalUnits: 10,
          allocatedUnits: 8,
          availableUnits: 2,
          priorityAllocations: [
            { bookingId: 'booking-high-1', units: 1, priority: 'high' },
            { bookingId: 'booking-low-1', units: 1, priority: 'low' },
          ],
        },
      ];

      inventoryRepository.findInventoryByListing.mockResolvedValue(inventoryWithPriority);
      inventoryRepository.allocateInventory.mockResolvedValue([]);

      // Act
      const result = await inventoryManagementService.allocateInventory(listingId, bookingId, allocationRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.priorityApplied).toBe(true);
      expect(result.allocationStrategy).toBe('priority_based');
      expect(inventoryRepository.allocateInventory).toHaveBeenCalledWith(
        listingId,
        bookingId,
        expect.objectContaining({
          priority: 'high',
          overrideLowPriority: true,
        })
      );
    });
  });

  describe('Inventory Tracking', () => {
    it('should track inventory changes over time', async () => {
      // Arrange
      const listingId = 'listing-track';
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-30');
      
      const inventoryHistory = [
        {
          date: '2024-06-01',
          totalUnits: 10,
          allocatedUnits: 3,
          availableUnits: 7,
          utilizationRate: 30,
          changes: [
            {
              type: 'allocation',
              bookingId: 'booking-1',
              units: 2,
              timestamp: new Date('2024-06-01T10:00:00Z'),
            },
          ],
        },
        {
          date: '2024-06-02',
          totalUnits: 10,
          allocatedUnits: 5,
          availableUnits: 5,
          utilizationRate: 50,
          changes: [
            {
              type: 'allocation',
              bookingId: 'booking-2',
              units: 2,
              timestamp: new Date('2024-06-02T14:00:00Z'),
            },
          ],
        },
      ];

      inventoryRepository.findInventoryByListing.mockResolvedValue(inventoryHistory);
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await inventoryManagementService.trackInventoryHistory(listingId, startDate, endDate);

      // Assert
      expect(result.history).toHaveLength(2);
      expect(result.history[0].utilizationRate).toBe(30);
      expect(result.history[1].utilizationRate).toBe(50);
      expect(result.totalChanges).toBe(2);
      expect(result.averageUtilization).toBe(40);
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('inventory_history:'),
        expect.any(Object),
        3600
      );
    });

    it('should track real-time inventory status', async () => {
      // Arrange
      const listingId = 'listing-realtime';
      const currentStatus = {
        totalUnits: 15,
        allocatedUnits: 8,
        availableUnits: 7,
        pendingAllocations: 2,
        reservedUnits: 1,
        utilizationRate: 53.33,
        lastUpdated: new Date(),
        activeBookings: 4,
        pendingBookings: 2,
      };

      inventoryRepository.findInventoryByListing.mockResolvedValue([currentStatus]);
      bookingRepository.findConfirmedBookings.mockResolvedValue([
        { id: 'booking-1', units: 2 },
        { id: 'booking-2', units: 3 },
        { id: 'booking-3', units: 1 },
        { id: 'booking-4', units: 2 },
      ]);
      bookingRepository.findPendingBookings.mockResolvedValue([
        { id: 'booking-pending-1', units: 1 },
        { id: 'booking-pending-2', units: 1 },
      ]);

      // Act
      const result = await inventoryManagementService.getRealTimeInventoryStatus(listingId);

      // Assert
      expect(result.totalUnits).toBe(15);
      expect(result.availableUnits).toBe(7);
      expect(result.utilizationRate).toBe(53.33);
      expect(result.activeBookings).toHaveLength(4);
      expect(result.pendingBookings).toHaveLength(2);
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('should detect inventory anomalies', async () => {
      // Arrange
      const listingId = 'listing-anomaly';
      const inventoryData = [
        {
          date: '2024-06-01',
          totalUnits: 10,
          allocatedUnits: 8,
          availableUnits: 2,
        },
        {
          date: '2024-06-02',
          totalUnits: 10,
          allocatedUnits: 12, // Over-allocated!
          availableUnits: -2, // Negative available units
        },
        {
          date: '2024-06-03',
          totalUnits: 10,
          allocatedUnits: 5,
          availableUnits: 5,
        },
      ];

      inventoryRepository.findInventoryByListing.mockResolvedValue(inventoryData);

      // Act
      const result = await inventoryManagementService.detectInventoryAnomalies(listingId);

      // Assert
      expect(result.hasAnomalies).toBe(true);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].type).toBe('over_allocation');
      expect(result.anomalies[0].date).toBe('2024-06-02');
      expect(result.anomalies[0].severity).toBe('high');
      expect(result.anomalies[0].recommendedAction).toBe('immediate_investigation');
    });

    it('should track inventory by category', async () => {
      // Arrange
      const category = 'vehicle';
      const categoryInventory = {
        totalListings: 25,
        totalUnits: 50,
        allocatedUnits: 30,
        availableUnits: 20,
        utilizationRate: 60,
        subCategories: {
          car: { listings: 15, units: 30, allocated: 18, available: 12 },
          motorcycle: { listings: 10, units: 20, allocated: 12, available: 8 },
        },
      };

      inventoryRepository.findInventoryByCategory.mockResolvedValue(categoryInventory);

      // Act
      const result = await inventoryManagementService.getCategoryInventoryStatus(category);

      // Assert
      expect(result.totalListings).toBe(25);
      expect(result.utilizationRate).toBe(60);
      expect(result.subCategories.car.utilizationRate).toBe(60);
      expect(result.subCategories.motorcycle.utilizationRate).toBe(60);
      expect(inventoryRepository.findInventoryByCategory).toHaveBeenCalledWith(category);
    });
  });

  describe('Inventory Reconciliation', () => {
    it('should reconcile inventory discrepancies', async () => {
      // Arrange
      const listingId = 'listing-reconcile';
      const reconciliationData = {
        expectedInventory: [
          { date: '2024-06-01', totalUnits: 10, allocatedUnits: 5, availableUnits: 5 },
          { date: '2024-06-02', totalUnits: 10, allocatedUnits: 6, availableUnits: 4 },
        ],
        actualInventory: [
          { date: '2024-06-01', totalUnits: 10, allocatedUnits: 7, availableUnits: 3 }, // Discrepancy
          { date: '2024-06-02', totalUnits: 10, allocatedUnits: 6, availableUnits: 4 }, // Match
        ],
      };

      const reconciliationResult = {
        discrepancies: [
          {
            date: '2024-06-01',
            type: 'allocation_mismatch',
            expectedAllocated: 5,
            actualAllocated: 7,
            difference: 2,
            severity: 'medium',
          },
        ],
        corrected: [
          {
            date: '2024-06-01',
            action: 'allocation_correction',
            correctedUnits: 5,
            affectedBookings: ['booking-1', 'booking-2'],
          },
        ],
        summary: {
          totalDates: 2,
          discrepanciesFound: 1,
          discrepanciesResolved: 1,
          successRate: 100,
        },
      };

      inventoryRepository.reconcileInventory.mockResolvedValue(reconciliationResult);

      // Act
      const result = await inventoryManagementService.reconcileInventory(listingId, reconciliationData);

      // Assert
      expect(result.discrepancies).toHaveLength(1);
      expect(result.corrected).toHaveLength(1);
      expect(result.summary.discrepanciesFound).toBe(1);
      expect(result.summary.successRate).toBe(100);
      expect(inventoryRepository.reconcileInventory).toHaveBeenCalledWith(listingId, reconciliationData);
    });

    it('should handle automated reconciliation', async () => {
      // Arrange
      const listingId = 'listing-auto-reconcile';
      const autoReconcileConfig = {
        enabled: true,
        schedule: 'daily',
        threshold: 0.05, // 5% threshold
        autoCorrect: true,
        notificationThreshold: 0.1, // 10% for notifications
      };

      const autoReconcileResult = {
        executed: true,
        executionTime: new Date(),
        discrepanciesFound: 2,
        autoCorrected: 1,
        requiresManualReview: 1,
        summary: {
          totalInventoryChecked: 30,
          discrepanciesResolved: 1,
          manualReviewRequired: 1,
        },
      };

      inventoryRepository.reconcileInventory.mockResolvedValue(autoReconcileResult);

      // Act
      const result = await inventoryManagementService.performAutoReconciliation(listingId, autoReconcileConfig);

      // Assert
      expect(result.executed).toBe(true);
      expect(result.discrepanciesFound).toBe(2);
      expect(result.autoCorrected).toBe(1);
      expect(result.requiresManualReview).toBe(1);
      expect(inventoryRepository.reconcileInventory).toHaveBeenCalledWith(
        listingId,
        expect.objectContaining({
          autoMode: true,
          threshold: 0.05,
          autoCorrect: true,
        })
      );
    });

    it('should generate reconciliation reports', async () => {
      // Arrange
      const listingId = 'listing-report';
      const reportPeriod = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-30'),
      };

      const reconciliationReport = {
        period: reportPeriod,
        summary: {
          totalDays: 30,
          daysWithDiscrepancies: 3,
          totalDiscrepancies: 5,
          discrepanciesResolved: 4,
          pendingResolution: 1,
        },
        discrepancies: [
          {
            date: '2024-06-05',
            type: 'allocation_mismatch',
            severity: 'low',
            resolved: true,
            resolutionTime: 2, // hours
          },
          {
            date: '2024-06-15',
            type: 'total_units_mismatch',
            severity: 'high',
            resolved: false,
            resolutionTime: null,
          },
        ],
        trends: {
          discrepancyFrequency: 'decreasing',
          averageResolutionTime: 4.5, // hours
          commonDiscrepancyTypes: ['allocation_mismatch', 'timing_mismatch'],
        },
        recommendations: [
          {
            priority: 'high',
            action: 'review_allocation_logic',
            reason: 'Frequent allocation mismatches',
          },
        ],
      };

      inventoryRepository.auditInventory.mockResolvedValue(reconciliationReport);

      // Act
      const result = await inventoryManagementService.generateReconciliationReport(listingId, reportPeriod);

      // Assert
      expect(result.summary.totalDays).toBe(30);
      expect(result.summary.daysWithDiscrepancies).toBe(3);
      expect(result.discrepancies).toHaveLength(2);
      expect(result.trends.discrepancyFrequency).toBe('decreasing');
      expect(result.recommendations).toHaveLength(1);
      expect(inventoryRepository.auditInventory).toHaveBeenCalledWith(listingId, reportPeriod);
    });
  });

  describe('Inventory Reporting', () => {
    it('should generate comprehensive inventory reports', async () => {
      // Arrange
      const listingId = 'listing-report-comprehensive';
      const reportConfig = {
        period: {
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-30'),
        },
        include: ['utilization', 'allocation', 'reconciliation', 'forecasting'],
        format: 'detailed',
      };

      const comprehensiveReport = {
        overview: {
          totalUnits: 100,
          averageUtilization: 75.5,
          peakUtilization: 95,
          lowestUtilization: 45,
          totalRevenue: 2500000,
          revenuePerUnit: 25000,
        },
        utilization: {
          daily: [
            { date: '2024-06-01', utilization: 70, revenue: 175000 },
            { date: '2024-06-02', utilization: 85, revenue: 212500 },
          ],
          weekly: [
            { week: '2024-W23', utilization: 78, revenue: 975000 },
            { week: '2024-W24', utilization: 73, revenue: 912500 },
          ],
          trends: {
            direction: 'stable',
            growth: 2.5, // percentage
            seasonality: 'summer_peak',
          },
        },
        allocation: {
          totalAllocations: 150,
          successfulAllocations: 142,
          failedAllocations: 8,
          averageAllocationTime: 2.3, // minutes
          allocationByChannel: {
            website: 85,
            mobile: 45,
            api: 20,
          },
        },
        performance: {
          turnoverRate: 3.5, // times per month
          averageBookingDuration: 4.2, // days
          fillRate: 94.5, // percentage
          noShowRate: 3.2, // percentage
        },
      };

      inventoryRepository.getInventoryStats.mockResolvedValue(comprehensiveReport);

      // Act
      const result = await inventoryManagementService.generateInventoryReport(listingId, reportConfig);

      // Assert
      expect(result.overview.totalUnits).toBe(100);
      expect(result.overview.averageUtilization).toBe(75.5);
      expect(result.utilization.daily).toHaveLength(2);
      expect(result.allocation.successfulAllocations).toBe(142);
      expect(result.performance.turnoverRate).toBe(3.5);
      expect(inventoryRepository.getInventoryStats).toHaveBeenCalledWith(listingId, reportConfig);
    });

    it('should generate inventory analytics insights', async () => {
      // Arrange
      const listingId = 'listing-insights';
      const analyticsData = {
        utilization: {
          current: 78,
          previous: 72,
          trend: 'increasing',
          forecast: {
            nextMonth: 82,
            nextQuarter: 85,
            confidence: 0.85,
          },
        },
        optimization: {
          opportunities: [
            {
              type: 'pricing_adjustment',
              potentialIncrease: 15,
              confidence: 0.9,
              action: 'increase_rates_during_peak',
            },
            {
              type: 'availability_optimization',
              potentialIncrease: 8,
              confidence: 0.75,
              action: 'reduce_blocked_periods',
            },
          ],
          risks: [
            {
              type: 'overbooking_risk',
              probability: 0.3,
              impact: 'high',
              mitigation: 'implement_stricter_allocation_rules',
            },
          ],
        },
        benchmarks: {
          categoryAverage: 75,
          topPerformer: 92,
          industryAverage: 70,
          ranking: {
            withinCategory: 7, // out of 25
            overall: 15, // out of 100
          },
        },
      };

      inventoryRepository.getInventoryStats.mockResolvedValue(analyticsData);

      // Act
      const result = await inventoryManagementService.generateInventoryInsights(listingId);

      // Assert
      expect(result.utilization.current).toBe(78);
      expect(result.utilization.trend).toBe('increasing');
      expect(result.optimization.opportunities).toHaveLength(2);
      expect(result.optimization.risks).toHaveLength(1);
      expect(result.benchmarks.categoryAverage).toBe(75);
      expect(result.benchmarks.ranking.withinCategory).toBe(7);
    });

    it('should create inventory performance dashboards', async () => {
      // Arrange
      const dashboardConfig = {
        timeRange: 'last_30_days',
        metrics: ['utilization', 'revenue', 'allocation', 'performance'],
        refreshInterval: 300, // 5 minutes
        includeComparisons: true,
      };

      const dashboardData = {
        keyMetrics: {
          currentUtilization: 82.5,
          monthlyRevenue: 2750000,
          allocationSuccess: 96.8,
          averageBookingValue: 35000,
        },
        trends: [
          {
            metric: 'utilization',
            data: [
              { date: '2024-06-01', value: 78 },
              { date: '2024-06-02', value: 80 },
              { date: '2024-06-03', value: 82.5 },
            ],
            trend: 'upward',
            change: 5.8, // percentage
          },
        ],
        comparisons: {
          vsLastMonth: {
            utilization: { current: 82.5, previous: 79.2, change: 4.2 },
            revenue: { current: 2750000, previous: 2650000, change: 3.8 },
          },
          vsCategoryAverage: {
            utilization: { current: 82.5, average: 75.0, difference: 7.5 },
            revenue: { current: 2750000, average: 2500000, difference: 250000 },
          },
        },
        alerts: [
          {
            type: 'opportunity',
            message: 'High demand detected for upcoming weekend',
            action: 'consider_rate_increase',
            priority: 'medium',
          },
        ],
      };

      inventoryRepository.getInventoryStats.mockResolvedValue(dashboardData);

      // Act
      const result = await inventoryManagementService.createPerformanceDashboard(dashboardConfig);

      // Assert
      expect(result.keyMetrics.currentUtilization).toBe(82.5);
      expect(result.trends).toHaveLength(1);
      expect(result.trends[0].trend).toBe('upward');
      expect(result.comparisons.vsLastMonth.utilization.change).toBe(4.2);
      expect(result.alerts).toHaveLength(1);
    });
  });

  describe('Inventory Optimization', () => {
    it('should optimize inventory allocation', async () => {
      // Arrange
      const listingId = 'listing-optimize';
      const optimizationConfig = {
        objective: 'maximize_revenue',
        constraints: {
          minimumAvailability: 2, // Keep 2 units always available
          maximumUtilization: 90, // Don't exceed 90% utilization
          priorityBookings: true,
        },
        timeHorizon: 30, // days
      };

      const optimizationResult = {
        currentPerformance: {
          utilization: 75,
          revenue: 2000000,
          allocationEfficiency: 85,
        },
        optimizedPerformance: {
          utilization: 85,
          revenue: 2266667, // 13.3% increase
          allocationEfficiency: 92,
        },
        recommendations: [
          {
            type: 'allocation_adjustment',
            action: 'prioritize_longer_bookings',
            expectedImpact: 8.5,
            confidence: 0.9,
          },
          {
            type: 'pricing_adjustment',
            action: 'dynamic_pricing_for_peak_demand',
            expectedImpact: 12.3,
            confidence: 0.85,
          },
        ],
        implementation: {
          steps: [
            {
              order: 1,
              action: 'update_allocation_rules',
              estimatedTime: 30, // minutes
              risk: 'low',
            },
            {
              order: 2,
              action: 'implement_dynamic_pricing',
              estimatedTime: 120, // minutes
              risk: 'medium',
            },
          ],
          totalEstimatedTime: 150, // minutes
          expectedROI: 13.3,
        },
      };

      inventoryRepository.getInventoryStats.mockResolvedValue(optimizationResult);

      // Act
      const result = await inventoryManagementService.optimizeInventoryAllocation(listingId, optimizationConfig);

      // Assert
      expect(result.currentPerformance.utilization).toBe(75);
      expect(result.optimizedPerformance.utilization).toBe(85);
      expect(result.recommendations).toHaveLength(2);
      expect(result.implementation.steps).toHaveLength(2);
      expect(result.implementation.expectedROI).toBe(13.3);
    });

    it('should forecast inventory demand', async () => {
      // Arrange
      const listingId = 'listing-forecast';
      const forecastConfig = {
        period: 'next_90_days',
        model: 'ensemble', // Use multiple forecasting models
        includeSeasonality: true,
        includeEvents: true,
        confidenceLevel: 0.95,
      };

      const forecastResult = {
        summary: {
          forecastPeriod: '2024-07-01 to 2024-09-30',
          averageDemand: 8.5, // units per day
          peakDemand: 12, // units per day
          lowestDemand: 4, // units per day
          demandVolatility: 0.25, // coefficient of variation
        },
        dailyForecast: [
          {
            date: '2024-07-01',
            predictedDemand: 7.5,
            confidenceInterval: [6.2, 8.8],
            probabilityOfFullBooking: 0.75,
            recommendedPrice: 28000,
          },
          {
            date: '2024-07-02',
            predictedDemand: 9.2,
            confidenceInterval: [7.8, 10.6],
            probabilityOfFullBooking: 0.92,
            recommendedPrice: 32000,
          },
        ],
        trends: {
          direction: 'increasing',
          seasonality: 'summer_peak',
            events: [
              {
                name: 'Festival Season',
                startDate: '2024-08-15',
                endDate: '2024-08-25',
                impact: '+25%',
                confidence: 0.9,
              },
            ],
        },
        recommendations: [
          {
            type: 'capacity_planning',
            action: 'increase_availability_during_peak',
            period: '2024-08-15 to 2024-08-25',
            expectedBenefit: 150000,
          },
        ],
      };

      inventoryRepository.getInventoryStats.mockResolvedValue(forecastResult);

      // Act
      const result = await inventoryManagementService.forecastInventoryDemand(listingId, forecastConfig);

      // Assert
      expect(result.summary.averageDemand).toBe(8.5);
      expect(result.summary.peakDemand).toBe(12);
      expect(result.dailyForecast).toHaveLength(2);
      expect(result.trends.direction).toBe('increasing');
      expect(result.trends.events).toHaveLength(1);
      expect(result.recommendations).toHaveLength(1);
    });

    it('should identify inventory optimization opportunities', async () => {
      // Arrange
      const listingId = 'listing-opportunities';
      const opportunityConfig = {
        analysisDepth: 'comprehensive',
        includeHistorical: true,
        considerMarket: true,
        minimumImpact: 5, // 5% minimum impact threshold
      };

      const opportunities = {
        highImpact: [
          {
            type: 'dynamic_pricing',
            description: 'Implement dynamic pricing based on demand',
            potentialRevenueIncrease: 18.5,
            implementationComplexity: 'medium',
            timeToImplement: 14, // days
            confidence: 0.92,
          },
          {
            type: 'availability_optimization',
            description: 'Optimize availability windows for better utilization',
            potentialRevenueIncrease: 12.3,
            implementationComplexity: 'low',
            timeToImplement: 3, // days
            confidence: 0.88,
          },
        ],
        mediumImpact: [
          {
            type: 'channel_optimization',
            description: 'Optimize distribution channels for better allocation',
            potentialRevenueIncrease: 7.8,
            implementationComplexity: 'medium',
            timeToImplement: 21, // days
            confidence: 0.75,
          },
        ],
        quickWins: [
          {
            type: 'booking_rules_adjustment',
            description: 'Adjust minimum stay requirements for off-peak periods',
            potentialRevenueIncrease: 5.2,
            implementationComplexity: 'low',
            timeToImplement: 1, // day
            confidence: 0.95,
          },
        ],
        implementationPlan: {
          phase1: {
            duration: '1 week',
            actions: ['booking_rules_adjustment'],
            expectedImpact: 5.2,
          },
          phase2: {
            duration: '2 weeks',
            actions: ['availability_optimization'],
            expectedImpact: 12.3,
          },
          phase3: {
            duration: '3 weeks',
            actions: ['dynamic_pricing'],
            expectedImpact: 18.5,
          },
        },
        totalExpectedImpact: 36.0, // percentage
      };

      inventoryRepository.getInventoryStats.mockResolvedValue(opportunities);

      // Act
      const result = await inventoryManagementService.identifyOptimizationOpportunities(listingId, opportunityConfig);

      // Assert
      expect(result.highImpact).toHaveLength(2);
      expect(result.mediumImpact).toHaveLength(1);
      expect(result.quickWins).toHaveLength(1);
      expect(result.implementationPlan.phase1.expectedImpact).toBe(5.2);
      expect(result.totalExpectedImpact).toBe(36.0);
    });
  });

  describe('Multi-Channel Synchronization', () => {
    it('should synchronize inventory across multiple channels', async () => {
      // Arrange
      const listingId = 'listing-multi-channel';
      const syncConfig = {
        channels: ['website', 'airbnb', 'booking.com', 'expedia'],
        syncType: 'full',
        includePricing: true,
        includeAvailability: true,
        includeRestrictions: true,
      };

      const channelData = {
        website: {
          availableUnits: 8,
          price: 25000,
          restrictions: { minStay: 2 },
          lastSync: new Date('2024-06-01T10:00:00Z'),
        },
        airbnb: {
          availableUnits: 7, // Mismatch!
          price: 26000,
          restrictions: { minStay: 3 },
          lastSync: new Date('2024-06-01T09:30:00Z'),
        },
        'booking.com': {
          availableUnits: 8,
          price: 25000,
          restrictions: { minStay: 2 },
          lastSync: new Date('2024-06-01T10:15:00Z'),
        },
        expedia: {
          availableUnits: 6, // Mismatch!
          price: 24000, // Mismatch!
          restrictions: { minStay: 2 },
          lastSync: new Date('2024-06-01T09:45:00Z'),
        },
      };

      const syncResult = {
        syncInitiated: true,
        syncId: 'sync-123',
        channels: {
          website: { status: 'no_action_needed', reason: 'already_synced' },
          airbnb: { status: 'updated', changes: ['availability', 'restrictions'], syncTime: 2.3 },
          'booking.com': { status: 'no_action_needed', reason: 'already_synced' },
          expedia: { status: 'updated', changes: ['availability', 'pricing'], syncTime: 3.1 },
        },
        summary: {
          totalChannels: 4,
          channelsUpdated: 2,
          channelsSkipped: 2,
          totalSyncTime: 3.1,
          success: true,
        },
        conflicts: [
          {
            channel: 'airbnb',
            type: 'availability_mismatch',
            resolved: true,
            resolution: 'updated_to_master',
          },
          {
            channel: 'expedia',
            type: 'pricing_mismatch',
            resolved: true,
            resolution: 'updated_to_master',
          },
        ],
      };

      inventoryRepository.syncInventory.mockResolvedValue(syncResult);

      // Act
      const result = await inventoryManagementService.synchronizeInventory(listingId, syncConfig);

      // Assert
      expect(result.syncInitiated).toBe(true);
      expect(result.summary.channelsUpdated).toBe(2);
      expect(result.conflicts).toHaveLength(2);
      expect(result.conflicts[0].resolved).toBe(true);
      expect(inventoryRepository.syncInventory).toHaveBeenCalledWith(listingId, syncConfig);
    });

    it('should handle channel-specific inventory rules', async () => {
      // Arrange
      const listingId = 'listing-channel-rules';
      const channelRules = {
        airbnb: {
          availabilityBuffer: 1, // Keep 1 unit as buffer
          priceAdjustment: 1.1, // 10% higher
          minStayAdjustment: 0, // No adjustment
        },
        'booking.com': {
          availabilityBuffer: 0,
          priceAdjustment: 0.95, // 5% lower
          minStayAdjustment: -1, // 1 day less minimum stay
        },
        expedia: {
          availabilityBuffer: 2,
          priceAdjustment: 1.05, // 5% higher
          minStayAdjustment: 1, // 1 day more minimum stay
        },
      };

      const baseInventory = {
        availableUnits: 8,
        price: 25000,
        minStay: 2,
      };

      const adjustedInventory = {
        airbnb: {
          availableUnits: 7, // 8 - 1 buffer
          price: 27500, // 25000 * 1.1
          minStay: 2, // No adjustment
        },
        'booking.com': {
          availableUnits: 8, // No buffer
          price: 23750, // 25000 * 0.95
          minStay: 1, // 2 - 1
        },
        expedia: {
          availableUnits: 6, // 8 - 2 buffer
          price: 26250, // 25000 * 1.05
          minStay: 3, // 2 + 1
        },
      };

      inventoryRepository.syncInventory.mockResolvedValue({ success: true });

      // Act
      const result = await inventoryManagementService.applyChannelRules(listingId, baseInventory, channelRules);

      // Assert
      expect(result.airbnb.availableUnits).toBe(7);
      expect(result.airbnb.price).toBe(27500);
      expect(result['booking.com'].availableUnits).toBe(8);
      expect(result['booking.com'].price).toBe(23750);
      expect(result.expedia.availableUnits).toBe(6);
      expect(result.expedia.minStay).toBe(3);
    });

    it('should resolve multi-channel conflicts', async () => {
      // Arrange
      const listingId = 'listing-conflict-resolution';
      const conflicts = [
        {
          type: 'double_booking',
          channels: ['website', 'airbnb'],
          bookingDetails: {
            website: { bookingId: 'web-123', timestamp: new Date('2024-06-01T10:00:00Z') },
            airbnb: { bookingId: 'airbnb-456', timestamp: new Date('2024-06-01T10:05:00Z') },
          },
          resolution: 'honor_first_booking',
          affectedChannel: 'airbnb',
        },
        {
          type: 'availability_mismatch',
          channels: ['booking.com', 'expedia'],
          mismatchDetails: {
            'booking.com': { available: 5, lastUpdate: new Date('2024-06-01T09:30:00Z') },
            expedia: { available: 7, lastUpdate: new Date('2024-06-01T10:15:00Z') },
          },
          resolution: 'use_latest_update',
          affectedChannel: 'booking.com',
        },
      ];

      const resolutionResult = {
        conflictsResolved: 2,
        resolutions: [
          {
            conflictId: 'conflict-1',
            type: 'double_booking',
            resolution: 'airbnb_booking_cancelled',
            compensation: 'alternative_offering',
            notificationSent: true,
          },
          {
            conflictId: 'conflict-2',
            type: 'availability_mismatch',
            resolution: 'booking.com_updated',
            dataSynced: true,
          },
        ],
        summary: {
          totalConflicts: 2,
          resolved: 2,
          pending: 0,
          resolutionTime: 5.2, // minutes
        },
      };

      inventoryRepository.findInventoryConflicts.mockResolvedValue(conflicts);
      inventoryRepository.resolveConflicts.mockResolvedValue(resolutionResult);

      // Act
      const result = await inventoryManagementService.resolveChannelConflicts(listingId);

      // Assert
      expect(result.conflictsResolved).toBe(2);
      expect(result.resolutions).toHaveLength(2);
      expect(result.summary.resolved).toBe(2);
      expect(result.resolutions[0].resolution).toBe('airbnb_booking_cancelled');
      expect(inventoryRepository.resolveConflicts).toHaveBeenCalledWith(listingId, conflicts);
    });
  });
});
