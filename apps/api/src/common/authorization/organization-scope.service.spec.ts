import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationScopeService, ScopeType, ScopeCheckResult, ResourceContext } from './organization-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

/**
 * ORGANIZATION SCOPE ACCESS MATRIX TESTS
 * 
 * These tests validate the complete access control matrix for organization scope:
 * - Individual owner access
 * - Organization owner access
 * - Organization admin access
 * - Organization member access
 * - Renter access
 * - Support admin access
 * - Finance admin access
 * - Unrelated user access denial
 * 
 * Business Truth Validated:
 * - Individual owners can access their own resources
 * - Org owners have full access to org resources
 * - Org admins have full access to org resources
 * - Org members have limited access to org resources
 * - Renters can access their booking-related resources
 * - Support admins can access all resources for support
 * - Finance admins can access financial resources
 * - Unrelated users are denied access
 * 
 * Resource Types Tested:
 * - listing
 * - booking
 * - dispute
 * - insurance
 * - payout
 * - organization
 */

describe('OrganizationScopeService', () => {
  let service: OrganizationScopeService;
  let prisma: any;

  beforeEach(async () => {
    const mockPrismaService: any = {
      organizationMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      listing: {
        findUnique: jest.fn(),
      },
      booking: {
        findUnique: jest.fn(),
      },
      dispute: {
        findUnique: jest.fn(),
      },
      insurancePolicy: {
        findUnique: jest.fn(),
      },
      payout: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationScopeService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OrganizationScopeService>(OrganizationScopeService);
    prisma = mockPrismaService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Individual Owner Access', () => {
    it('should allow individual owner to access their listing', async () => {
      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        ownerId: 'owner-1',
      };

      const result = await service.checkScope('owner-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.INDIVIDUAL_OWNER);
      expect(result.reason).toContain('individual owner');
    });

    it('should allow individual owner to access their booking', async () => {
      const context: ResourceContext = {
        resourceType: 'booking',
        resourceId: 'booking-1',
        ownerId: 'owner-1',
      };

      const result = await service.checkScope('owner-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.INDIVIDUAL_OWNER);
    });

    it('should allow individual owner to access their payout', async () => {
      const context: ResourceContext = {
        resourceType: 'payout',
        resourceId: 'payout-1',
        ownerId: 'owner-1',
      };

      const result = await service.checkScope('owner-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.INDIVIDUAL_OWNER);
    });

    it('should deny non-owner from accessing individual owner resource', async () => {
      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        ownerId: 'owner-1',
      };

      const result = await service.checkScope('other-user', 'USER', context);

      expect(result.allowed).toBe(false);
      expect(result.scopeType).toBe(ScopeType.UNAUTHORIZED);
    });
  });

  describe('Organization Owner Access', () => {
    it('should allow org owner to access org listing', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-owner-1',
        organizationId: 'org-1',
        role: 'OWNER',
      });

      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('org-owner-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_OWNER);
      expect(result.reason).toContain('organization owner');
    });

    it('should allow org owner to access org booking', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-owner-1',
        organizationId: 'org-1',
        role: 'OWNER',
      });

      const context: ResourceContext = {
        resourceType: 'booking',
        resourceId: 'booking-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('org-owner-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_OWNER);
    });

    it('should allow org owner to access org dispute', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-owner-1',
        organizationId: 'org-1',
        role: 'OWNER',
      });

      const context: ResourceContext = {
        resourceType: 'dispute',
        resourceId: 'dispute-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('org-owner-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_OWNER);
    });

    it('should allow org owner to access org insurance policy', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-owner-1',
        organizationId: 'org-1',
        role: 'OWNER',
      });

      const context: ResourceContext = {
        resourceType: 'insurance',
        resourceId: 'insurance-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('org-owner-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_OWNER);
    });
  });

  describe('Organization Admin Access', () => {
    it('should allow org admin to access org listing', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-admin-1',
        organizationId: 'org-1',
        role: 'ADMIN',
      });

      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('org-admin-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_ADMIN);
      expect(result.reason).toContain('organization admin');
    });

    it('should allow org admin to access org booking', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-admin-1',
        organizationId: 'org-1',
        role: 'ADMIN',
      });

      const context: ResourceContext = {
        resourceType: 'booking',
        resourceId: 'booking-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('org-admin-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_ADMIN);
    });

    it('should allow org admin to access org payout', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-admin-1',
        organizationId: 'org-1',
        role: 'ADMIN',
      });

      const context: ResourceContext = {
        resourceType: 'payout',
        resourceId: 'payout-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('org-admin-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_ADMIN);
    });
  });

  describe('Organization Member Access', () => {
    it('should allow org member to access org listing', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-member-1',
        organizationId: 'org-1',
        role: 'MEMBER',
      });

      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('org-member-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_MEMBER);
      expect(result.reason).toContain('organization member');
    });

    it('should allow org member to access org booking', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-member-1',
        organizationId: 'org-1',
        role: 'MEMBER',
      });

      const context: ResourceContext = {
        resourceType: 'booking',
        resourceId: 'booking-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('org-member-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_MEMBER);
    });

    it('should allow org member to access org dispute', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-member-1',
        organizationId: 'org-1',
        role: 'MEMBER',
      });

      const context: ResourceContext = {
        resourceType: 'dispute',
        resourceId: 'dispute-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('org-member-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_MEMBER);
    });
  });

  describe('Renter Access', () => {
    it('should allow renter to access their booking', async () => {
      const context: ResourceContext = {
        resourceType: 'booking',
        resourceId: 'booking-1',
        renterId: 'renter-1',
      };

      const result = await service.checkScope('renter-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.RENTER);
      expect(result.reason).toContain('renter');
    });

    it('should allow renter to access their dispute', async () => {
      const context: ResourceContext = {
        resourceType: 'dispute',
        resourceId: 'dispute-1',
        renterId: 'renter-1',
      };

      const result = await service.checkScope('renter-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.RENTER);
    });

    it('should deny non-renter from accessing renter resource', async () => {
      const context: ResourceContext = {
        resourceType: 'booking',
        resourceId: 'booking-1',
        renterId: 'renter-1',
      };

      const result = await service.checkScope('other-user', 'USER', context);

      expect(result.allowed).toBe(false);
      expect(result.scopeType).toBe(ScopeType.UNAUTHORIZED);
    });
  });

  describe('Support Admin Access', () => {
    it('should allow support admin to access any resource', async () => {
      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        ownerId: 'owner-1',
      };

      const result = await service.checkScope('support-admin-1', 'SUPPORT_ADMIN', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.SUPPORT_ADMIN);
      expect(result.reason).toContain('support admin');
    });

    it('should allow support admin to access bookings', async () => {
      const context: ResourceContext = {
        resourceType: 'booking',
        resourceId: 'booking-1',
        renterId: 'renter-1',
      };

      const result = await service.checkScope('support-admin-1', 'SUPPORT_ADMIN', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.SUPPORT_ADMIN);
    });

    it('should allow support admin to access disputes', async () => {
      const context: ResourceContext = {
        resourceType: 'dispute',
        resourceId: 'dispute-1',
      };

      const result = await service.checkScope('support-admin-1', 'SUPPORT_ADMIN', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.SUPPORT_ADMIN);
    });

    it('should allow support admin to access payouts', async () => {
      const context: ResourceContext = {
        resourceType: 'payout',
        resourceId: 'payout-1',
      };

      const result = await service.checkScope('support-admin-1', 'SUPPORT_ADMIN', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.SUPPORT_ADMIN);
    });
  });

  describe('Finance Admin Access', () => {
    it('should allow finance admin to access bookings', async () => {
      const context: ResourceContext = {
        resourceType: 'booking',
        resourceId: 'booking-1',
      };

      const result = await service.checkScope('finance-admin-1', 'FINANCE_ADMIN', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.FINANCE_ADMIN);
      expect(result.reason).toContain('finance admin');
    });

    it('should allow finance admin to access payouts', async () => {
      const context: ResourceContext = {
        resourceType: 'payout',
        resourceId: 'payout-1',
      };

      const result = await service.checkScope('finance-admin-1', 'FINANCE_ADMIN', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.FINANCE_ADMIN);
    });

    it('should deny finance admin access to non-financial resources', async () => {
      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
      };

      const result = await service.checkScope('finance-admin-1', 'FINANCE_ADMIN', context);

      expect(result.allowed).toBe(false);
      expect(result.scopeType).toBe(ScopeType.UNAUTHORIZED);
    });

    it('should deny finance admin access to disputes', async () => {
      const context: ResourceContext = {
        resourceType: 'dispute',
        resourceId: 'dispute-1',
      };

      const result = await service.checkScope('finance-admin-1', 'FINANCE_ADMIN', context);

      expect(result.allowed).toBe(false);
      expect(result.scopeType).toBe(ScopeType.UNAUTHORIZED);
    });
  });

  describe('Core Admin Access', () => {
    it('should allow core admin to access any resource', async () => {
      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
      };

      const result = await service.checkScope('core-admin-1', 'ADMIN', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.SUPPORT_ADMIN);
      expect(result.reason).toContain('core admin');
    });

    it('should allow super admin to access any resource', async () => {
      const context: ResourceContext = {
        resourceType: 'booking',
        resourceId: 'booking-1',
      };

      const result = await service.checkScope('super-admin-1', 'SUPER_ADMIN', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.SUPPORT_ADMIN);
    });
  });

  describe('Unrelated User Access Denial', () => {
    it('should deny unrelated user from accessing listing', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        ownerId: 'owner-1',
        organizationId: null,
      });

      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
      };

      const result = await service.checkScope('unrelated-user', 'USER', context);

      expect(result.allowed).toBe(false);
      expect(result.scopeType).toBe(ScopeType.UNAUTHORIZED);
    });

    it('should deny unrelated user from accessing booking', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        listing: {
          ownerId: 'owner-1',
          organizationId: null,
        },
      });

      const context: ResourceContext = {
        resourceType: 'booking',
        resourceId: 'booking-1',
      };

      const result = await service.checkScope('unrelated-user', 'USER', context);

      expect(result.allowed).toBe(false);
      expect(result.scopeType).toBe(ScopeType.UNAUTHORIZED);
    });

    it('should deny unrelated user from accessing org resource without membership', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);

      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('unrelated-user', 'USER', context);

      expect(result.allowed).toBe(false);
      expect(result.scopeType).toBe(ScopeType.UNAUTHORIZED);
      expect(result.reason).toContain('not a member');
    });

    it('should deny org member from accessing different org resource', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-member-1',
        organizationId: 'org-1',
        role: 'MEMBER',
      });

      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        organizationId: 'org-2', // Different org
      };

      const result = await service.checkScope('org-member-1', 'USER', context);

      expect(result.allowed).toBe(false);
      expect(result.scopeType).toBe(ScopeType.UNAUTHORIZED);
    });
  });

  describe('Organization Scope Resolution', () => {
    it('should resolve org scope from listing resource', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        ownerId: 'owner-1',
        organizationId: 'org-1',
      });

      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-admin-1',
        organizationId: 'org-1',
        role: 'ADMIN',
      });

      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
      };

      const result = await service.checkScope('org-admin-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_ADMIN);
    });

    it('should resolve org scope from booking resource', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        listing: {
          ownerId: 'owner-1',
          organizationId: 'org-1',
        },
      });

      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-owner-1',
        organizationId: 'org-1',
        role: 'OWNER',
      });

      const context: ResourceContext = {
        resourceType: 'booking',
        resourceId: 'booking-1',
      };

      const result = await service.checkScope('org-owner-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_OWNER);
    });

    it('should resolve org scope from dispute resource', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        id: 'dispute-1',
        booking: {
          listing: {
            ownerId: 'owner-1',
            organizationId: 'org-1',
          },
        },
      });

      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-member-1',
        organizationId: 'org-1',
        role: 'MEMBER',
      });

      const context: ResourceContext = {
        resourceType: 'dispute',
        resourceId: 'dispute-1',
      };

      const result = await service.checkScope('org-member-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_MEMBER);
    });

    it('should resolve org scope from insurance resource', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue({
        id: 'insurance-1',
        listing: {
          ownerId: 'owner-1',
          organizationId: 'org-1',
        },
      });

      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'org-admin-1',
        organizationId: 'org-1',
        role: 'ADMIN',
      });

      const context: ResourceContext = {
        resourceType: 'insurance',
        resourceId: 'insurance-1',
      };

      const result = await service.checkScope('org-admin-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.ORG_ADMIN);
    });
  });

  describe('requireScope Method', () => {
    it('should throw ForbiddenException when access is denied', async () => {
      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        ownerId: 'owner-1',
      };

      await expect(
        service.requireScope('unrelated-user', 'USER', context)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not throw when access is allowed', async () => {
      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        ownerId: 'owner-1',
      };

      await expect(
        service.requireScope('owner-1', 'USER', context)
      ).resolves.not.toThrow();
    });

    it('should throw with custom reason message', async () => {
      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
      };

      prisma.listing.findUnique.mockResolvedValue({
        id: 'listing-1',
        ownerId: 'owner-1',
        organizationId: null,
      });

      try {
        await service.requireScope('unrelated-user', 'USER', context);
        fail('Should have thrown ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
      }
    });
  });

  describe('getUserOrganizations Method', () => {
    it('should return all organizations for a user', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          organizationId: 'org-1',
          role: 'OWNER',
          organization: {
            id: 'org-1',
            name: 'Org 1',
            logoUrl: 'https://example.com/logo1.png',
            status: 'ACTIVE',
          },
        },
        {
          userId: 'user-1',
          organizationId: 'org-2',
          role: 'ADMIN',
          organization: {
            id: 'org-2',
            name: 'Org 2',
            logoUrl: 'https://example.com/logo2.png',
            status: 'ACTIVE',
          },
        },
      ]);

      const result = await service.getUserOrganizations('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('OWNER');
      expect(result[0].organization.name).toBe('Org 1');
      expect(result[1].role).toBe('ADMIN');
      expect(result[1].organization.name).toBe('Org 2');
    });

    it('should return empty array for user with no organizations', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([]);

      const result = await service.getUserOrganizations('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getOrganizationMembers Method', () => {
    it('should return all members of an organization', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          organizationId: 'org-1',
          role: 'OWNER',
          user: {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'USER',
          },
        },
        {
          userId: 'user-2',
          organizationId: 'org-1',
          role: 'ADMIN',
          user: {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'USER',
          },
        },
      ]);

      const result = await service.getOrganizationMembers('org-1');

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user-1');
      expect(result[0].role).toBe('OWNER');
      expect(result[0].user.firstName).toBe('John');
      expect(result[1].userId).toBe('user-2');
      expect(result[1].role).toBe('ADMIN');
    });

    it('should return empty array for organization with no members', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([]);

      const result = await service.getOrganizationMembers('org-1');

      expect(result).toEqual([]);
    });
  });

  describe('Access Priority and Precedence', () => {
    it('should prioritize individual owner over org membership', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'owner-1',
        organizationId: 'org-1',
        role: 'MEMBER',
      });

      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        ownerId: 'owner-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('owner-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.INDIVIDUAL_OWNER);
    });

    it('should prioritize renter over org membership for bookings', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'renter-1',
        organizationId: 'org-1',
        role: 'MEMBER',
      });

      const context: ResourceContext = {
        resourceType: 'booking',
        resourceId: 'booking-1',
        renterId: 'renter-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('renter-1', 'USER', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.RENTER);
    });

    it('should prioritize support admin over all other scopes', async () => {
      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        ownerId: 'owner-1',
      };

      const result = await service.checkScope('support-admin-1', 'SUPPORT_ADMIN', context);

      expect(result.allowed).toBe(true);
      expect(result.scopeType).toBe(ScopeType.SUPPORT_ADMIN);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing resource gracefully', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'non-existent-listing',
      };

      const result = await service.checkScope('user-1', 'USER', context);

      expect(result.allowed).toBe(false);
      expect(result.scopeType).toBe(ScopeType.UNAUTHORIZED);
    });

    it('should handle unknown resource type', async () => {
      const context: ResourceContext = {
        resourceType: 'unknown' as any,
        resourceId: 'resource-1',
      };

      const result = await service.checkScope('user-1', 'USER', context);

      expect(result.allowed).toBe(false);
      expect(result.scopeType).toBe(ScopeType.UNAUTHORIZED);
    });

    it('should handle invalid organization membership role', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'INVALID_ROLE',
      });

      const context: ResourceContext = {
        resourceType: 'listing',
        resourceId: 'listing-1',
        organizationId: 'org-1',
      };

      const result = await service.checkScope('user-1', 'USER', context);

      expect(result.allowed).toBe(false);
      expect(result.scopeType).toBe(ScopeType.UNAUTHORIZED);
    });
  });
});
