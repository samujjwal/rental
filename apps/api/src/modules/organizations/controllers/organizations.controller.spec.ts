import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from '../services/organizations.service';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let service: jest.Mocked<OrganizationsService>;

  const mockOrg = { id: 'org1', name: 'Test Rentals', ownerId: 'u1' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        {
          provide: OrganizationsService,
          useValue: {
            createOrganization: jest.fn(),
            getUserOrganizations: jest.fn(),
            getOrganization: jest.fn(),
            updateOrganization: jest.fn(),
            inviteMember: jest.fn(),
            removeMember: jest.fn(),
            updateMemberRole: jest.fn(),
            getOrganizationStats: jest.fn(),
            getMembers: jest.fn(),
            deactivateOrganization: jest.fn(),
            acceptInvitation: jest.fn(),
            declineInvitation: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(OrganizationsController);
    service = module.get(OrganizationsService) as jest.Mocked<OrganizationsService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── createOrganization ──
  describe('createOrganization', () => {
    it('delegates to service', async () => {
      service.createOrganization.mockResolvedValue(mockOrg as any);
      const dto = { name: 'Test Rentals' } as any;
      const result = await controller.createOrganization('u1', dto);
      expect(service.createOrganization).toHaveBeenCalledWith('u1', dto);
      expect(result).toBe(mockOrg);
    });
  });

  // ── getMyOrganizations ──
  describe('getMyOrganizations', () => {
    it('returns { organizations, total }', async () => {
      service.getUserOrganizations.mockResolvedValue([mockOrg, mockOrg] as any);
      const result = await controller.getMyOrganizations('u1');
      expect(result.organizations).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  // ── getOrganization ──
  describe('getOrganization', () => {
    it('passes orgId and userId', async () => {
      service.getOrganization.mockResolvedValue(mockOrg as any);
      await controller.getOrganization('org1', 'u1');
      expect(service.getOrganization).toHaveBeenCalledWith('org1', 'u1');
    });
  });

  // ── updateOrganization ──
  describe('updateOrganization', () => {
    it('passes orgId, userId, and dto', async () => {
      service.updateOrganization.mockResolvedValue(mockOrg as any);
      const dto = { name: 'Updated' } as any;
      await controller.updateOrganization('org1', 'u1', dto);
      expect(service.updateOrganization).toHaveBeenCalledWith('org1', 'u1', dto);
    });
  });

  // ── inviteMember ──
  describe('inviteMember', () => {
    it('passes orgId, userId, and dto', async () => {
      service.inviteMember.mockResolvedValue({} as any);
      const dto = { email: 'new@test.com', role: 'MEMBER' } as any;
      await controller.inviteMember('org1', 'u1', dto);
      expect(service.inviteMember).toHaveBeenCalledWith('org1', 'u1', dto);
    });
  });

  // ── removeMember ──
  describe('removeMember', () => {
    it('passes orgId, currentUserId, and memberUserId', async () => {
      await controller.removeMember('org1', 'u1', 'u2');
      expect(service.removeMember).toHaveBeenCalledWith('org1', 'u1', 'u2');
    });
  });

  // ── updateMemberRole ──
  describe('updateMemberRole', () => {
    it('passes all params including role from body', async () => {
      service.updateMemberRole.mockResolvedValue({} as any);
      await controller.updateMemberRole('org1', 'u1', 'u2', 'ADMIN');
      expect(service.updateMemberRole).toHaveBeenCalledWith('org1', 'u1', 'u2', 'ADMIN');
    });
  });

  // ── getStats ──
  describe('getStats', () => {
    it('delegates to service', async () => {
      const stats = { members: 5, listings: 10 };
      service.getOrganizationStats.mockResolvedValue(stats as any);
      expect(await controller.getStats('org1', 'u1')).toBe(stats);
    });
  });

  // ── getMembers ──
  describe('getMembers', () => {
    it('delegates to service', async () => {
      service.getMembers.mockResolvedValue([{ userId: 'u1' }] as any);
      const result = await controller.getMembers('org1', 'u1');
      expect(result).toHaveLength(1);
    });
  });

  // ── deactivateOrganization ──
  describe('deactivateOrganization', () => {
    it('calls service to deactivate', async () => {
      await controller.deactivateOrganization('org1', 'u1');
      expect(service.deactivateOrganization).toHaveBeenCalledWith('org1', 'u1');
    });
  });

  // ── acceptInvitation ──
  describe('acceptInvitation', () => {
    it('accepts by organizationId', async () => {
      service.acceptInvitation.mockResolvedValue({} as any);
      await controller.acceptInvitation('u1', { organizationId: 'org1' });
      expect(service.acceptInvitation).toHaveBeenCalledWith('u1', 'org1');
    });

    it('throws BadRequestException if no organizationId', async () => {
      await expect(controller.acceptInvitation('u1', { token: 'tok123' })).rejects.toThrow(BadRequestException);
    });
  });

  // ── declineInvitation ──
  describe('declineInvitation', () => {
    it('declines by organizationId', async () => {
      service.declineInvitation.mockResolvedValue({} as any);
      await controller.declineInvitation('u1', { organizationId: 'org1' });
      expect(service.declineInvitation).toHaveBeenCalledWith('u1', 'org1');
    });
  });
});
