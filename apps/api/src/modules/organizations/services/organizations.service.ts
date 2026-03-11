import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { i18nNotFound,i18nForbidden,i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EmailService } from '@/common/email/email.service';
import { escapeHtml } from '@/common/utils/sanitize';
import { Organization, OrganizationRole, OrganizationStatus, PropertyStatus } from '@rental-portal/database';

export interface CreateOrganizationDto {
  name: string;
  description?: string;
  businessType: 'INDIVIDUAL' | 'LLC' | 'CORPORATION' | 'PARTNERSHIP';
  taxId?: string;
  email: string;
  phoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  description?: string;
  email?: string;
  phoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  settings?: Record<string, any>;
}

export interface InviteMemberDto {
  email: string;
  role: OrganizationRole;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create organization (professional rental business account)
   */
  async createOrganization(userId: string, dto: CreateOrganizationDto): Promise<Organization> {
    // Verify user exists and doesn't already own an organization
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw i18nNotFound('auth.userNotFound');
    }

    // Check if user already owns an organization
    const existingOrg = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        role: 'OWNER',
      },
    });
    if (existingOrg) {
      throw i18nBadRequest('organization.alreadyOwned');
    }

    const slugBase = dto.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const slug = await this.ensureUniqueSlug(slugBase || 'organization');

    const address = [dto.addressLine1, dto.addressLine2].filter(Boolean).join(', ') || undefined;

    // Create organization
    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        email: dto.email,
        phone: dto.phoneNumber,
        address,
        city: dto.city,
        state: dto.state,
        zipCode: dto.postalCode,
        country: dto.country,
        businessType: dto.businessType,
        ownerId: userId,
        status: OrganizationStatus.ACTIVE,
        members: {
          create: {
            userId,
            role: OrganizationRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
              },
            },
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ORGANIZATION_CREATED',
        entityType: 'Organization',
        entityId: organization.id,
        newValues: JSON.stringify({ name: organization.name, slug: organization.slug }),
      },
    });

    return organization;
  }

  /**
   * Get organization by ID
   */
  async getOrganization(orgId: string, userId: string): Promise<Organization> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
                averageRating: true,
              },
            },
          },
        },
        listings: {
          select: {
            id: true,
            title: true,
            status: true,
            basePrice: true,
            currency: true,
            photos: true,
            city: true,
            state: true,
          },
        },
        _count: {
          select: {
            listings: true,
            members: true,
          },
        },
      },
    });

    if (!organization) {
      throw i18nNotFound('organization.notFound');
    }

    // Verify user is a member
    const isMember = organization.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw i18nForbidden('organization.notMember');
    }

    return organization;
  }

  /**
   * Update organization
   */
  async updateOrganization(
    orgId: string,
    userId: string,
    dto: UpdateOrganizationDto,
  ): Promise<Organization> {
    await this.verifyMemberPermission(orgId, userId, [OrganizationRole.OWNER, OrganizationRole.ADMIN]);

    const address = [dto.addressLine1, dto.addressLine2].filter(Boolean).join(', ') || undefined;
    const mapped: Record<string, any> = {
      name: dto.name,
      description: dto.description,
      email: dto.email,
      phone: dto.phoneNumber,
      website: (dto as { website?: string }).website,
      address,
      city: dto.city,
      state: dto.state,
      zipCode: dto.postalCode,
      country: dto.country,
      settings: dto.settings,
    };

    return this.prisma.organization.update({
      where: { id: orgId },
      data: mapped,
    });
  }

  /**
   * Invite member to organization
   */
  async inviteMember(orgId: string, userId: string, dto: InviteMemberDto): Promise<any> {
    await this.verifyMemberPermission(orgId, userId, [OrganizationRole.OWNER, OrganizationRole.ADMIN]);

    // Find user by email
    const invitedUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!invitedUser) {
      throw i18nNotFound('auth.userNotFound');
    }

    // Check if already a member
    const existingMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: invitedUser.id,
        },
      },
    });

    if (existingMember) {
      throw i18nBadRequest('organization.memberExists');
    }

    // Create member
    const member = await this.prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId: invitedUser.id,
        role: dto.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ORGANIZATION_MEMBER_ADDED',
        entityType: 'Organization',
        entityId: orgId,
        newValues: JSON.stringify({ memberId: invitedUser.id, role: dto.role }),
      },
    });

    // Send invitation email
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    if (organization) {
      await this.emailService.sendEmail(
        dto.email,
        'Invitation to join Organization',
        `<p>You have been added to the organization <strong>${escapeHtml(organization.name)}</strong> as <strong>${escapeHtml(dto.role)}</strong>.</p>`,
      );
    }

    return member;
  }

  /**
   * Remove member from organization
   */
  async removeMember(orgId: string, userId: string, memberUserId: string): Promise<void> {
    await this.verifyMemberPermission(orgId, userId, [OrganizationRole.OWNER, OrganizationRole.ADMIN]);

    // Cannot remove owner
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: memberUserId,
        },
      },
    });

    if (!member) {
      throw i18nNotFound('organization.memberNotFound');
    }

    if (member.role === OrganizationRole.OWNER) {
      throw i18nBadRequest('organization.cannotRemoveOwner');
    }

    await this.prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: memberUserId,
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ORGANIZATION_MEMBER_REMOVED',
        entityType: 'Organization',
        entityId: orgId,
        oldValues: JSON.stringify({ memberId: memberUserId, role: member.role }),
      },
    });
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    orgId: string,
    userId: string,
    memberUserId: string,
    role: OrganizationRole,
  ): Promise<any> {
    await this.verifyMemberPermission(orgId, userId, [OrganizationRole.OWNER]);

    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: memberUserId,
        },
      },
    });

    if (!member) {
      throw i18nNotFound('organization.memberNotFound');
    }

    if (member.role === OrganizationRole.OWNER) {
      throw i18nBadRequest('organization.cannotChangeOwnerRole');
    }

    const updated = await this.prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: memberUserId,
        },
      },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'ORGANIZATION_MEMBER_ROLE_CHANGED',
        entityType: 'Organization',
        entityId: orgId,
        oldValues: JSON.stringify({ memberId: memberUserId, role: member.role }),
        newValues: JSON.stringify({ memberId: memberUserId, role }),
      },
    });

    return updated;
  }

  /**
   * Get user's organizations
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                listings: true,
                members: true,
              },
            },
          },
        },
      },
    });

    return memberships.map((m) => m.organization);
  }

  /**
   * Verify user has permission in organization
   */
  private async verifyMemberPermission(
    orgId: string,
    userId: string,
    allowedRoles: OrganizationRole[],
  ): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    if (!member) {
      throw i18nForbidden('organization.notMember');
    }

    if (!allowedRoles.includes(member.role as OrganizationRole)) {
      throw i18nForbidden('auth.insufficientPermissions');
    }
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(orgId: string, userId: string): Promise<any> {
    await this.verifyMemberPermission(orgId, userId, [OrganizationRole.OWNER, OrganizationRole.ADMIN]);

    const [totalListings, activeListings, totalBookings, revenue] = await Promise.all([
      this.prisma.listing.count({
        where: { organizationId: orgId },
      }),
      this.prisma.listing.count({
        where: { organizationId: orgId, status: PropertyStatus.AVAILABLE },
      }),
      this.prisma.booking.count({
        where: { listing: { organizationId: orgId } },
      }),
      this.prisma.booking.aggregate({
        where: {
          listing: { organizationId: orgId },
          status: { in: ['COMPLETED', 'SETTLED'] },
        },
        _sum: {
          totalPrice: true,
        },
      }),
    ]);

    return {
      totalListings,
      activeListings,
      totalBookings,
      totalRevenue: revenue._sum.totalPrice || 0,
    };
  }

  /**
   * Get organization members (verifies requester is a member)
   */
  async getMembers(orgId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    if (!member) {
      throw i18nForbidden('organization.notMember');
    }
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, profilePhotoUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return { members, total: members.length };
  }

  /**
   * Deactivate (soft-delete) an organization — owner only
   */
  async deactivateOrganization(orgId: string, userId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw i18nNotFound('organization.notFound');
    if (org.ownerId !== userId) throw i18nForbidden('organization.ownerOnlyDeactivate');
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { status: 'SUSPENDED' },
    });
  }

  /**
   * Accept an organization invitation
   */
  async acceptInvitation(userId: string, orgId: string) {
    if (!orgId) throw i18nBadRequest('organization.idOrTokenRequired');
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    if (!membership) throw i18nNotFound('organization.invitationNotFound');
    return { accepted: true, organizationId: orgId };
  }

  /**
   * Decline an organization invitation
   */
  async declineInvitation(userId: string, orgId: string) {
    if (!orgId) throw i18nBadRequest('organization.idOrTokenRequired');

    // Prevent owners from deleting their own membership (would orphan the org)
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    if (!membership) {
      return { declined: true, organizationId: orgId };
    }
    if (membership.role === 'OWNER') {
      throw i18nForbidden('organization.ownerCannotDecline');
    }

    await this.prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    return { declined: true, organizationId: orgId };
  }

  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let suffix = 1;

    while (true) {
      const existing = await this.prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }
}
