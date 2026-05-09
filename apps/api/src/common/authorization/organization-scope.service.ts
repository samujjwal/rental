import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isSupportAdmin, isFinanceAdmin, isCoreAdmin } from '../auth/admin-roles';

export enum ScopeType {
  INDIVIDUAL_OWNER = 'INDIVIDUAL_OWNER',
  ORG_OWNER = 'ORG_OWNER',
  ORG_ADMIN = 'ORG_ADMIN',
  ORG_MEMBER = 'ORG_MEMBER',
  RENTER = 'RENTER',
  SUPPORT_ADMIN = 'SUPPORT_ADMIN',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

export interface ScopeCheckResult {
  allowed: boolean;
  scopeType: ScopeType;
  reason?: string;
}

export interface ResourceContext {
  resourceType: 'listing' | 'booking' | 'dispute' | 'insurance' | 'payout' | 'organization';
  resourceId?: string;
  ownerId?: string;
  organizationId?: string;
  renterId?: string;
}

@Injectable()
export class OrganizationScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a user has access to a resource based on their scope
   * Supports individual owner, org owner, org admin, org member, renter, and admin roles
   */
  async checkScope(
    userId: string,
    userRole: string,
    context: ResourceContext,
  ): Promise<ScopeCheckResult> {
    const { resourceType, resourceId, ownerId, organizationId, renterId } = context;

    // 1. Check if user is the individual owner
    if (ownerId && ownerId === userId) {
      return {
        allowed: true,
        scopeType: ScopeType.INDIVIDUAL_OWNER,
        reason: 'User is the individual owner of this resource',
      };
    }

    // 2. Check if user is the renter (for bookings/disputes)
    if (renterId && renterId === userId) {
      return {
        allowed: true,
        scopeType: ScopeType.RENTER,
        reason: 'User is the renter of this booking',
      };
    }

    // 3. Check if user is a support admin (can access all resources for support purposes)
    if (isSupportAdmin(userRole)) {
      return {
        allowed: true,
        scopeType: ScopeType.SUPPORT_ADMIN,
        reason: 'User is a support admin',
      };
    }

    // 4. Check if user is a finance admin (can access financial resources)
    if (isFinanceAdmin(userRole) && (resourceType === 'payout' || resourceType === 'booking')) {
      return {
        allowed: true,
        scopeType: ScopeType.FINANCE_ADMIN,
        reason: 'User is a finance admin',
      };
    }

    // 5. Check if user is a core admin (can access all resources)
    if (isCoreAdmin(userRole)) {
      return {
        allowed: true,
        scopeType: ScopeType.SUPPORT_ADMIN,
        reason: 'User is a core admin',
      };
    }

    // 6. Check organization scope if resource belongs to an organization
    if (organizationId) {
      const orgScope = await this.checkOrganizationScope(userId, organizationId);
      if (orgScope.allowed) {
        return orgScope;
      }
    }

    // 7. Check if resource has an owner and belongs to an organization
    if (ownerId && resourceId) {
      const resource = await this.getResourceWithOwner(resourceType, resourceId);
      if (resource?.organizationId) {
        const orgScope = await this.checkOrganizationScope(userId, resource.organizationId);
        if (orgScope.allowed) {
          return orgScope;
        }
      }
    }

    // User has no valid scope
    return {
      allowed: false,
      scopeType: ScopeType.UNAUTHORIZED,
      reason: 'User does not have permission to access this resource',
    };
  }

  /**
   * Check if a user has access to an organization's resources
   */
  async checkOrganizationScope(userId: string, organizationId: string): Promise<ScopeCheckResult> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!membership) {
      return {
        allowed: false,
        scopeType: ScopeType.UNAUTHORIZED,
        reason: 'User is not a member of this organization',
      };
    }

    // Check if user is org owner
    if (membership.role === 'OWNER') {
      return {
        allowed: true,
        scopeType: ScopeType.ORG_OWNER,
        reason: 'User is the organization owner',
      };
    }

    // Check if user is org admin
    if (membership.role === 'ADMIN') {
      return {
        allowed: true,
        scopeType: ScopeType.ORG_ADMIN,
        reason: 'User is an organization admin',
      };
    }

    // Check if user is org member (limited access)
    if (membership.role === 'MEMBER') {
      return {
        allowed: true,
        scopeType: ScopeType.ORG_MEMBER,
        reason: 'User is an organization member',
      };
    }

    return {
      allowed: false,
      scopeType: ScopeType.UNAUTHORIZED,
      reason: 'User has no valid role in this organization',
    };
  }

  /**
   * Get a resource with its owner and organization information
   */
  private async getResourceWithOwner(resourceType: string, resourceId: string): Promise<any> {
    switch (resourceType) {
      case 'listing':
        return this.prisma.listing.findUnique({
          where: { id: resourceId },
          select: { id: true, ownerId: true, organizationId: true },
        });
      case 'booking':
        return this.prisma.booking.findUnique({
          where: { id: resourceId },
          include: { listing: { select: { ownerId: true, organizationId: true } } },
        });
      case 'dispute':
        return this.prisma.dispute.findUnique({
          where: { id: resourceId },
          include: { booking: { include: { listing: { select: { ownerId: true, organizationId: true } } } } },
        });
      case 'insurance':
        return this.prisma.insurancePolicy.findUnique({
          where: { id: resourceId },
          include: { property: { select: { ownerId: true, organizationId: true } } },
        });
      case 'payout':
        return this.prisma.payout.findUnique({
          where: { id: resourceId },
          select: { id: true, ownerId: true },
        });
      default:
        return null;
    }
  }

  /**
   * Throw an exception if user doesn't have access
   */
  async requireScope(
    userId: string,
    userRole: string,
    context: ResourceContext,
  ): Promise<void> {
    const result = await this.checkScope(userId, userRole, context);
    if (!result.allowed) {
      throw new ForbiddenException(result.reason || 'Access denied');
    }
  }

  /**
   * Get all organizations a user belongs to
   */
  async getUserOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            status: true,
          },
        },
      },
    });

    return memberships.map((m) => ({
      role: m.role,
      organization: m.organization,
    }));
  }

  /**
   * Get all users in an organization with their roles
   */
  async getOrganizationMembers(organizationId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return members.map((m) => ({
      userId: m.userId,
      role: m.role,
      user: m.user,
    }));
  }
}
