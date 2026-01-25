import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EmailService } from '@/common/email/email.service';
import { Organization, OrganizationRole, OrganizationStatus } from '@rental-portal/database';

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
      include: {
        organizations: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already owns an organization
    const existingOrg = user.organizations.find((m) => m.role === OrganizationRole.OWNER);
    if (existingOrg) {
      throw new BadRequestException('User already owns an organization');
    }

    // Create organization
    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        description: dto.description,
        businessType: dto.businessType,
        taxId: dto.taxId,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
        status: OrganizationStatus.ACTIVE,
        ownerId: userId,
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
      throw new NotFoundException('Organization not found');
    }

    // Verify user is a member
    const isMember = organization.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this organization');
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
    await this.verifyMemberPermission(orgId, userId, ['OWNER', 'ADMIN']);

    return this.prisma.organization.update({
      where: { id: orgId },
      data: dto,
    });
  }

  /**
   * Invite member to organization
   */
  async inviteMember(orgId: string, userId: string, dto: InviteMemberDto): Promise<any> {
    await this.verifyMemberPermission(orgId, userId, ['OWNER', 'ADMIN']);

    // Find user by email
    const invitedUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!invitedUser) {
      throw new NotFoundException('User not found with that email');
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
      throw new BadRequestException('User is already a member of this organization');
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

    // Send invitation email
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    if (organization) {
      await this.emailService.sendEmail(
        dto.email,
        'Invitation to join Organization',
        `<p>You have been added to the organization <strong>${organization.name}</strong> as <strong>${dto.role}</strong>.</p>`,
      );
    }

    return member;
  }

  /**
   * Remove member from organization
   */
  async removeMember(orgId: string, userId: string, memberUserId: string): Promise<void> {
    await this.verifyMemberPermission(orgId, userId, ['OWNER', 'ADMIN']);

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
      throw new NotFoundException('Member not found');
    }

    if (member.role === OrganizationRole.OWNER) {
      throw new BadRequestException('Cannot remove organization owner');
    }

    await this.prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: memberUserId,
        },
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
    await this.verifyMemberPermission(orgId, userId, ['OWNER']);

    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: memberUserId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === OrganizationRole.OWNER) {
      throw new BadRequestException('Cannot change owner role');
    }

    return this.prisma.organizationMember.update({
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
      throw new ForbiddenException('Not a member of this organization');
    }

    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(orgId: string, userId: string): Promise<any> {
    await this.verifyMemberPermission(orgId, userId, ['OWNER', 'ADMIN', 'MANAGER']);

    const [totalListings, activeListings, totalBookings, revenue] = await Promise.all([
      this.prisma.listing.count({
        where: { organizationId: orgId },
      }),
      this.prisma.listing.count({
        where: { organizationId: orgId, status: 'ACTIVE' },
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
}
