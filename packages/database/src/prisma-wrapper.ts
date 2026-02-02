import { PrismaClient } from '@prisma/client';

export class PrismaWrapper {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Provide listing alias for property
  get listing() {
    return this.prisma.listing;
  }

  // Provide property alias
  get property() {
    return this.prisma.listing;
  }

  // Provide all other models directly
  get user() {
    return this.prisma.user;
  }

  get booking() {
    return this.prisma.booking;
  }

  get review() {
    return this.prisma.review;
  }

  get category() {
    return this.prisma.category;
  }

  get organization() {
    return this.prisma.organization;
  }

  get payment() {
    return this.prisma.payment;
  }

  get refund() {
    return this.prisma.refund;
  }

  get notification() {
    return this.prisma.notification;
  }

  get session() {
    return this.prisma.session;
  }

  get deviceToken() {
    return this.prisma.deviceToken;
  }

  get userPreferences() {
    return this.prisma.userPreferences;
  }

  get favoriteListing() {
    return this.prisma.favoriteListing;
  }

  get cancellationPolicy() {
    return this.prisma.cancellationPolicy;
  }

  get conditionReport() {
    return this.prisma.conditionReport;
  }

  get insurancePolicy() {
    return this.prisma.insurancePolicy;
  }

  get insuranceClaim() {
    return this.prisma.insuranceClaim;
  }

  get emailTemplate() {
    return this.prisma.emailTemplate;
  }

  get conversation() {
    return this.prisma.conversation;
  }

  get message() {
    return this.prisma.message;
  }

  get conversationParticipant() {
    return this.prisma.conversationParticipant;
  }

  get messageReadReceipt() {
    return this.prisma.messageReadReceipt;
  }

  get dispute() {
    return this.prisma.dispute;
  }

  get disputeEvidence() {
    return this.prisma.disputeEvidence;
  }

  get disputeResponse() {
    return this.prisma.disputeResponse;
  }

  get disputeTimelineEvent() {
    return this.prisma.disputeTimelineEvent;
  }

  get disputeResolution() {
    return this.prisma.disputeResolution;
  }

  get organizationMember() {
    return this.prisma.organizationMember;
  }

  get auditLog() {
    return this.prisma.auditLog;
  }

  get depositHold() {
    return this.prisma.depositHold;
  }

  get payout() {
    return this.prisma.payout;
  }

  get ledgerEntry() {
    return this.prisma.ledgerEntry;
  }

  get availability() {
    return this.prisma.availability;
  }

  get bookingStateHistory() {
    return this.prisma.bookingStateHistory;
  }

  // Provide direct access to underlying client for advanced usage
  get client() {
    return this.prisma;
  }

  // Forward all other methods
  async $connect() {
    return this.prisma.$connect();
  }

  async $disconnect() {
    return this.prisma.$disconnect();
  }

  $transaction(fn: any) {
    return this.prisma.$transaction(fn);
  }

  $queryRaw<T = any>(query: any, ...args: any[]) {
    return this.prisma.$queryRaw<T>(query, ...args);
  }

  $executeRaw<T = any>(query: any, ...args: any[]) {
    return this.prisma.$executeRaw<T>(query, ...args);
  }
}
