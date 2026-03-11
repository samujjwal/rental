import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceAutomationController } from './compliance-automation.controller';
import { ComplianceAutomationService } from '../services/compliance-automation.service';

describe('ComplianceAutomationController', () => {
  let controller: ComplianceAutomationController;
  let service: jest.Mocked<ComplianceAutomationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComplianceAutomationController],
      providers: [
        {
          provide: ComplianceAutomationService,
          useValue: {
            checkUserCompliance: jest.fn(),
            checkListingCompliance: jest.fn(),
            generateAuditTrail: jest.fn(),
            getAuditTrail: jest.fn(),
            checkDataRetention: jest.fn(),
            generateRegulatoryReport: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ComplianceAutomationController);
    service = module.get(ComplianceAutomationService) as jest.Mocked<ComplianceAutomationService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── checkUserCompliance ──

  describe('checkUserCompliance', () => {
    it('delegates userId to service', async () => {
      service.checkUserCompliance.mockResolvedValue({ compliant: true, kycVerified: true } as any);

      const result = await controller.checkUserCompliance('u1');

      expect(service.checkUserCompliance).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ compliant: true, kycVerified: true });
    });

    it('propagates service error', async () => {
      service.checkUserCompliance.mockRejectedValue(new Error('User not found'));
      await expect(controller.checkUserCompliance('bad')).rejects.toThrow('User not found');
    });
  });

  // ── checkListingCompliance ──

  describe('checkListingCompliance', () => {
    it('delegates listingId to service', async () => {
      service.checkListingCompliance.mockResolvedValue({ compliant: false, issues: ['Missing license'] } as any);

      const result = await controller.checkListingCompliance('l1');

      expect(service.checkListingCompliance).toHaveBeenCalledWith('l1');
      expect(result).toEqual({ compliant: false, issues: ['Missing license'] });
    });
  });

  // ── generateAuditTrail ──

  describe('generateAuditTrail', () => {
    it('spreads dto and adds performedBy', async () => {
      const dto = { entityType: 'booking', entityId: 'b1', action: 'APPROVE' };
      service.generateAuditTrail.mockResolvedValue({ id: 'at1' } as any);

      const result = await controller.generateAuditTrail('admin1', dto as any);

      expect(service.generateAuditTrail).toHaveBeenCalledWith({
        ...dto,
        performedBy: 'admin1',
      });
      expect(result).toEqual({ id: 'at1' });
    });

    it('propagates service error', async () => {
      service.generateAuditTrail.mockRejectedValue(new Error('Invalid entity'));
      await expect(controller.generateAuditTrail('admin1', {} as any)).rejects.toThrow('Invalid entity');
    });
  });

  // ── getAuditTrail ──

  describe('getAuditTrail', () => {
    it('delegates entityType and entityId', async () => {
      service.getAuditTrail.mockResolvedValue([{ id: 'at1', action: 'CREATE' }] as any);

      const result = await controller.getAuditTrail('booking', 'b1');

      expect(service.getAuditTrail).toHaveBeenCalledWith('booking', 'b1');
      expect(result).toEqual([{ id: 'at1', action: 'CREATE' }]);
    });
  });

  // ── checkDataRetention ──

  describe('checkDataRetention', () => {
    it('delegates to service with no args', async () => {
      service.checkDataRetention.mockResolvedValue({ retentionCompliant: true } as any);

      const result = await controller.checkDataRetention();

      expect(service.checkDataRetention).toHaveBeenCalledWith();
      expect(result).toEqual({ retentionCompliant: true });
    });
  });

  // ── generateReport ──

  describe('generateReport', () => {
    it('delegates country and converted dates', async () => {
      const dto = { country: 'NP', startDate: '2026-01-01', endDate: '2026-03-31' };
      service.generateRegulatoryReport.mockResolvedValue({ entries: 42 } as any);

      const result = await controller.generateReport(dto as any);

      expect(service.generateRegulatoryReport).toHaveBeenCalledWith(
        'NP',
        new Date('2026-01-01'),
        new Date('2026-03-31'),
      );
      expect(result).toEqual({ entries: 42 });
    });

    it('propagates service error', async () => {
      service.generateRegulatoryReport.mockRejectedValue(new Error('Invalid date range'));
      await expect(
        controller.generateReport({ country: 'NP', startDate: 'bad', endDate: 'bad' } as any),
      ).rejects.toThrow('Invalid date range');
    });
  });
});
