import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { i18nNotFound, i18nForbidden } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  UserRole,
  User,
  PropertyStatus,
  VerificationStatus,
  ListingStatus,
  OrganizationStatus,
  BookingStatus,
} from '@rental-portal/database';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verify user is admin.
   * NOTE: The previous dev bypass has been removed for security.
   * Use proper role assignment (ADMIN/SUPER_ADMIN) in all environments.
   */
  private async verifyAdmin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw i18nForbidden('auth.userNotFound');
    }

    const adminRoles: string[] = [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.OPERATIONS_ADMIN,
      UserRole.FINANCE_ADMIN,
      UserRole.SUPPORT_ADMIN,
    ];

    if (!adminRoles.includes(user.role)) {
      throw i18nForbidden('admin.accessRequired');
    }
  }

  /**
   * Get all listings with filters
   */
  async getAllListings(
    userId: string,
    options: {
      status?: ListingStatus;
      categoryId?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ listings: any[]; total: number }> {
    await this.verifyAdmin(userId);

    const { status, categoryId, search, page = 1, limit = 20 } = options;

    const where: any = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          category: true,
          _count: {
            select: {
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return { listings, total };
  }

  /**
   * Get listing by ID (admin)
   */
  async getListingById(adminId: string, listingId: string): Promise<any> {
    await this.verifyAdmin(adminId);
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        owner: {
          select: { id: true, email: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
        category: true,
        _count: { select: { reviews: true, bookings: true } },
      },
    });
    if (!listing) throw i18nNotFound('listing.notFound');
    return listing;
  }

  /**
   * Get listings pending admin approval
   * (status=UNAVAILABLE + verificationStatus=PENDING means submitted by owner)
   */
  async getPendingListings(adminId: string): Promise<{ listings: any[]; total: number }> {
    await this.verifyAdmin(adminId);
    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where: {
          status: PropertyStatus.UNAVAILABLE,
          verificationStatus: VerificationStatus.PENDING,
          deletedAt: null,
        },
        include: {
          owner: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          category: true,
        },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.listing.count({
        where: {
          status: PropertyStatus.UNAVAILABLE,
          verificationStatus: VerificationStatus.PENDING,
          deletedAt: null,
        },
      }),
    ]);
    return { listings, total };
  }

  /**
   * Approve a listing — make it AVAILABLE and mark as VERIFIED
   */
  async approveListing(adminId: string, listingId: string): Promise<any> {
    await this.verifyAdmin(adminId);
    return this.prisma.$transaction(async (tx: any) => {
      const listing = await tx.listing.findUnique({ where: { id: listingId }, select: { status: true, verificationStatus: true } });
      const updated = await tx.listing.update({
        where: { id: listingId },
        data: {
          status: PropertyStatus.AVAILABLE,
          verificationStatus: VerificationStatus.VERIFIED,
        },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          category: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'ADMIN_LISTING_APPROVED',
          entityType: 'Listing',
          entityId: listingId,
          oldValues: JSON.stringify({ status: listing?.status, verificationStatus: listing?.verificationStatus }),
          newValues: JSON.stringify({ status: PropertyStatus.AVAILABLE, verificationStatus: VerificationStatus.VERIFIED }),
        },
      });

      return updated;
    });
  }

  /**
   * Reject a listing — reset it to DRAFT so the owner can fix and resubmit.
   * The optional reason is stored in the listing metadata.
   */
  async rejectListing(adminId: string, listingId: string, reason?: string): Promise<any> {
    await this.verifyAdmin(adminId);
    return this.prisma.$transaction(async (tx: any) => {
      // Read existing metadata to merge in the rejection reason
      const existing = await tx.listing.findUnique({
        where: { id: listingId },
        select: { metadata: true, status: true, verificationStatus: true },
      });
      let meta: Record<string, unknown> = {};
      if (existing?.metadata) {
        try { meta = JSON.parse(existing.metadata as string); } catch { /* ignore */ }
      }
      if (reason) meta.rejectionReason = reason;
      meta.rejectedAt = new Date().toISOString();
      meta.rejectedBy = adminId;
      const updated = await tx.listing.update({
        where: { id: listingId },
        data: {
          status: PropertyStatus.DRAFT,
          verificationStatus: VerificationStatus.REJECTED,
          metadata: JSON.stringify(meta),
        },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          category: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'ADMIN_LISTING_REJECTED',
          entityType: 'Listing',
          entityId: listingId,
          oldValues: JSON.stringify({ status: existing?.status, verificationStatus: existing?.verificationStatus }),
          newValues: JSON.stringify({ status: PropertyStatus.DRAFT, verificationStatus: VerificationStatus.REJECTED, reason }),
        },
      });

      return updated;
    });
  }

  /**
   * Update listing status (generic — for admin status overrides)
   */
  async updateListingStatus(
    adminId: string,
    listingId: string,
    status: ListingStatus,
    reason?: string,
  ): Promise<any> {
    await this.verifyAdmin(adminId);
    // Map ListingStatus to PropertyStatus where possible
    const statusMap: Partial<Record<ListingStatus, PropertyStatus>> = {
      [ListingStatus.ACTIVE]: PropertyStatus.AVAILABLE,
      [ListingStatus.PUBLISHED]: PropertyStatus.AVAILABLE,
      [ListingStatus.INACTIVE]: PropertyStatus.UNAVAILABLE,
      [ListingStatus.SUSPENDED]: PropertyStatus.SUSPENDED,
      [ListingStatus.ARCHIVED]: PropertyStatus.ARCHIVED,
      [ListingStatus.DRAFT]: PropertyStatus.DRAFT,
    };
    const mappedStatus = statusMap[status];
    const updateData: any = mappedStatus ? { status: mappedStatus } : {};
    const oldListing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { status: true, metadata: true } });
    // Store reason in metadata if provided
    if (reason) {
      let meta: Record<string, unknown> = {};
      try { if (oldListing?.metadata) meta = JSON.parse(oldListing.metadata as string); } catch { /* ignore */ }
      meta.adminStatusReason = reason;
      updateData.metadata = JSON.stringify(meta);
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADMIN_LISTING_STATUS_UPDATED',
        entityType: 'Listing',
        entityId: listingId,
        oldValues: JSON.stringify({ status: oldListing?.status }),
        newValues: JSON.stringify({ status: mappedStatus, reason }),
      },
    });

    return updated;
  }

  /**
   * Delete listing (soft delete)
   */
  async deleteListing(adminId: string, listingId: string): Promise<void> {
    await this.verifyAdmin(adminId);

    const existing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { status: true } });
    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status: PropertyStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADMIN_LISTING_DELETED',
        entityType: 'Listing',
        entityId: listingId,
        oldValues: JSON.stringify({ status: existing?.status }),
        newValues: JSON.stringify({ status: PropertyStatus.ARCHIVED }),
      },
    });
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(
    userId: string,
    options: {
      action?: string;
      userId?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<any> {
    await this.verifyAdmin(userId);

    const { action, userId: targetUserId, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (action) where.action = action;
    if (targetUserId) where.userId = targetUserId;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all organizations
   */
  async getAllOrganizations(
    adminId: string,
    options: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<any> {
    await this.verifyAdmin(adminId);

    const { search, status, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [{ name: { contains: search, mode: 'insensitive' } }];
    }

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          members: {
            where: { role: 'OWNER' },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
            take: 1,
          },
          _count: { select: { members: true } },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      organizations: organizations.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        status: o.status,
        owner: o.members[0]?.user || { firstName: 'Unknown', lastName: 'Owner' },
        stats: {
          membersCount: o._count?.members || 0,
        },
        createdAt: o.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateOrganizationStatus(adminId: string, orgId: string, status: OrganizationStatus): Promise<any> {
    await this.verifyAdmin(adminId);
    const existing = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { status: true } });
    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'ADMIN_ORG_STATUS_UPDATED',
        entityType: 'Organization',
        entityId: orgId,
        oldValues: JSON.stringify({ status: existing?.status }),
        newValues: JSON.stringify({ status }),
      },
    });

    return updated;
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(adminId: string, orgId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        _count: { select: { members: true, listings: true } },
      },
    });

    if (!organization) {
      throw i18nNotFound('organization.notFound');
    }

    return {
      ...organization,
      memberCount: organization._count.members,
      listingCount: organization._count.listings,
    };
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(adminId: string, orgId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      members: members.map((m) => ({
        id: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        role: m.role,
        status: m.user.status,
        joinedAt: m.joinedAt,
      })),
    };
  }

  /**
   * Get all categories
   */
  async getAllCategories(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: {
            listings: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return { categories };
  }

  /**
   * Get all bookings
   */
  async getAllBookings(
    adminId: string,
    options: {
      status?: string;
      listingId?: string;
      renterId?: string;
      ownerId?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<any> {
    await this.verifyAdmin(adminId);

    const {
      status,
      listingId,
      renterId,
      ownerId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (listingId) where.listingId = listingId;
    if (renterId) where.renterId = renterId;
    if (ownerId) where.listing = { ownerId };
    if (startDate && endDate) {
      where.startDate = { gte: startDate };
      where.endDate = { lte: endDate };
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              owner: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          renter: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      bookings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get booking by ID
   */
  async getBookingById(adminId: string, bookingId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: {
          include: {
            owner: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        renter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        payments: true,
      },
    });

    if (!booking) {
      throw i18nNotFound('booking.notFound');
    }

    return booking;
  }

  /**
   * Get booking calendar
   */
  async getBookingCalendar(adminId: string, month?: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const targetMonth = month ? new Date(month) : new Date();
    const startDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

    const bookings = await this.prisma.booking.findMany({
      where: {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: {
        listing: {
          select: { id: true, title: true },
        },
        renter: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    return { bookings, month: targetMonth.toISOString() };
  }

  /**
   * Admin force-set booking status — bypasses the state machine.
   * Used in test environments (E2E) to place a booking in a specific state
   * without going through Stripe or real payment flows.
   *
   * Only accessible by ADMIN/SUPER_ADMIN roles (enforced at controller level).
   */
  async forceSetBookingStatus(
    adminId: string,
    bookingId: string,
    status: string,
  ): Promise<any> {
    await this.verifyAdmin(adminId);

    const validStatuses = Object.values(BookingStatus);
    if (!validStatuses.includes(status as BookingStatus)) {
      throw new BadRequestException(
        `Invalid booking status. Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw i18nNotFound('booking.notFound');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: status as BookingStatus,
        updatedAt: new Date(),
      },
    });

    return {
      ...updated,
      _adminOverride: true,
      _overriddenBy: adminId,
    };
  }

  /**
   * Get all payments
   */
  async getAllPayments(
    adminId: string,
    options: {
      status?: string;
      method?: string;
      startDate?: Date;
      endDate?: Date;
      minAmount?: number;
      maxAmount?: number;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<any> {
    await this.verifyAdmin(adminId);

    const {
      status,
      method,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      page = 1,
      limit = 20,
    } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (method) where.paymentMethod = method;
    if (startDate) where.createdAt = { ...where.createdAt, gte: startDate };
    if (endDate) where.createdAt = { ...where.createdAt, lte: endDate };
    if (minAmount) where.amount = { ...where.amount, gte: minAmount };
    if (maxAmount) where.amount = { ...where.amount, lte: maxAmount };

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              renter: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        method: p.paymentMethod,
        bookingId: p.bookingId,
        user: p.booking?.renter,
        fee: p.fee,
        netAmount: p.netAmount,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(adminId: string, paymentId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          select: {
            id: true,
            renter: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!payment) {
      throw i18nNotFound('payment.notFound');
    }

    return {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      method: payment.paymentMethod,
      bookingId: payment.bookingId,
      user: payment.booking?.renter,
      createdAt: payment.createdAt,
      transactionId: payment.paymentIntentId,
      fee: payment.fee,
      netAmount: payment.netAmount,
    };
  }

  /**
   * Get all refunds
   */
  async getAllRefunds(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const refunds = await this.prisma.refund.findMany({
      include: {
        booking: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { refunds };
  }

  /**
   * Get all payouts
   */
  async getAllPayouts(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const payouts = await this.prisma.payout.findMany({
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        recipient: p.owner ? `${p.owner.firstName} ${p.owner.lastName}` : 'Unknown',
        processedAt: p.processedAt,
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Get financial ledger
   */
  async getFinancialLedger(
    adminId: string,
    options: {
      page?: number;
      limit?: number;
    } = {},
  ): Promise<any> {
    await this.verifyAdmin(adminId);

    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        include: {
          booking: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ledgerEntry.count(),
    ]);

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.transactionType,
        description: t.description,
        amount: t.side === 'DEBIT' ? t.amount : t.amount,
        currency: t.currency,
        status: t.status,
        bookingId: t.bookingId,
        date: t.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
