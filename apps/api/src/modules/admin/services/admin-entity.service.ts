import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { i18nForbidden } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { FilterBuilderService } from './filter-builder.service';

/**
 * Extracted from admin.service.ts — handles the dynamic entity framework
 * (schema definitions + generic CRUD data fetching) for the admin UI.
 */
@Injectable()
export class AdminEntityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filterBuilder: FilterBuilderService,
  ) {}

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
          { name: 'totalPrice', type: 'number', label: 'Total Price' },
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
          { accessorKey: 'totalPrice', header: 'Amount', width: '100px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
        ],
        filters: [
          { key: 'listingId', label: 'Listing ID', type: 'text', operator: 'equals' },
          { key: 'renterId', label: 'Renter ID', type: 'text', operator: 'equals' },
          { key: 'startDate', label: 'Start Date From', type: 'date', operator: 'gte' },
          { key: 'startDate', label: 'Start Date To', type: 'date', operator: 'lte' },
          { key: 'endDate', label: 'End Date From', type: 'date', operator: 'gte' },
          { key: 'endDate', label: 'End Date To', type: 'date', operator: 'lte' },
          { key: 'totalPrice', label: 'Min Amount', type: 'number', operator: 'gte' },
          { key: 'totalPrice', label: 'Max Amount', type: 'number', operator: 'lte' },
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
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['DRAFT', 'PUBLISHED', 'HIDDEN', 'FLAGGED'],
          },
          { name: 'comment', type: 'textarea', label: 'Comment' },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'listingId', header: 'Listing', width: '150px' },
          { accessorKey: 'reviewerId', header: 'Reviewer', width: '150px' },
          { accessorKey: 'rating', header: 'Rating', width: '80px' },
          { accessorKey: 'status', header: 'Status', width: '120px' },
          { accessorKey: 'comment', header: 'Comment', width: '250px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        actions: ['view', 'edit', 'delete'],
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
          { name: 'policyNumber', type: 'text', label: 'Policy Number', required: true },
          { name: 'propertyId', type: 'text', label: 'Listing ID', required: true },
          { name: 'userId', type: 'text', label: 'User ID', required: true },
          { name: 'bookingId', type: 'text', label: 'Booking ID' },
          { name: 'provider', type: 'text', label: 'Provider' },
          { name: 'type', type: 'select', label: 'Type', options: ['LIABILITY', 'COMPREHENSIVE', 'COLLISION', 'DAMAGE'] },
          { name: 'coverageAmount', type: 'number', label: 'Coverage Amount' },
          { name: 'premium', type: 'number', label: 'Premium' },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED'],
          },
          { name: 'startDate', type: 'datetime', label: 'Start Date' },
          { name: 'endDate', type: 'datetime', label: 'End Date' },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'policyNumber', header: 'Policy #', width: '140px' },
          { accessorKey: 'propertyId', header: 'Listing', width: '140px' },
          { accessorKey: 'userId', header: 'User', width: '140px' },
          { accessorKey: 'coverageAmount', header: 'Coverage', width: '120px' },
          { accessorKey: 'premium', header: 'Premium', width: '100px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
          { accessorKey: 'endDate', header: 'Expires', width: '150px' },
        ],
        actions: ['view', 'edit'],
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
      claims: {
        name: 'Claim',
        pluralName: 'Claims',
        slug: 'claims',
        description: 'Manage insurance claims',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'policyId', type: 'text', label: 'Policy ID' },
          { name: 'bookingId', type: 'text', label: 'Booking ID' },
          { name: 'claimAmount', type: 'number', label: 'Claim Amount' },
          { name: 'description', type: 'textarea', label: 'Description' },
          {
            name: 'status',
            type: 'select',
            label: 'Status',
            options: ['PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'PAID'],
          },
          { name: 'claimDate', type: 'date', label: 'Claim Date' },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'policyId', header: 'Policy', width: '150px' },
          { accessorKey: 'claimAmount', header: 'Amount', width: '120px' },
          { accessorKey: 'status', header: 'Status', width: '100px' },
          { accessorKey: 'claimDate', header: 'Claim Date', width: '120px' },
          { accessorKey: 'createdAt', header: 'Created', width: '150px' },
        ],
        filters: [
          { key: 'policyId', label: 'Policy ID', type: 'text', operator: 'equals' },
          { key: 'bookingId', label: 'Booking ID', type: 'text', operator: 'equals' },
          { key: 'claimAmount', label: 'Min Amount', type: 'number', operator: 'gte' },
          { key: 'claimAmount', label: 'Max Amount', type: 'number', operator: 'lte' },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'PENDING', label: 'Pending' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: 'PROCESSING', label: 'Processing' },
              { value: 'PAID', label: 'Paid' },
            ],
          },
          { key: 'claimDate', label: 'Claim Date From', type: 'date', operator: 'gte' },
          { key: 'claimDate', label: 'Claim Date To', type: 'date', operator: 'lte' },
          { key: 'createdAt', label: 'Created After', type: 'date', operator: 'gte' },
          { key: 'createdAt', label: 'Created Before', type: 'date', operator: 'lte' },
        ],
        actions: ['view', 'edit', 'updateStatus'],
      },
      'email-templates': {
        name: 'Email Template',
        pluralName: 'Email Templates',
        slug: 'email-templates',
        description: 'Manage email templates',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readOnly: true },
          { name: 'name', type: 'text', label: 'Name', required: true },
          { name: 'subject', type: 'text', label: 'Subject', required: true },
          { name: 'body', type: 'textarea', label: 'Body', required: true },
          { name: 'description', type: 'textarea', label: 'Description' },
          {
            name: 'type',
            type: 'select',
            label: 'Type',
            options: [
              'WELCOME',
              'BOOKING_CONFIRMATION',
              'BOOKING_REMINDER',
              'BOOKING_CANCELLED',
              'PAYMENT_RECEIVED',
              'PAYMENT_FAILED',
              'REVIEW_REQUEST',
              'PASSWORD_RESET',
              'EMAIL_VERIFICATION',
              'LISTING_APPROVED',
              'LISTING_REJECTED',
              'DISPUTE_OPENED',
              'DISPUTE_RESOLVED',
              'CUSTOM',
            ],
          },
          { name: 'isActive', type: 'boolean', label: 'Is Active' },
          { name: 'createdAt', type: 'datetime', label: 'Created At', readOnly: true },
          { name: 'updatedAt', type: 'datetime', label: 'Updated At', readOnly: true },
        ],
        columns: [
          { accessorKey: 'id', header: 'ID', width: '80px' },
          { accessorKey: 'name', header: 'Name', width: '200px' },
          { accessorKey: 'subject', header: 'Subject', width: '250px' },
          { accessorKey: 'type', header: 'Type', width: '150px' },
          { accessorKey: 'isActive', header: 'Active', width: '80px' },
          { accessorKey: 'updatedAt', header: 'Updated', width: '150px' },
        ],
        filters: [
          { key: 'name', label: 'Name', type: 'text', operator: 'contains' },
          { key: 'subject', label: 'Subject', type: 'text', operator: 'contains' },
          { key: 'description', label: 'Description', type: 'text', operator: 'contains' },
          {
            key: 'type',
            label: 'Type',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'WELCOME', label: 'Welcome' },
              { value: 'BOOKING_CONFIRMATION', label: 'Booking Confirmation' },
              { value: 'BOOKING_REMINDER', label: 'Booking Reminder' },
              { value: 'BOOKING_CANCELLED', label: 'Booking Cancelled' },
              { value: 'PAYMENT_RECEIVED', label: 'Payment Received' },
              { value: 'PAYMENT_FAILED', label: 'Payment Failed' },
              { value: 'REVIEW_REQUEST', label: 'Review Request' },
              { value: 'PASSWORD_RESET', label: 'Password Reset' },
              { value: 'EMAIL_VERIFICATION', label: 'Email Verification' },
              { value: 'LISTING_APPROVED', label: 'Listing Approved' },
              { value: 'LISTING_REJECTED', label: 'Listing Rejected' },
              { value: 'DISPUTE_OPENED', label: 'Dispute Opened' },
              { value: 'DISPUTE_RESOLVED', label: 'Dispute Resolved' },
              { value: 'CUSTOM', label: 'Custom' },
            ],
          },
          {
            key: 'isActive',
            label: 'Status',
            type: 'select',
            operator: 'equals',
            options: [
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ],
          },
          { key: 'createdAt', label: 'Created After', type: 'date', operator: 'gte' },
          { key: 'createdAt', label: 'Created Before', type: 'date', operator: 'lte' },
          { key: 'updatedAt', label: 'Updated After', type: 'date', operator: 'gte' },
          { key: 'updatedAt', label: 'Updated Before', type: 'date', operator: 'lte' },
        ],
        actions: ['view', 'edit', 'delete', 'duplicate'],
      },
    };

    const schema = schemas[entity.toLowerCase()];
    if (!schema) {
      throw new NotFoundException(`Entity "${entity}" not found`);
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
      filters?: any[];
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
      claims: {
        model: 'insuranceClaim',
        searchFields: ['description'],
        defaultSort: 'createdAt',
      },
      'email-templates': {
        model: 'emailTemplate',
        searchFields: ['name', 'subject', 'description'],
        defaultSort: 'updatedAt',
      },
    };

    const entityConfig = entityMap[entityLower];
    if (!entityConfig) {
      throw new BadRequestException(`Entity "${entity}" not supported for data fetching`);
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
        const backendFilters = this.filterBuilder.parseFrontendFilters(filters);
        const filterWhere = this.filterBuilder.buildWhereClause(backendFilters);

        if (Object.keys(filterWhere).length > 0) {
          if (Object.keys(where).length > 0) {
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
                totalPrice: true,
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

        case 'insuranceClaim':
          [data, total] = await Promise.all([
            this.prisma.insuranceClaim.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              include: {
                policy: {
                  select: {
                    id: true,
                    policyNumber: true,
                    provider: true,
                  },
                },
                booking: {
                  select: {
                    id: true,
                    listing: {
                      select: {
                        title: true,
                      },
                    },
                  },
                },
                property: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            }),
            this.prisma.insuranceClaim.count({ where }),
          ]);
          break;

        case 'emailTemplate':
          [data, total] = await Promise.all([
            this.prisma.emailTemplate.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              select: {
                id: true,
                name: true,
                subject: true,
                type: true,
                description: true,
                isActive: true,
                category: true,
                createdAt: true,
                updatedAt: true,
              },
            }),
            this.prisma.emailTemplate.count({ where }),
          ]);
          break;

        default:
          throw new BadRequestException(`Entity "${entity}" not supported for data fetching`);
      }
    } catch (error) {
      // If the model doesn't exist or there's an error, return empty data
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
