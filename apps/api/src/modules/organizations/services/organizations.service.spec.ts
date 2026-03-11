import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EmailService } from '@/common/email/email.service';
import { OrganizationRole } from '@rental-portal/database';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: any;
  let emailService: { sendEmail: jest.Mock };

  const userId = 'user-1';
  const orgId = 'org-1';

  beforeEach(async () => {
    emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) };

    prisma = {
      user: { findUnique: jest.fn() },
      organization: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      organizationMember: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      listing: { count: jest.fn() },
      booking: { count: jest.fn(), aggregate: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  describe('createOrganization', () => {
    it('should create an organization successfully', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userId });
      prisma.organizationMember.findFirst.mockResolvedValue(null);
      prisma.organization.findUnique.mockResolvedValue(null); // for slug uniqueness
      prisma.organization.create.mockResolvedValue({
        id: orgId,
        name: 'ACME Rentals',
        slug: 'acme-rentals',
        ownerId: userId,
        members: [{ userId, role: 'OWNER' }],
      });

      const result = await service.createOrganization(userId, {
        name: 'ACME Rentals',
        businessType: 'LLC',
        email: 'admin@acme.com',
      });

      expect(result.name).toBe('ACME Rentals');
      expect(prisma.organization.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrganization('missing', {
          name: 'Test',
          businessType: 'INDIVIDUAL',
          email: 'test@test.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user already owns an org', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userId });
      prisma.organizationMember.findFirst.mockResolvedValue({
        userId,
        role: 'OWNER',
        organizationId: 'existing-org',
      });

      await expect(
        service.createOrganization(userId, {
          name: 'Second Org',
          businessType: 'LLC',
          email: 'test@test.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOrganization', () => {
    it('should return organization for member', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        name: 'ACME',
        members: [{ userId, role: 'OWNER' }],
        listings: [],
        _count: { listings: 0, members: 1 },
      });

      const result = await service.getOrganization(orgId, userId);

      expect(result.name).toBe('ACME');
    });

    it('should throw NotFoundException when org not found', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.getOrganization('missing', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for non-member', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: orgId,
        name: 'ACME',
        members: [{ userId: 'other', role: 'OWNER' }],
        listings: [],
        _count: { listings: 0, members: 1 },
      });

      await expect(service.getOrganization(orgId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateOrganization', () => {
    it('should update org for owner', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId,
        role: 'OWNER',
      });
      prisma.organization.update.mockResolvedValue({
        id: orgId,
        name: 'New Name',
      });

      const result = await service.updateOrganization(orgId, userId, {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
    });

    it('should throw ForbiddenException for non-member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOrganization(orgId, userId, { name: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for MEMBER role', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId,
        role: 'MEMBER',
      });

      await expect(
        service.updateOrganization(orgId, userId, { name: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('inviteMember', () => {
    it('should invite a user and send email', async () => {
      prisma.organizationMember.findUnique
        .mockResolvedValueOnce({ userId, role: 'OWNER' }) // verifyPermission
        .mockResolvedValueOnce(null); // check existing
      prisma.user.findUnique.mockResolvedValue({
        id: 'invited-1',
        email: 'invited@test.com',
      });
      prisma.organizationMember.create.mockResolvedValue({
        userId: 'invited-1',
        role: OrganizationRole.MEMBER,
      });
      prisma.organization.findUnique.mockResolvedValue({ name: 'ACME' });

      await service.inviteMember(orgId, userId, {
        email: 'invited@test.com',
        role: OrganizationRole.MEMBER,
      });

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'invited@test.com',
        expect.stringContaining('Invitation'),
        expect.stringContaining('ACME'),
      );
    });

    it('should throw NotFoundException for unknown email', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId,
        role: 'OWNER',
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.inviteMember(orgId, userId, {
          email: 'nobody@test.com',
          role: OrganizationRole.MEMBER,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already member', async () => {
      prisma.organizationMember.findUnique
        .mockResolvedValueOnce({ userId, role: 'OWNER' }) // verifyPermission
        .mockResolvedValueOnce({ userId: 'invited-1', role: 'MEMBER' }); // existing
      prisma.user.findUnique.mockResolvedValue({ id: 'invited-1' });

      await expect(
        service.inviteMember(orgId, userId, {
          email: 'x@test.com',
          role: OrganizationRole.MEMBER,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMember', () => {
    it('should remove a member', async () => {
      prisma.organizationMember.findUnique
        .mockResolvedValueOnce({ userId, role: 'OWNER' }) // verifyPermission
        .mockResolvedValueOnce({ userId: 'member-1', role: 'MEMBER' }); // target
      prisma.organizationMember.delete.mockResolvedValue({});

      await service.removeMember(orgId, userId, 'member-1');

      expect(prisma.organizationMember.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing member', async () => {
      prisma.organizationMember.findUnique
        .mockResolvedValueOnce({ userId, role: 'OWNER' })
        .mockResolvedValueOnce(null);

      await expect(service.removeMember(orgId, userId, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when trying to remove owner', async () => {
      prisma.organizationMember.findUnique
        .mockResolvedValueOnce({ userId, role: 'OWNER' })
        .mockResolvedValueOnce({ userId: 'owner-id', role: OrganizationRole.OWNER });

      await expect(
        service.removeMember(orgId, userId, 'owner-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      prisma.organizationMember.findUnique
        .mockResolvedValueOnce({ userId, role: 'OWNER' }) // verifyPermission
        .mockResolvedValueOnce({ userId: 'member-1', role: 'MEMBER' }); // target
      prisma.organizationMember.update.mockResolvedValue({
        userId: 'member-1',
        role: OrganizationRole.ADMIN,
      });

      const result = await service.updateMemberRole(
        orgId,
        userId,
        'member-1',
        OrganizationRole.ADMIN,
      );

      expect(result.role).toBe(OrganizationRole.ADMIN);
    });

    it('should throw BadRequestException when changing owner role', async () => {
      prisma.organizationMember.findUnique
        .mockResolvedValueOnce({ userId, role: 'OWNER' })
        .mockResolvedValueOnce({ userId: 'own', role: OrganizationRole.OWNER });

      await expect(
        service.updateMemberRole(orgId, userId, 'own', OrganizationRole.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserOrganizations', () => {
    it('should return organizations for user', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([
        {
          organization: {
            id: orgId,
            name: 'ACME',
            _count: { listings: 5, members: 3 },
          },
        },
      ]);

      const result = await service.getUserOrganizations(userId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('ACME');
    });

    it('should return empty array if no memberships', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([]);

      const result = await service.getUserOrganizations(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getOrganizationStats', () => {
    it('should return stats for authorized member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId,
        role: 'OWNER',
      });
      prisma.listing.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8); // active
      prisma.booking.count.mockResolvedValue(25);
      prisma.booking.aggregate.mockResolvedValue({
        _sum: { totalPrice: 5000 },
      });

      const result = await service.getOrganizationStats(orgId, userId);

      expect(result.totalListings).toBe(10);
      expect(result.activeListings).toBe(8);
      expect(result.totalBookings).toBe(25);
      expect(result.totalRevenue).toBe(5000);
    });

    it('should throw ForbiddenException for non-member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(service.getOrganizationStats(orgId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
