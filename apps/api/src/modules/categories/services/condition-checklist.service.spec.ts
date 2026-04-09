import { Test, TestingModule } from '@nestjs/testing';
import { ConditionChecklistService } from './condition-checklist.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

/**
 * Condition Checklist Service - Production-Grade Business Logic Tests
 *
 * These tests validate exact business logic computations and invariants:
 * - Checklist template retrieval
 * - Checklist validation
 * - Condition score calculations
 * - Report comparison logic
 * - Damage detection
 */
describe('ConditionChecklistService - Business Logic Validation', () => {
  let service: ConditionChecklistService;
  let prisma: jest.Mocked<PrismaService>;

  const mockBooking = {
    id: 'booking-1',
    listingId: 'listing-1',
    renterId: 'renter-1',
    ownerId: 'owner-1',
    status: 'CONFIRMED',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      booking: {
        findUnique: jest.fn(),
      },
      conditionReport: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConditionChecklistService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ConditionChecklistService>(ConditionChecklistService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('CHECKLIST TEMPLATES', () => {
    it('should return vehicle checklist template', () => {
      const template = service.getChecklistTemplate('vehicles');

      expect(template.sections).toHaveLength(4);
      expect(template.sections[0].id).toBe('exterior');
      expect(template.sections[0].items).toContain('Scratches');
      expect(template.sections[1].id).toBe('interior');
      expect(template.sections[2].id).toBe('mechanical');
      expect(template.sections[3].id).toBe('documentation');
    });

    it('should return spaces checklist template', () => {
      const template = service.getChecklistTemplate('spaces');

      expect(template.sections).toHaveLength(4);
      expect(template.sections[0].id).toBe('general');
      expect(template.sections[1].id).toBe('furniture');
      expect(template.sections[2].id).toBe('appliances');
      expect(template.sections[3].id).toBe('utilities');
    });

    it('should return clothing checklist template', () => {
      const template = service.getChecklistTemplate('clothing');

      expect(template.sections).toHaveLength(2);
      expect(template.sections[0].id).toBe('garment');
      expect(template.sections[1].id).toBe('cleanliness');
    });

    it('should return generic template for unknown category', () => {
      const template = service.getChecklistTemplate('unknown');

      expect(template.sections).toHaveLength(1);
      expect(template.sections[0].id).toBe('general');
    });
  });

  describe('CHECKLIST VALIDATION', () => {
    it('should validate complete vehicle checklist', () => {
      const checklistData = {
        exterior: {
          Scratches: 'good',
          Dents: 'good',
          'Paint condition': 'good',
          Lights: 'good',
          Tires: 'good',
        },
        interior: {
          Seats: 'good',
          Dashboard: 'good',
          Carpet: 'good',
          Windows: 'good',
          'AC/Heat': 'good',
        },
        mechanical: {
          'Engine start': 'good',
          Brakes: 'good',
          Transmission: 'good',
          Steering: 'good',
          Battery: 'good',
        },
      };

      const result = service.validateChecklistCompletion('vehicles', checklistData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.completedSections).toContain('exterior');
      expect(result.completedSections).toContain('interior');
      expect(result.completedSections).toContain('mechanical');
    });

    it('should reject missing required section', () => {
      const checklistData = {
        exterior: { Scratches: 'good', Dents: 'good' },
        // Missing interior, mechanical (required sections)
      };

      const result = service.validateChecklistCompletion('vehicles', checklistData);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Interior Condition'))).toBe(true);
    });

    it('should reject required section with no completed items', () => {
      const checklistData = {
        exterior: {}, // No items completed
        interior: { Seats: 'good' },
      };

      const result = service.validateChecklistCompletion('vehicles', checklistData);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Exterior Condition'))).toBe(true);
    });

    it('should accept optional section missing', () => {
      const checklistData = {
        exterior: { Scratches: 'good' },
        interior: { Seats: 'good' },
        mechanical: { 'Engine start': 'good' },
        // documentation is optional
      };

      const result = service.validateChecklistCompletion('vehicles', checklistData);

      expect(result.valid).toBe(true);
    });

    it('should track completed sections correctly', () => {
      const checklistData = {
        exterior: { Scratches: 'good' },
        interior: { Seats: 'good' },
      };

      const result = service.validateChecklistCompletion('vehicles', checklistData);

      expect(result.completedSections).toHaveLength(2);
      expect(result.completedSections).toContain('exterior');
      expect(result.completedSections).toContain('interior');
    });
  });

  describe('CONDITION SCORE CALCULATION', () => {
    it('should calculate 100% score for all items passing', () => {
      const checklistData = {
        exterior: { Scratches: true, Dents: true, 'Paint condition': true },
        interior: { Seats: true, Dashboard: true },
      };

      const result = service.calculateConditionScore(checklistData);

      // EXACT VALIDATION: 5/5 items = 100%
      expect(result.score).toBe(100);
      expect(result.totalItems).toBe(5);
      expect(result.passedItems).toBe(5);
      expect(result.percentage).toBe(100);
    });

    it('should calculate score for partial passes', () => {
      const checklistData = {
        exterior: { Scratches: true, Dents: false, 'Paint condition': true },
        interior: { Seats: true, Dashboard: false },
      };

      const result = service.calculateConditionScore(checklistData);

      // EXACT VALIDATION: 3/5 items = 60%
      expect(result.score).toBe(60);
      expect(result.totalItems).toBe(5);
      expect(result.passedItems).toBe(3);
      expect(result.percentage).toBe(60);
    });

    it('should recognize "good" and "pass" as passing', () => {
      const checklistData = {
        exterior: { Scratches: 'good', Dents: 'pass', 'Paint condition': true },
      };

      const result = service.calculateConditionScore(checklistData);

      // EXACT VALIDATION: 3/3 items = 100%
      expect(result.score).toBe(100);
      expect(result.passedItems).toBe(3);
    });

    it('should handle empty checklist', () => {
      const result = service.calculateConditionScore({});

      // EXACT VALIDATION: 0/0 items = 100% (default)
      expect(result.score).toBe(100);
      expect(result.totalItems).toBe(0);
      expect(result.passedItems).toBe(0);
    });

    it('should calculate 0% score for all failures', () => {
      const checklistData = {
        exterior: { Scratches: false, Dents: false, 'Paint condition': false },
      };

      const result = service.calculateConditionScore(checklistData);

      // EXACT VALIDATION: 0/3 items = 0%
      expect(result.score).toBe(0);
      expect(result.totalItems).toBe(3);
      expect(result.passedItems).toBe(0);
    });
  });

  describe('REPORT COMPARISON', () => {
    it('should detect differences in checklist items', async () => {
      const checkinReport = {
        id: 'checkin-1',
        bookingId: 'booking-1',
        checkIn: true,
        checklistData: JSON.stringify({
          exterior: { Scratches: 'good', Dents: 'good' },
        }),
        damages: 'Minor scratch on door',
      };

      const checkoutReport = {
        id: 'checkout-1',
        bookingId: 'booking-1',
        checkOut: true,
        checklistData: JSON.stringify({
          exterior: { Scratches: 'damaged', Dents: 'good' },
        }),
        damages: 'Minor scratch on door, Dent on bumper',
      };

      (prisma.conditionReport.findFirst as jest.Mock)
        .mockResolvedValueOnce(checkinReport)
        .mockResolvedValueOnce(checkoutReport);

      const result = await service.compareReports('booking-1');

      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].item).toBe('Scratches');
      expect(result.differences[0].checkin).toBe('good');
      expect(result.differences[0].checkout).toBe('damaged');
    });

    it('should identify new damages', async () => {
      const checkinReport = {
        id: 'checkin-1',
        bookingId: 'booking-1',
        checkIn: true,
        checklistData: JSON.stringify({}),
        damages: 'Minor scratch',
      };

      const checkoutReport = {
        id: 'checkout-1',
        bookingId: 'booking-1',
        checkOut: true,
        checklistData: JSON.stringify({}),
        damages: 'Minor scratch, Dent on bumper, Broken window',
      };

      (prisma.conditionReport.findFirst as jest.Mock)
        .mockResolvedValueOnce(checkinReport)
        .mockResolvedValueOnce(checkoutReport);

      const result = await service.compareReports('booking-1');

      expect(result.newDamages).toContain('Dent on bumper');
      expect(result.newDamages).toContain('Broken window');
      expect(result.newDamages).not.toContain('Minor scratch');
    });

    it('should require both reports for comparison', async () => {
      (prisma.conditionReport.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.compareReports('booking-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('CONDITION REPORT CREATION', () => {
    it('should create condition report with validated checklist', async () => {
      const checklistData = {
        exterior: { Scratches: 'good', Dents: 'good' },
        interior: { Seats: 'good' },
        mechanical: { Engine: 'good', Brakes: 'good' },
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
      (prisma.conditionReport.create as jest.Mock).mockResolvedValue({
        id: 'report-1',
        checklistData: JSON.stringify(checklistData),
      });

      const result = await service.createConditionReport({
        bookingId: 'booking-1',
        propertyId: 'listing-1',
        createdBy: 'renter-1',
        checkIn: true,
        checkOut: false,
        category: 'vehicles',
        checklistData,
        photos: ['photo1.jpg'],
      });

      expect(result.conditionReport).toBeDefined();
      expect(result.validation.valid).toBe(true);
    });

    it('should reject invalid checklist', async () => {
      const checklistData = {
        exterior: {}, // No items completed
      };

      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      await expect(
        service.createConditionReport({
          bookingId: 'booking-1',
          propertyId: 'listing-1',
          createdBy: 'renter-1',
          checkIn: true,
          checkOut: false,
          category: 'vehicles',
          checklistData,
          photos: ['photo1.jpg'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle non-existent booking', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createConditionReport({
          bookingId: 'non-existent',
          propertyId: 'listing-1',
          createdBy: 'renter-1',
          checkIn: true,
          checkOut: false,
          category: 'vehicles',
          checklistData: {},
          photos: ['photo1.jpg'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('REPORT UPDATE', () => {
    it('should update condition report', async () => {
      const existingReport = {
        id: 'report-1',
        bookingId: 'booking-1',
        checklistData: JSON.stringify({}),
      };

      const newChecklistData = {
        exterior: { Scratches: 'good' },
        interior: { Seats: 'good' },
        mechanical: { Engine: 'good', Brakes: 'good' },
      };

      (prisma.conditionReport.findUnique as jest.Mock).mockResolvedValue(existingReport);
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({
        ...mockBooking,
        listing: {
          id: 'listing-1',
          category: { slug: 'vehicles' },
        },
      });
      (prisma.conditionReport.update as jest.Mock).mockResolvedValue({
        ...existingReport,
        checklistData: JSON.stringify(newChecklistData),
      });

      const result = await service.updateConditionReport('report-1', {
        checklistData: newChecklistData,
      });

      expect(result.checklistData).toEqual(newChecklistData);
    });

    it('should validate checklist on update', async () => {
      const existingReport = {
        id: 'report-1',
        bookingId: 'booking-1',
        checklistData: JSON.stringify({}),
      };

      const invalidChecklistData = {
        exterior: {}, // No items
      };

      (prisma.conditionReport.findUnique as jest.Mock).mockResolvedValue(existingReport);
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({
        ...mockBooking,
        listing: {
          id: 'listing-1',
          category: { slug: 'vehicles' },
        },
      });

      await expect(
        service.updateConditionReport('report-1', {
          checklistData: invalidChecklistData,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle non-existent report', async () => {
      (prisma.conditionReport.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateConditionReport('non-existent', {
          notes: 'Updated notes',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('REPORT RETRIEVAL', () => {
    it('should return all reports for booking', async () => {
      const reports = [
        {
          id: 'report-1',
          checklistData: JSON.stringify({ exterior: { Scratches: 'good' } }),
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'report-2',
          checklistData: JSON.stringify({ interior: { Seats: 'good' } }),
          createdAt: new Date('2024-01-05'),
        },
      ];

      (prisma.conditionReport.findMany as jest.Mock).mockResolvedValue(reports);

      const result = await service.getBookingReports('booking-1');

      expect(result).toHaveLength(2);
      expect(result[0].checklistData).toEqual({ exterior: { Scratches: 'good' } });
      expect(result[1].checklistData).toEqual({ interior: { Seats: 'good' } });
    });

    it('should return empty array for no reports', async () => {
      (prisma.conditionReport.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getBookingReports('booking-1');

      expect(result).toEqual([]);
    });
  });
});
