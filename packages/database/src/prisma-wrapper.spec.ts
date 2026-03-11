import { PrismaWrapper } from './prisma-wrapper';

// Mock @prisma/client and @prisma/adapter-pg
const mockPrismaClient = {
  listing: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  booking: { findMany: jest.fn() },
  review: { findMany: jest.fn() },
  category: { findMany: jest.fn() },
  organization: { findMany: jest.fn() },
  payment: { findMany: jest.fn() },
  refund: { findMany: jest.fn() },
  notification: { findMany: jest.fn() },
  session: { findMany: jest.fn() },
  deviceToken: { findMany: jest.fn() },
  userPreferences: { findMany: jest.fn() },
  favoriteListing: { findMany: jest.fn() },
  cancellationPolicy: { findMany: jest.fn() },
  conditionReport: { findMany: jest.fn() },
  insurancePolicy: { findMany: jest.fn() },
  insuranceClaim: { findMany: jest.fn() },
  emailTemplate: { findMany: jest.fn() },
  conversation: { findMany: jest.fn() },
  message: { findMany: jest.fn() },
  conversationParticipant: { findMany: jest.fn() },
  messageReadReceipt: { findMany: jest.fn() },
  dispute: { findMany: jest.fn() },
  disputeEvidence: { findMany: jest.fn() },
  disputeResponse: { findMany: jest.fn() },
  disputeTimelineEvent: { findMany: jest.fn() },
  disputeResolution: { findMany: jest.fn() },
  organizationMember: { findMany: jest.fn() },
  auditLog: { findMany: jest.fn() },
  depositHold: { findMany: jest.fn() },
  payout: { findMany: jest.fn() },
  ledgerEntry: { findMany: jest.fn() },
  availability: { findMany: jest.fn() },
  bookingStateHistory: { findMany: jest.fn() },
  identityDocument: { findMany: jest.fn() },
  listingContent: { findMany: jest.fn() },
  listingVersion: { findMany: jest.fn() },
  categoryAttributeDefinition: { findMany: jest.fn() },
  listingAttributeValue: { findMany: jest.fn() },
  inventoryUnit: { findMany: jest.fn() },
  availabilitySlot: { findMany: jest.fn() },
  fxRateSnapshot: { findMany: jest.fn() },
  bookingPriceBreakdown: { findMany: jest.fn() },
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient),
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

