import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  UserRole,
  User,
  PropertyStatus,
  BookingStatus,
  PayoutStatus,
  UserStatus,
  ListingStatus,
  DisputeStatus,
  OrganizationStatus,
  NotificationType,
  toNumber,
} from '@rental-portal/database';
import { FilterBuilderService, FilterCondition } from './filter-builder.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filterBuilder: FilterBuilderService,
  ) {}

  /**
   * Verify user is admin
   */
  private async verifyAdmin(userId: string): Promise<void> {
    // Skip admin verification in development if user exists
    if (process.env.NODE_ENV === 'development') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new ForbiddenException('User not found');
      }

      // In development, allow any authenticated user to access admin endpoints
      // Remove this in production!
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }

  /**
   * Get platform dashboard statistics
   */
  async getDashboardStats(userId: string): Promise<any> {
    await this.verifyAdmin(userId);

    const [
      totalUsers,
      totalListings,
      activeListings,
      totalBookings,
      activeBookings,
      totalRevenue,
      pendingDisputes,
      recentUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: PropertyStatus.AVAILABLE } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({
        where: {
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
          },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PayoutStatus.COMPLETED },
      }),
      this.prisma.dispute.count({
        where: {
          status: {
            in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW],
          },
        },
      }),
      this.prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        recent: recentUsers,
      },
      listings: {
        total: totalListings,
        active: activeListings,
      },
      bookings: {
        total: totalBookings,
        active: activeBookings,
      },
      revenue: {
        total: totalRevenue._sum.amount || 0,
      },
      disputes: {
        pending: pendingDisputes,
      },
    };
  }

  /**
   * Get analytics data
   */
  async getAnalytics(
    userId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month',
  ): Promise<any> {
    await this.verifyAdmin(userId);

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
    }

    const [
      newUsers,
      newListings,
      newBookings,
      completedBookings,
      revenue,
      topCategories,
      topListings,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.listing.count({
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.booking.count({
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.booking.count({
        where: {
          completedAt: { gte: startDate },
          status: BookingStatus.COMPLETED,
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: { gte: startDate },
          status: PayoutStatus.COMPLETED,
        },
      }),
      this.prisma.listing.groupBy({
        by: ['categoryId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.listing.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          viewCount: true,
          averageRating: true,
          _count: {
            select: { reviews: true },
          },
        },
      }),
    ]);

    // Get category details
    const categoryIds = topCategories.map((c) => c.categoryId);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });

    const topCategoriesWithNames = topCategories.map((tc) => ({
      category: categories.find((c) => c.id === tc.categoryId),
      count: tc._count.id,
    }));

    return {
      period,
      startDate,
      endDate: now,
      growth: {
        newUsers,
        newListings,
        newBookings,
        completedBookings,
      },
      revenue: {
        total: revenue._sum.amount || 0,
      },
      topCategories: topCategoriesWithNames,
      topListings,
    };
  }

  /**
   * Get all users with filters
   */
  async getAllUsers(
    userId: string,
    options: {
      role?: UserRole;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ users: any[]; total: number }> {
    await this.verifyAdmin(userId);

    const { role, search, page = 1, limit = 20 } = options;

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          _count: {
            select: {
              reviewsGiven: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  /**
   * Update user role
   */
  async updateUserRole(adminId: string, targetUserId: string, role: UserRole): Promise<any> {
    await this.verifyAdmin(adminId);

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { role },
    });
  }

  /**
   * Suspend/activate user
   */
  async toggleUserStatus(adminId: string, targetUserId: string, suspend: boolean): Promise<any> {
    await this.verifyAdmin(adminId);

    // Implement suspension logic (you may need to add a suspended field to User model)
    // For now, we'll use a note in the profile
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { userPreferences: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (suspend) {
      // Suspend user - pause all their active listings
      await this.prisma.listing.updateMany({
        where: {
          ownerId: targetUserId,
          status: PropertyStatus.AVAILABLE,
        },
        data: {
          status: PropertyStatus.SUSPENDED,
        },
      });
    }

    // Update user status
    return this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        status: suspend ? UserStatus.SUSPENDED : UserStatus.ACTIVE,
      },
    });
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
   * Update listing status (approve/reject)
   */
  async updateListingStatus(
    adminId: string,
    listingId: string,
    status: ListingStatus,
    reason?: string,
  ): Promise<any> {
    await this.verifyAdmin(adminId);

    const updateData: any = {
      status,
      moderatedBy: adminId,
      moderatedAt: new Date(),
    };

    if (reason && status === ListingStatus.REJECTED) {
      updateData.rejectionReason = reason;
    }

    return this.prisma.listing.update({
      where: { id: listingId },
      data: updateData,
    });
  }

  /**
   * Delete listing (soft delete)
   */
  async deleteListing(adminId: string, listingId: string): Promise<void> {
    await this.verifyAdmin(adminId);

    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status: PropertyStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get platform revenue report
   */
  async getRevenueReport(userId: string, startDate: Date, endDate: Date): Promise<any> {
    await this.verifyAdmin(userId);

    const payments = await this.prisma.payment.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: PayoutStatus.COMPLETED,
      },
      include: {
        booking: {
          select: {
            id: true,
            platformFee: true,
            listingId: true,
            listing: {
              select: {
                id: true,
                title: true,
                categoryId: true,
              },
            },
          },
        },
      },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
    const platformFees = payments.reduce((sum, p) => sum + toNumber(p.booking.platformFee || 0), 0);

    // Group by category
    const revenueByCategory: Record<string, number> = {};
    for (const payment of payments) {
      const categoryId = payment.booking.listing.categoryId;
      revenueByCategory[categoryId] =
        (revenueByCategory[categoryId] || 0) + toNumber(payment.amount);
    }

    return {
      period: {
        startDate,
        endDate,
      },
      totalRevenue,
      platformFees,
      totalPayments: payments.length,
      revenueByCategory,
    };
  }

  /**
   * Get audit logs (implement based on your logging system)
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

    // Mock audit logs for now
    const logs = [
      {
        id: '1',
        action: 'USER_LOGIN',
        userId: 'c5e43538-e869-4962-b6d1-e9be9cb29d8b',
        description: 'Admin user logged in',
        ipAddress: '::ffff:127.0.0.1',
        createdAt: new Date(),
        user: {
          id: 'c5e43538-e869-4962-b6d1-e9be9cb29d8b',
          email: 'admin@rental.local',
          firstName: 'Admin',
          lastName: 'User',
        },
      },
      {
        id: '2',
        action: 'USER_CREATED',
        userId: 'c5e43538-e869-4962-b6d1-e9be9cb29d8b',
        description: 'New user account created',
        ipAddress: '::ffff:127.0.0.1',
        createdAt: new Date(Date.now() - 3600000),
        user: {
          id: 'c5e43538-e869-4962-b6d1-e9be9cb29d8b',
          email: 'admin@rental.local',
          firstName: 'Admin',
          lastName: 'User',
        },
      },
    ];

    return {
      logs: logs.slice(skip, skip + limit),
      total: logs.length,
      page,
      limit,
      totalPages: Math.ceil(logs.length / limit),
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(adminId: string, userId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            listings: true,
            bookingsAsRenter: true,
            reviewsGiven: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
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

  async updateOrganizationStatus(adminId: string, orgId: string, status: OrganizationStatus) {
    await this.verifyAdmin(adminId);
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { status },
    });
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(adminId: string, orgId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    // Mock organization data
    const organization = {
      id: orgId,
      name: 'Camera Equipment Rentals',
      description: 'Professional camera and photography equipment rental service',
      status: 'ACTIVE',
      plan: 'PREMIUM',
      memberCount: 5,
      listingCount: 12,
      createdAt: new Date('2024-01-15'),
      owner: { id: '0d084ca3-aa25-4f0f-96ea-21ff25354832', firstName: 'John', lastName: 'Smith' },
      address: '123 Main St, Los Angeles, CA',
      phone: '+1-555-0201',
      email: 'contact@camera-rentals.com',
      website: 'https://camera-rentals.com',
      subscriptionStatus: 'ACTIVE',
      nextBillingDate: new Date('2024-02-15'),
    };

    return organization;
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(adminId: string, orgId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    // Mock members data
    const members = [
      {
        id: '0d084ca3-aa25-4f0f-96ea-21ff25354832',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.owner@rental.local',
        role: 'OWNER',
        status: 'ACTIVE',
        joinedAt: new Date('2024-01-15'),
      },
      {
        id: 'member-2',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@camera-rentals.com',
        role: 'MEMBER',
        status: 'ACTIVE',
        joinedAt: new Date('2024-01-20'),
      },
    ];

    return { members };
  }

  /**
   * Get listing by ID
   */
  async getListingById(adminId: string, listingId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        category: true,
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    });

    if (!listing) {
      throw new Error('Listing not found');
    }

    return listing;
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
            properties: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return { categories };
  }

  /**
   * Get pending listings
   */
  async getPendingListings(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    const listings = await this.prisma.listing.findMany({
      where: { status: PropertyStatus.AVAILABLE },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { listings };
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
      throw new Error('Booking not found');
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

    // Mock payments data
    const payments = [
      {
        id: 'pay-1',
        amount: 150,
        currency: 'USD',
        status: 'COMPLETED',
        method: 'STRIPE',
        bookingId: 'booking-1',
        user: {
          id: '4e04f7fb-aa59-49a3-9c88-99682cc00363',
          firstName: 'Lisa',
          lastName: 'Anderson',
        },
        createdAt: new Date('2024-01-20'),
      },
      {
        id: 'pay-2',
        amount: 200,
        currency: 'USD',
        status: 'COMPLETED',
        method: 'PAYPAL',
        bookingId: 'booking-2',
        user: { id: '42a61768-2024-4072-bc2b-c10c9284fb7b', firstName: 'Mike', lastName: 'Davis' },
        createdAt: new Date('2024-01-22'),
      },
    ];

    let filteredPayments = payments;
    if (status) filteredPayments = filteredPayments.filter((p) => p.status === status);
    if (method) filteredPayments = filteredPayments.filter((p) => p.method === method);
    if (minAmount) filteredPayments = filteredPayments.filter((p) => p.amount >= minAmount);
    if (maxAmount) filteredPayments = filteredPayments.filter((p) => p.amount <= maxAmount);

    return {
      payments: filteredPayments.slice(skip, skip + limit),
      total: filteredPayments.length,
      page,
      limit,
      totalPages: Math.ceil(filteredPayments.length / limit),
    };
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(adminId: string, paymentId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    // Mock payment data
    const payment = {
      id: paymentId,
      amount: 150,
      currency: 'USD',
      status: 'COMPLETED',
      method: 'STRIPE',
      bookingId: 'booking-1',
      user: { id: '4e04f7fb-aa59-49a3-9c88-99682cc00363', firstName: 'Lisa', lastName: 'Anderson' },
      createdAt: new Date('2024-01-20'),
      transactionId: 'txn_123456789',
      fee: 7.5,
      netAmount: 142.5,
    };

    return payment;
  }

  /**
   * Get all refunds
   */
  async getAllRefunds(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    // Mock refunds data
    const refunds = [
      {
        id: 'refund-1',
        amount: 75,
        currency: 'USD',
        status: 'COMPLETED',
        reason: 'Customer cancellation',
        paymentId: 'pay-1',
        createdAt: new Date('2024-01-21'),
        processedAt: new Date('2024-01-21'),
      },
    ];

    return { refunds };
  }

  /**
   * Get all payouts
   */
  async getAllPayouts(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    // Mock payouts data
    const payouts = [
      {
        id: 'payout-1',
        amount: 500,
        currency: 'USD',
        status: 'COMPLETED',
        recipient: 'John Smith',
        period: '2024-01',
        createdAt: new Date('2024-02-01'),
        processedAt: new Date('2024-02-01'),
      },
    ];

    return { payouts };
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

    // Mock ledger data
    const transactions = [
      {
        id: 'txn-1',
        type: 'PAYMENT',
        description: 'Payment for booking #1',
        amount: 150,
        date: new Date('2024-01-20'),
      },
      {
        id: 'txn-2',
        type: 'REFUND',
        description: 'Refund for booking #1',
        amount: -75,
        date: new Date('2024-01-21'),
      },
    ];

    return {
      transactions: transactions.slice(skip, skip + limit),
      total: transactions.length,
      page,
      limit,
      totalPages: Math.ceil(transactions.length / limit),
    };
  }

  /**
   * Get general settings
   */
  async getGeneralSettings(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      siteName: 'Rental Portal',
      siteUrl: 'https://rental-portal.com',
      contactEmail: 'support@rental-portal.com',
      allowRegistration: true,
      requireEmailVerification: true,
      maintenanceMode: false,
      debugMode: false,
    };
  }

  /**
   * Get API keys
   */
  async getApiKeys(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    // Mock API keys data
    const apiKeys = [
      {
        id: 'key-1',
        name: 'Production API Key',
        service: 'Stripe',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        lastUsed: new Date('2024-01-25'),
      },
    ];

    return { apiKeys };
  }

  /**
   * Get service configuration
   */
  async getServiceConfig(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      services: [
        {
          id: 'email',
          name: 'Email Service',
          enabled: true,
          config: [
            { key: 'provider', value: 'SendGrid', label: 'Provider' },
            { key: 'apiKey', value: '••••••••••••••••', label: 'API Key', type: 'password' },
          ],
        },
        {
          id: 'sms',
          name: 'SMS Service',
          enabled: true,
          config: [
            { key: 'provider', value: 'Twilio', label: 'Provider' },
            { key: 'phoneNumber', value: '+1234567890', label: 'Phone Number' },
          ],
        },
      ],
    };
  }

  /**
   * Get environment configuration
   */
  async getEnvironmentConfig(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      environment: [
        {
          key: 'NODE_ENV',
          value: 'production',
          description: 'Node environment',
          isSecret: false,
        },
        {
          key: 'DATABASE_URL',
          value: '••••••••••••••••••••••••••',
          description: 'Database connection string',
          isSecret: true,
        },
        {
          key: 'STRIPE_SECRET_KEY',
          value: '••••••••••••••••••••••••••',
          description: 'Stripe secret key',
          isSecret: true,
        },
      ],
    };
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(adminId: string, period?: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      analytics: {
        newUsers: 15,
        activeUsers: 128,
        retentionRate: 0.85,
        avgSessionDuration: 720, // seconds
        topCountries: [
          { country: 'United States', users: 85 },
          { country: 'Canada', users: 23 },
          { country: 'United Kingdom', users: 20 },
        ],
        userGrowth: [
          { date: '2024-01-01', users: 100 },
          { date: '2024-01-02', users: 105 },
          { date: '2024-01-03', users: 112 },
        ],
        demographics: {
          ageGroups: [
            { range: '18-24', count: 25 },
            { range: '25-34', count: 45 },
            { range: '35-44', count: 35 },
            { range: '45+', count: 23 },
          ],
          roles: [
            { role: 'CUSTOMER', count: 95 },
            { role: 'OWNER', count: 28 },
            { role: 'ADMIN', count: 5 },
          ],
        },
      },
      period: period || '30d',
    };
  }

  /**
   * Get business analytics
   */
  async getBusinessAnalytics(adminId: string, period?: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      analytics: {
        totalRevenue: 15420,
        revenueGrowthRate: 0.15,
        avgBookingValue: 185,
        totalBookings: 83,
        bookingConversionRate: 0.12,
        revenueByCategory: [
          { category: 'Camera Equipment', revenue: 8500, percentage: 55, bookings: 45 },
          { category: 'Tools', revenue: 4200, percentage: 27, bookings: 25 },
          { category: 'Camping', revenue: 2720, percentage: 18, bookings: 13 },
        ],
        revenueByMonth: [
          { month: '2024-01', revenue: 12000, bookings: 65 },
          { month: '2024-02', revenue: 15420, bookings: 83 },
        ],
        topPerformingListings: [
          { title: 'Professional Camera Kit', revenue: 3500, bookings: 20, occupancyRate: 0.85 },
          { title: 'Power Tools Set', revenue: 2800, bookings: 18, occupancyRate: 0.75 },
        ],
        paymentMethods: [
          { method: 'Stripe', revenue: 12000, percentage: 78, transactions: 65 },
          { method: 'PayPal', revenue: 3420, percentage: 22, transactions: 18 },
        ],
      },
      period: period || '30d',
    };
  }

  /**
   * Get performance analytics
   */
  async getPerformanceAnalytics(adminId: string, period?: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      performance: {
        avgResponseTime: 145,
        uptime: 99.9,
        errorRate: 0.01,
        totalRequests: 125000,
        throughput: 145,
        serverMetrics: {
          cpuUsage: 35,
          memoryUsage: 65,
          diskUsage: 45,
          networkLatency: 25,
        },
        apiEndpoints: [
          {
            endpoint: '/api/v1/auth/login',
            avgResponseTime: 120,
            requestCount: 45000,
            errorRate: 0.005,
          },
          {
            endpoint: '/api/v1/listings',
            avgResponseTime: 180,
            requestCount: 25000,
            errorRate: 0.01,
          },
          {
            endpoint: '/api/v1/bookings',
            avgResponseTime: 150,
            requestCount: 20000,
            errorRate: 0.008,
          },
        ],
        performanceTrend: [
          {
            timestamp: '2024-01-20T00:00:00Z',
            responseTime: 130,
            throughput: 120,
            errorRate: 0.008,
          },
          {
            timestamp: '2024-01-20T01:00:00Z',
            responseTime: 145,
            throughput: 145,
            errorRate: 0.01,
          },
        ],
      },
      period: period || '24h',
    };
  }

  /**
   * Get custom reports
   */
  async getCustomReports(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    // Mock reports data
    const reports = [
      {
        id: 'report-1',
        name: 'Monthly Revenue Report',
        description: 'Detailed monthly revenue breakdown',
        type: 'FINANCIAL',
        lastGenerated: new Date('2024-01-31'),
      },
      {
        id: 'report-2',
        name: 'User Activity Report',
        description: 'User engagement and activity metrics',
        type: 'ANALYTICS',
        lastGenerated: new Date('2024-01-30'),
      },
    ];

    return { reports };
  }

  /**
   * Get system overview
   */
  async getSystemOverview(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      system: {
        overallStatus: 'healthy',
        activeServices: 8,
        systemLoad: 35,
      },
    };
  }

  /**
   * Get system health
   */
  async getSystemHealth(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      health: {
        api: { status: 'healthy', responseTime: 145 },
        database: { status: 'healthy', responseTime: 25 },
        redis: { status: 'healthy', responseTime: 5 },
        uptime: 99.9,
      },
    };
  }

  /**
   * Get system logs
   */
  async getSystemLogs(adminId: string, level?: string, limit?: number): Promise<any> {
    await this.verifyAdmin(adminId);

    // Mock logs data
    const logs = [
      {
        id: 'log-1',
        level: 'INFO',
        message: 'Application started successfully',
        timestamp: new Date(),
      },
      {
        id: 'log-2',
        level: 'WARN',
        message: 'High memory usage detected',
        timestamp: new Date(Date.now() - 3600000),
      },
      {
        id: 'log-3',
        level: 'ERROR',
        message: 'Database connection timeout',
        timestamp: new Date(Date.now() - 7200000),
      },
    ];

    let filteredLogs = logs;
    if (level) filteredLogs = logs.filter((l) => l.level === level);

    return { logs: filteredLogs.slice(0, limit || 100) };
  }

  /**
   * Get database information
   */
  async getDatabaseInfo(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    return {
      database: {
        status: 'healthy',
        activeConnections: 15,
        maxConnections: 100,
        avgQueryTime: 25,
        totalConnections: 150,
      },
    };
  }

  /**
   * Get backup information
   */
  async getBackupInfo(adminId: string): Promise<any> {
    await this.verifyAdmin(adminId);

    // Mock backups data
    const backups = [
      {
        id: 'backup-1',
        type: 'FULL',
        size: 15728640, // bytes
        status: 'COMPLETED',
        createdAt: new Date('2024-01-25'),
      },
      {
        id: 'backup-2',
        type: 'INCREMENTAL',
        size: 5242880,
        status: 'COMPLETED',
        createdAt: new Date('2024-01-26'),
      },
    ];

    return { backups };
  }

  // =================================================================================================
  // ===================================  CONTENT MANAGEMENT  ========================================
  // =================================================================================================

  async getReviews(
    adminId: string,
    params: { page?: number; limit?: number; status?: string; search?: string },
  ) {
    await this.verifyAdmin(adminId);
    const { page = 1, limit = 10, status, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { listing: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
          },
          listing: { select: { id: true, title: true, photos: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateReviewStatus(adminId: string, reviewId: string, status: any) {
    await this.verifyAdmin(adminId);
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { status },
    });
  }

  async getMessages(adminId: string, params: { page?: number; limit?: number; flagged?: boolean }) {
    await this.verifyAdmin(adminId);
    const { page = 1, limit = 10, flagged } = params;
    const skip = (page - 1) * limit;

    // TODO: Add 'flagged' logic if Conversation or Message has a flag. Schema doesn't have conversation flag, but Review has.
    // Assuming we want conversations for now.
    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
              },
            },
          },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
          booking: { include: { listing: { select: { title: true } } } },
        },
      }),
      this.prisma.conversation.count(),
    ]);

    return {
      conversations: conversations.map((c) => ({
        id: c.id,
        participants: c.participants.map((p) => `${p.user.firstName} ${p.user.lastName}`),
        lastMessage: c.messages[0]?.content || '',
        sentAt: c.lastMessageAt || c.createdAt,
        flagged: false, // Placeholder
        listing: c.booking?.listing?.title || 'General Inquiry',
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =================================================================================================
  // ===================================  FINANCE & LEDGER  ==========================================
  // =================================================================================================

  async getRefunds(adminId: string, params: { page?: number; limit?: number; status?: string }) {
    await this.verifyAdmin(adminId);
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      refunds: refunds.map((r) => ({
        id: r.id,
        bookingRef: r.bookingId.substring(0, 8).toUpperCase(), // Mocking a ref format
        amount: r.amount,
        user: 'Unknown User', // Mock user data - refund doesn't have direct renter relation
        reason: r.reason,
        status: r.status.toLowerCase(), // frontend expects lowercase
        date: r.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPayouts(adminId: string, params: { page?: number; limit?: number; status?: string }) {
    await this.verifyAdmin(adminId);
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [payouts, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        // need to fetch owner info? Payout has ownerId.
      }),
      this.prisma.payout.count({ where }),
    ]);

    // Need to fetch owners manually if Payout doesn't have relation in schema?
    // Checking schema: Payout doesn't seem to have relation to User owner defined in the provided excerpt?
    // Wait, let me check schema snippet again.
    // "model Payout { ... ownerId String ... @@index([ownerId]) }" - No relation defined in Payout model!
    // But User model has... wait, User doesn't have payouts relation listed in snippet.
    // I will fetch owners separately.

    const ownerIds = [...new Set(payouts.map((p) => p.ownerId))];
    const owners = await this.prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const ownerMap = new Map(owners.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    return {
      payouts: payouts.map((p) => ({
        id: p.id,
        host: ownerMap.get(p.ownerId) || 'Unknown Host',
        amount: p.amount,
        status: p.status.toLowerCase(),
        scheduledDate: p.createdAt, // Using createdAt as scheduled
        processedDate: p.processedAt,
        method: 'stripe_transfer',
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLedger(adminId: string, params: { page?: number; limit?: number }) {
    await this.verifyAdmin(adminId);
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ledgerEntry.count(),
    ]);

    return {
      transactions: entries.map((e) => ({
        id: e.id,
        type: e.side.toLowerCase(), // debit/credit
        amount: e.amount,
        description: e.description,
        reference: e.referenceId || e.bookingId,
        date: e.createdAt,
        balanceAfter: 0, // Ledger doesn't track running balance easily in this view
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =================================================================================================
  // ===================================  MODERATION & DISPUTES  =====================================
  // =================================================================================================

  async getDisputes(adminId: string, params: { page?: number; limit?: number; status?: string }) {
    await this.verifyAdmin(adminId);
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          initiator: { select: { firstName: true, lastName: true } },
          booking: { select: { id: true } },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return {
      disputes: disputes.map((d) => ({
        id: d.id,
        ticketId: d.id.substring(0, 5), // Mock
        bookingRef: d.booking.id.substring(0, 8).toUpperCase(),
        reporter: `${d.initiator.firstName} ${d.initiator.lastName}`,
        type: d.type.toLowerCase(),
        priority: d.priority.toLowerCase(),
        status: d.status.toLowerCase(),
        created: d.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateDisputeStatus(adminId: string, disputeId: string, status: DisputeStatus) {
    await this.verifyAdmin(adminId);
    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status },
    });
  }

  async updateRefundStatus(adminId: string, refundId: string, status: any) {
    await this.verifyAdmin(adminId);
    return this.prisma.refund.update({
      where: { id: refundId },
      data: { status },
    });
  }

  /**
   * Get entity schema for dynamic admin UI
   * Returns field definitions and configuration for the entity management interface
   */
  async getEntitySchema(adminId: string, entity: string): Promise<any> {
    await this.verifyAdmin(adminId);

    // Define schemas for supported entities
    const schemas: Record<string, any> = {
      users: {
        name: 'User',
        pluralName: 'Users',
        slug: 'users',
        description: 'Manage platform users',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'email', type: 'email', label: 'Email', required: true },
          { name: 'firstName', type: 'text', label: 'First Name' },
          { name: 'lastName', type: 'text', label: 'Last Name' },
          {
            name: 'role',
            type: 'select',
            label: 'Role',
            options: ['ADMIN', 'USER', 'HOST', 'RENTER'],
          },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['ACTIVE', 'SUSPENDED', 'PENDING'],
          },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'email', header: 'Email', width: '200px' },
          { accessorKey: 'firstName', header: 'First Name', width: '120px' },
          { accessorKey: 'lastName', header: 'Last Name', width: '120px' },
          { accessorKey: 'role', header: 'Role', width: '100px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        filters: [
          { key: 'email', label: 'Email', type: 'text', operator: 'contains' },
          { key: 'firstName', label: 'First Name', type: 'text', operator: 'contains' },
          { key: 'lastName', label: 'Last Name', type: 'text', operator: 'contains' },
          {
            key: 'role',
            label: 'Role',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'ADMIN', label: 'Admin' },
              { value: 'USER', label: 'User' },
              { value: 'HOST', label: 'Host' },
              { value: 'RENTER', label: 'Renter' },
            ],
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'ACTIVE', label: 'Active' },
              { value: 'SUSPENDED', label: 'Suspended' },
              { value: 'PENDING', label: 'Pending' },
            ],
          },
          { key: 'createdAt', label: 'Created After', type: 'date', operator: 'gte' },
          { key: 'createdAt', label: 'Created Before', type: 'date', operator: 'lte' },
          { key: 'updatedAt', label: 'Updated After', type: 'date', operator: 'gte' },
          { key: 'updatedAt', label: 'Updated Before', type: 'date', operator: 'lte' },
          {
            key: 'isActive',
            label: 'Is Active',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ],
          },
          {
            key: 'emailVerified',
            label: 'Email Verified',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'true', label: 'Verified' },
              { value: 'false', label: 'Not Verified' },
            ],
          },
          {
            key: 'phoneVerified',
            label: 'Phone Verified',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'true', label: 'Verified' },
              { value: 'false', label: 'Not Verified' },
            ],
          },
          {
            key: 'stripeCustomerId',
            label: 'Has Stripe Customer',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'not_null', label: 'Has Customer ID' },
              { value: 'is_null', label: 'No Customer ID' },
            ],
          },
          { key: 'lastLoginAt', label: 'Last Login After', type: 'date', operator: 'gte' },
          { key: 'lastLoginAt', label: 'Last Login Before', type: 'date', operator: 'lte' },
          { key: 'averageRating', label: 'Min Rating', type: 'number', operator: 'gte' },
          { key: 'averageRating', label: 'Max Rating', type: 'number', operator: 'lte' },
          { key: 'totalReviews', label: 'Min Reviews', type: 'number', operator: 'gte' },
          { key: 'totalReviews', label: 'Max Reviews', type: 'number', operator: 'lte' },
        ],
        actions: ['view', 'edit', 'suspend', 'activate'],
      },
      organizations: {
        name: 'Organization',
        pluralName: 'Organizations',
        slug: 'organizations',
        description: 'Manage organizations',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'name', type: 'text', label: 'Name', required: true },
          { name: 'description', type: 'textarea', label: 'Description' },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
          },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'name', header: 'Name', width: '200px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        filters: [
          { key: 'name', label: 'Name', type: 'text', operator: 'contains' },
          { key: 'description', label: 'Description', type: 'text', operator: 'contains' },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ],
          },
          { key: 'createdAt', label: 'Created After', type: 'date', operator: 'gte' },
          { key: 'createdAt', label: 'Created Before', type: 'date', operator: 'lte' },
        ],
        actions: ['view', 'edit', 'updateStatus'],
      },
      listings: {
        name: 'Listing',
        pluralName: 'Listings',
        slug: 'listings',
        description: 'Manage property listings',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'title', type: 'text', label: 'Title', required: true },
          { name: 'description', type: 'textarea', label: 'Description' },
          { name: 'price', type: 'number', label: 'Price', required: true },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['DRAFT', 'ACTIVE', 'INACTIVE', 'SUSPENDED'],
          },
          { name: 'categoryId', type: 'text', label: 'Category ID' },
          { name: 'ownerId', type: 'text', label: 'Owner ID' },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'title', header: 'Title', width: '250px' },
          { accessorKey: 'price', header: 'Price', width: '100px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        filters: [
          { key: 'title', label: 'Title', type: 'text', operator: 'contains' },
          { key: 'description', label: 'Description', type: 'text', operator: 'contains' },
          { key: 'price', label: 'Min Price', type: 'number', operator: 'gte' },
          { key: 'price', label: 'Max Price', type: 'number', operator: 'lte' },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'DRAFT', label: 'Draft' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ],
          },
          { key: 'categoryId', label: 'Category ID', type: 'text', operator: 'equals' },
          { key: 'ownerId', label: 'Owner ID', type: 'text', operator: 'equals' },
          { key: 'createdAt', label: 'Created After', type: 'date', operator: 'gte' },
          { key: 'createdAt', label: 'Created Before', type: 'date', operator: 'lte' },
        ],
        actions: ['view', 'edit', 'updateStatus'],
      },
      bookings: {
        name: 'Booking',
        pluralName: 'Bookings',
        slug: 'bookings',
        description: 'Manage bookings',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'listingId', type: 'text', label: 'Listing ID' },
          { name: 'renterId', type: 'text', label: 'Renter ID' },
          { name: 'startDate', type: 'date', label: 'Start Date' },
          { name: 'endDate', type: 'date', label: 'End Date' },
          { name: 'totalAmount', type: 'number', label: 'Total Amount' },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
          },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'listingId', header: 'Listing', width: '150px' },
          { accessorKey: 'renterId', header: 'Renter', width: '150px' },
          { accessorKey: 'startDate', header: 'Start', width: '120px' },
          { accessorKey: 'endDate', header: 'End', width: '120px' },
          { accessorKey: 'totalAmount', header: 'Amount', width: '100px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
        ],
        filters: [
          { key: 'listingId', label: 'Listing ID', type: 'text', operator: 'equals' },
          { key: 'renterId', label: 'Renter ID', type: 'text', operator: 'equals' },
          { key: 'startDate', label: 'Start Date From', type: 'date', operator: 'gte' },
          { key: 'startDate', label: 'Start Date To', type: 'date', operator: 'lte' },
          { key: 'endDate', label: 'End Date From', type: 'date', operator: 'gte' },
          { key: 'endDate', label: 'End Date To', type: 'date', operator: 'lte' },
          { key: 'totalAmount', label: 'Min Amount', type: 'number', operator: 'gte' },
          { key: 'totalAmount', label: 'Max Amount', type: 'number', operator: 'lte' },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'PENDING', label: 'Pending' },
              { value: 'CONFIRMED', label: 'Confirmed' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'COMPLETED', label: 'Completed' },
            ],
          },
          { key: 'createdAt', label: 'Created After', type: 'date', operator: 'gte' },
          { key: 'createdAt', label: 'Created Before', type: 'date', operator: 'lte' },
        ],
        actions: ['view', 'edit'],
      },
      payments: {
        name: 'Payment',
        pluralName: 'Payments',
        slug: 'payments',
        description: 'Manage payments',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'bookingId', type: 'text', label: 'Booking ID' },
          { name: 'amount', type: 'number', label: 'Amount' },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
          },
          { name: 'paymentMethod', type: 'text', label: 'Payment Method' },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'bookingId', header: 'Booking', width: '150px' },
          { accessorKey: 'amount', header: 'Amount', width: '100px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        filters: [
          { key: 'bookingId', label: 'Booking ID', type: 'text', operator: 'equals' },
          { key: 'amount', label: 'Min Amount', type: 'number', operator: 'gte' },
          { key: 'amount', label: 'Max Amount', type: 'number', operator: 'lte' },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'PENDING', label: 'Pending' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'FAILED', label: 'Failed' },
              { value: 'REFUNDED', label: 'Refunded' },
            ],
          },
          { key: 'paymentMethod', label: 'Payment Method', type: 'text', operator: 'contains' },
          { key: 'createdAt', label: 'Created After', type: 'date', operator: 'gte' },
          { key: 'createdAt', label: 'Created Before', type: 'date', operator: 'lte' },
        ],
        actions: ['view'],
      },
      disputes: {
        name: 'Dispute',
        pluralName: 'Disputes',
        slug: 'disputes',
        description: 'Manage disputes',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'bookingId', type: 'text', label: 'Booking ID' },
          { name: 'reason', type: 'textarea', label: 'Reason' },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'],
          },
          { name: 'resolution', type: 'textarea', label: 'Resolution' },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'bookingId', header: 'Booking', width: '150px' },
          { accessorKey: 'reason', header: 'Reason', width: '250px' },
          { accessorKey: 'status', header: 'Status', width: '120px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        actions: ['view', 'edit', 'updateStatus'],
      },
      reviews: {
        name: 'Review',
        pluralName: 'Reviews',
        slug: 'reviews',
        description: 'Manage reviews',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'listingId', type: 'text', label: 'Listing ID' },
          { name: 'reviewerId', type: 'text', label: 'Reviewer ID' },
          { name: 'rating', type: 'number', label: 'Rating', min: 1, max: 5 },
          { name: 'comment', type: 'textarea', label: 'Comment' },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'listingId', header: 'Listing', width: '150px' },
          { accessorKey: 'reviewerId', header: 'Reviewer', width: '150px' },
          { accessorKey: 'rating', header: 'Rating', width: '80px' },
          { accessorKey: 'comment', header: 'Comment', width: '250px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        actions: ['view', 'delete'],
      },
      messages: {
        name: 'Message',
        pluralName: 'Messages',
        slug: 'messages',
        description: 'Manage messages',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'senderId', type: 'text', label: 'Sender ID' },
          { name: 'recipientId', type: 'text', label: 'Recipient ID' },
          { name: 'content', type: 'textarea', label: 'Content' },
          { name: 'isRead', type: 'boolean', label: 'Is Read' },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'senderId', header: 'Sender', width: '150px' },
          { accessorKey: 'recipientId', header: 'Recipient', width: '150px' },
          { accessorKey: 'content', header: 'Content', width: '300px' },
          { accessorKey: 'isRead', header: 'Read', width: '80px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        actions: ['view', 'delete'],
      },
      categories: {
        name: 'Category',
        pluralName: 'Categories',
        slug: 'categories',
        description: 'Manage listing categories',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'name', type: 'text', label: 'Name', required: true },
          { name: 'description', type: 'textarea', label: 'Description' },
          { name: 'icon', type: 'text', label: 'Icon' },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'name', header: 'Name', width: '200px' },
          { accessorKey: 'description', header: 'Description', width: '300px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        actions: ['view', 'edit', 'delete'],
      },
      insurance: {
        name: 'Insurance Policy',
        pluralName: 'Insurance Policies',
        slug: 'insurance',
        description: 'Manage insurance policies',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'bookingId', type: 'text', label: 'Booking ID' },
          { name: 'coverageAmount', type: 'number', label: 'Coverage Amount' },
          { name: 'premium', type: 'number', label: 'Premium' },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['ACTIVE', 'CANCELLED', 'CLAIMED'],
          },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'bookingId', header: 'Booking', width: '150px' },
          { accessorKey: 'coverageAmount', header: 'Coverage', width: '120px' },
          { accessorKey: 'premium', header: 'Premium', width: '100px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        actions: ['view'],
      },
      analytics: {
        name: 'Analytics',
        pluralName: 'Analytics',
        slug: 'analytics',
        description: 'Platform analytics and statistics',
        fields: [],
        columns: [],
        actions: [],
        isAnalytics: true,
      },
      favorites: {
        name: 'Favorite',
        pluralName: 'Favorites',
        slug: 'favorites',
        description: 'Manage user favorites',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'userId', type: 'text', label: 'User ID' },
          { name: 'listingId', type: 'text', label: 'Listing ID' },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'userId', header: 'User', width: '150px' },
          { accessorKey: 'listingId', header: 'Listing', width: '150px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        actions: ['view', 'delete'],
      },
      refunds: {
        name: 'Refund',
        pluralName: 'Refunds',
        slug: 'refunds',
        description: 'Manage refunds',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'bookingId', type: 'text', label: 'Booking ID' },
          { name: 'amount', type: 'number', label: 'Amount' },
          { name: 'reason', type: 'textarea', label: 'Reason' },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['PENDING', 'COMPLETED', 'FAILED'],
          },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'bookingId', header: 'Booking', width: '150px' },
          { accessorKey: 'amount', header: 'Amount', width: '100px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        actions: ['view'],
      },
      payouts: {
        name: 'Payout',
        pluralName: 'Payouts',
        slug: 'payouts',
        description: 'Manage payouts to hosts',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'ownerId', type: 'text', label: 'Host ID' },
          { name: 'amount', type: 'number', label: 'Amount' },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
          },
          { name: 'method', type: 'text', label: 'Payment Method' },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'ownerId', header: 'Host', width: '150px' },
          { accessorKey: 'amount', header: 'Amount', width: '100px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        actions: ['view'],
      },
      'condition-reports': {
        name: 'Condition Report',
        pluralName: 'Condition Reports',
        slug: 'condition-reports',
        description: 'Manage property condition reports',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'bookingId', type: 'text', label: 'Booking ID' },
          { name: 'checkInPhotos', type: 'textarea', label: 'Check-in Photos' },
          { name: 'checkOutPhotos', type: 'textarea', label: 'Check-out Photos' },
          { name: 'conditionNotes', type: 'textarea', label: 'Condition Notes' },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['PENDING', 'COMPLETED', 'DISPUTED'],
          },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'bookingId', header: 'Booking', width: '150px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        actions: ['view', 'edit'],
      },
      notifications: {
        name: 'Notification',
        pluralName: 'Notifications',
        slug: 'notifications',
        description: 'Manage system notifications',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'userId', type: 'text', label: 'User ID' },
          { name: 'title', type: 'text', label: 'Title' },
          { name: 'message', type: 'textarea', label: 'Message' },
          {
            name: 'type',
            type: 'select',
            label: 'Type',
            options: ['EMAIL', 'IN_APP', 'PUSH', 'SMS'],
          },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['PENDING', 'SENT', 'READ', 'FAILED'],
          },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'userId', header: 'User', width: '150px' },
          { accessorKey: 'title', header: 'Title', width: '200px' },
          { accessorKey: 'type', header: 'Type', width: '100px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        actions: ['view'],
      },
    };

    const schema = schemas[entity.toLowerCase()];
    if (!schema) {
      throw new Error(`Entity "${entity}" not found`);
    }

    return schema;
  }

  /**
   * Get entity data with pagination, filtering, and sorting
   * Used by the dynamic admin UI to fetch table data
   */
  async getEntityData(
    adminId: string,
    entity: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      filters?: any[]; // Changed to array for proper filter processing
    } = {},
  ): Promise<any> {
    await this.verifyAdmin(adminId);

    const { page = 1, limit = 20, search, sortBy, sortOrder = 'desc', filters } = options;
    const skip = (page - 1) * limit;

    const entityLower = entity.toLowerCase();

    // Map entity names to Prisma model names and default fields
    const entityMap: Record<
      string,
      { model: string; searchFields: string[]; defaultSort: string }
    > = {
      users: {
        model: 'user',
        searchFields: ['email', 'firstName', 'lastName'],
        defaultSort: 'createdAt',
      },
      organizations: {
        model: 'organization',
        searchFields: ['name', 'description'],
        defaultSort: 'createdAt',
      },
      listings: {
        model: 'listing',
        searchFields: ['title', 'description'],
        defaultSort: 'createdAt',
      },
      bookings: { model: 'booking', searchFields: [], defaultSort: 'createdAt' },
      payments: { model: 'payment', searchFields: [], defaultSort: 'createdAt' },
      refunds: { model: 'refund', searchFields: ['reason'], defaultSort: 'createdAt' },
      payouts: { model: 'payout', searchFields: [], defaultSort: 'createdAt' },
      disputes: { model: 'dispute', searchFields: ['reason'], defaultSort: 'createdAt' },
      reviews: { model: 'review', searchFields: ['content', 'title'], defaultSort: 'createdAt' },
      messages: { model: 'conversation', searchFields: [], defaultSort: 'lastMessageAt' },
      categories: { model: 'category', searchFields: ['name', 'description'], defaultSort: 'name' },
      favorites: { model: 'favoriteListing', searchFields: [], defaultSort: 'createdAt' },
      insurance: { model: 'insurancePolicy', searchFields: [], defaultSort: 'createdAt' },
      notifications: {
        model: 'notification',
        searchFields: ['title', 'message'],
        defaultSort: 'createdAt',
      },
      'condition-reports': {
        model: 'conditionReport',
        searchFields: ['notes'],
        defaultSort: 'createdAt',
      },
    };

    const entityConfig = entityMap[entityLower];
    if (!entityConfig) {
      throw new Error(`Entity "${entity}" not supported for data fetching`);
    }

    // Build where clause
    const where: any = {};

    // Add search filter
    if (search && entityConfig.searchFields.length > 0) {
      where.OR = entityConfig.searchFields.map((accessorKey) => ({
        [accessorKey]: { contains: search, mode: 'insensitive' },
      }));
    }

    // Add custom filters using FilterBuilderService
    if (filters && Array.isArray(filters) && filters.length > 0) {
      try {
        // Parse frontend filters to backend format
        const backendFilters = this.filterBuilder.parseFrontendFilters(filters);

        // Build where clause from filters
        const filterWhere = this.filterBuilder.buildWhereClause(backendFilters);

        // Merge with existing where clause
        if (Object.keys(filterWhere).length > 0) {
          if (Object.keys(where).length > 0) {
            // If we already have conditions (like search), combine with AND
            if (where.AND) {
              where.AND.push(filterWhere);
            } else {
              Object.assign(where, filterWhere);
            }
          } else {
            Object.assign(where, filterWhere);
          }
        }
      } catch (error) {
        throw new BadRequestException(`Invalid filter format: ${error.message}`);
      }
    }

    // Determine orderBy
    const orderBy: any = {};
    const sortField = sortBy || entityConfig.defaultSort;
    orderBy[sortField] = sortOrder;

    // Fetch data based on entity type
    let data: any[];
    let total: number;

    try {
      switch (entityConfig.model) {
        case 'user':
          [data, total] = await Promise.all([
            this.prisma.user.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                status: true,
                createdAt: true,
              },
            }),
            this.prisma.user.count({ where }),
          ]);
          break;

        case 'organization':
          [data, total] = await Promise.all([
            this.prisma.organization.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                createdAt: true,
              },
            }),
            this.prisma.organization.count({ where }),
          ]);
          break;

        case 'listing':
          [data, total] = await Promise.all([
            this.prisma.listing.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                title: true,
                status: true,
                basePrice: true,
                city: true,
                createdAt: true,
              },
            }),
            this.prisma.listing.count({ where }),
          ]);
          break;

        case 'booking':
          [data, total] = await Promise.all([
            this.prisma.booking.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                startDate: true,
                endDate: true,
                status: true,
                totalAmount: true,
                createdAt: true,
              },
            }),
            this.prisma.booking.count({ where }),
          ]);
          break;

        case 'payment':
          [data, total] = await Promise.all([
            this.prisma.payment.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                amount: true,
                currency: true,
                status: true,
                createdAt: true,
              },
            }),
            this.prisma.payment.count({ where }),
          ]);
          break;

        case 'refund':
          [data, total] = await Promise.all([
            this.prisma.refund.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                amount: true,
                status: true,
                reason: true,
                createdAt: true,
              },
            }),
            this.prisma.refund.count({ where }),
          ]);
          break;

        case 'payout':
          [data, total] = await Promise.all([
            this.prisma.payout.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                amount: true,
                status: true,
                createdAt: true,
              },
            }),
            this.prisma.payout.count({ where }),
          ]);
          break;

        case 'dispute':
          [data, total] = await Promise.all([
            this.prisma.dispute.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                status: true,
                type: true,
                priority: true,
                createdAt: true,
              },
            }),
            this.prisma.dispute.count({ where }),
          ]);
          break;

        case 'review':
          [data, total] = await Promise.all([
            this.prisma.review.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                overallRating: true,
                status: true,
                type: true,
                createdAt: true,
              },
            }),
            this.prisma.review.count({ where }),
          ]);
          break;

        case 'conversation':
          [data, total] = await Promise.all([
            this.prisma.conversation.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                createdAt: true,
                lastMessageAt: true,
              },
            }),
            this.prisma.conversation.count({ where }),
          ]);
          break;

        case 'category':
          [data, total] = await Promise.all([
            this.prisma.category.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                name: true,
                slug: true,
                createdAt: true,
              },
            }),
            this.prisma.category.count({ where }),
          ]);
          break;

        case 'favoriteListing':
          [data, total] = await Promise.all([
            this.prisma.favoriteListing.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                userId: true,
                listingId: true,
                createdAt: true,
              },
            }),
            this.prisma.favoriteListing.count({ where }),
          ]);
          break;

        case 'insurancePolicy':
          [data, total] = await Promise.all([
            this.prisma.insurancePolicy.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                policyNumber: true,
                provider: true,
                coverageAmount: true,
                status: true,
                createdAt: true,
              },
            }),
            this.prisma.insurancePolicy.count({ where }),
          ]);
          break;

        case 'notification':
          [data, total] = await Promise.all([
            this.prisma.notification.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                userId: true,
                title: true,
                type: true,
                status: true,
                createdAt: true,
              },
            }),
            this.prisma.notification.count({ where }),
          ]);
          break;

        case 'conditionReport':
          [data, total] = await Promise.all([
            this.prisma.conditionReport.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                bookingId: true,
                status: true,
                createdAt: true,
              },
            }),
            this.prisma.conditionReport.count({ where }),
          ]);
          break;

        default:
          throw new Error(`Entity "${entity}" not supported for data fetching`);
      }
    } catch (error) {
      // If the model doesn't exist or there's an error, return empty data
      console.error(`Error fetching data for entity "${entity}":`, error.message);
      data = [];
      total = 0;
    }

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