describe('PrismaWrapper', () => {
  let wrapper: PrismaWrapper;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
    jest.clearAllMocks();
    wrapper = new PrismaWrapper();
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  describe('constructor', () => {
    it('creates PrismaClient with adapter when DATABASE_URL is set', () => {
      const { PrismaClient } = require('@prisma/client');
      const { PrismaPg } = require('@prisma/adapter-pg');
      expect(PrismaPg).toHaveBeenCalledWith({ connectionString: process.env.DATABASE_URL });
      expect(PrismaClient).toHaveBeenCalled();
    });

    it('creates null client when DATABASE_URL is not set', () => {
      delete process.env.DATABASE_URL;
      const nullWrapper = new PrismaWrapper();
      // The wrapper sets up a Proxy that throws on access (to avoid silent failures)
      // Accessing any model accessor should throw the expected error
      expect(() => nullWrapper.listing).toThrow('DATABASE_URL is not set');
    });
  });

  describe('model accessors', () => {
    it('listing returns prisma.listing', () => {
      expect(wrapper.listing).toBe(mockPrismaClient.listing);
    });

    it('property returns prisma.listing (alias)', () => {
      expect(wrapper.property).toBe(mockPrismaClient.listing);
    });

    it('listing and property are the same', () => {
      expect(wrapper.listing).toBe(wrapper.property);
    });

    it('user returns prisma.user', () => {
      expect(wrapper.user).toBe(mockPrismaClient.user);
    });

    it('booking returns prisma.booking', () => {
      expect(wrapper.booking).toBe(mockPrismaClient.booking);
    });

    it('review returns prisma.review', () => {
      expect(wrapper.review).toBe(mockPrismaClient.review);
    });

    it('category returns prisma.category', () => {
      expect(wrapper.category).toBe(mockPrismaClient.category);
    });

    it('organization returns prisma.organization', () => {
      expect(wrapper.organization).toBe(mockPrismaClient.organization);
    });

    it('payment returns prisma.payment', () => {
      expect(wrapper.payment).toBe(mockPrismaClient.payment);
    });

    it('refund returns prisma.refund', () => {
      expect(wrapper.refund).toBe(mockPrismaClient.refund);
    });

    it('notification returns prisma.notification', () => {
      expect(wrapper.notification).toBe(mockPrismaClient.notification);
    });

    it('session returns prisma.session', () => {
      expect(wrapper.session).toBe(mockPrismaClient.session);
    });

    it('deviceToken returns prisma.deviceToken', () => {
      expect(wrapper.deviceToken).toBe(mockPrismaClient.deviceToken);
    });

    it('favoriteListing returns prisma.favoriteListing', () => {
      expect(wrapper.favoriteListing).toBe(mockPrismaClient.favoriteListing);
    });

    it('conversation returns prisma.conversation', () => {
      expect(wrapper.conversation).toBe(mockPrismaClient.conversation);
    });

    it('message returns prisma.message', () => {
      expect(wrapper.message).toBe(mockPrismaClient.message);
    });

    it('dispute returns prisma.dispute', () => {
      expect(wrapper.dispute).toBe(mockPrismaClient.dispute);
    });

    it('auditLog returns prisma.auditLog', () => {
      expect(wrapper.auditLog).toBe(mockPrismaClient.auditLog);
    });

    it('availability returns prisma.availability', () => {
      expect(wrapper.availability).toBe(mockPrismaClient.availability);
    });

    it('identityDocument returns prisma.identityDocument', () => {
      expect(wrapper.identityDocument).toBe(mockPrismaClient.identityDocument);
    });

    // Phase 2 models
    it('listingContent returns prisma.listingContent', () => {
      expect(wrapper.listingContent).toBe(mockPrismaClient.listingContent);
    });

    it('listingVersion returns prisma.listingVersion', () => {
      expect(wrapper.listingVersion).toBe(mockPrismaClient.listingVersion);
    });

    it('inventoryUnit returns prisma.inventoryUnit', () => {
      expect(wrapper.inventoryUnit).toBe(mockPrismaClient.inventoryUnit);
    });

    it('availabilitySlot returns prisma.availabilitySlot', () => {
      expect(wrapper.availabilitySlot).toBe(mockPrismaClient.availabilitySlot);
    });

    it('fxRateSnapshot returns prisma.fxRateSnapshot', () => {
      expect(wrapper.fxRateSnapshot).toBe(mockPrismaClient.fxRateSnapshot);
    });

    it('bookingPriceBreakdown returns prisma.bookingPriceBreakdown', () => {
      expect(wrapper.bookingPriceBreakdown).toBe(mockPrismaClient.bookingPriceBreakdown);
    });
  });

  describe('client accessor', () => {
    it('returns underlying PrismaClient', () => {
      expect(wrapper.client).toBe(mockPrismaClient);
    });
  });

  describe('forwarded methods', () => {
    it('$connect forwards to prisma.$connect', async () => {
      await wrapper.$connect();
      expect(mockPrismaClient.$connect).toHaveBeenCalled();
    });

    it('$disconnect forwards to prisma.$disconnect', async () => {
      await wrapper.$disconnect();
      expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
    });

    it('$transaction forwards to prisma.$transaction', () => {
      const fn = jest.fn();
      wrapper.$transaction(fn);
      expect(mockPrismaClient.$transaction).toHaveBeenCalledWith(fn);
    });

    it('$queryRaw forwards to prisma.$queryRaw', () => {
      const query = 'SELECT 1';
      wrapper.$queryRaw(query);
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledWith(query);
    });

    it('$executeRaw forwards to prisma.$executeRaw', () => {
      const query = 'DELETE FROM test';
      wrapper.$executeRaw(query);
      expect(mockPrismaClient.$executeRaw).toHaveBeenCalledWith(query);
    });

    it('$queryRawUnsafe forwards to prisma.$queryRawUnsafe', () => {
      wrapper.$queryRawUnsafe('SELECT * FROM users WHERE id = $1', 'user-1');
      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        'user-1',
      );
    });

    it('$executeRawUnsafe forwards to prisma.$executeRawUnsafe', () => {
      wrapper.$executeRawUnsafe('DELETE FROM users WHERE id = $1', 'user-1');
      expect(mockPrismaClient.$executeRawUnsafe).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1',
        'user-1',
      );
    });
  });
});
