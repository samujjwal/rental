import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export class PrismaWrapper {
  private prisma: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      const adapter = new PrismaPg({ connectionString });
      this.prisma = new PrismaClient({ adapter });
    } else {
      // In test environments PrismaService is typically mocked.
      // Accessing any model delegate before providing a real URL will throw.
      this.prisma = new Proxy({} as PrismaClient, {
        get(_target, prop) {
          throw new Error(
            `DATABASE_URL is not set. Cannot access PrismaClient.${String(prop)}. ` +
            'Provide a valid DATABASE_URL or mock PrismaService in tests.',
          );
        },
      });
    }
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

  get identityDocument() {
    return this.prisma.identityDocument;
  }

  // Phase 2: New model accessors
  get listingContent() {
    return this.prisma.listingContent;
  }

  get listingVersion() {
    return this.prisma.listingVersion;
  }

  get categoryAttributeDefinition() {
    return this.prisma.categoryAttributeDefinition;
  }

  get listingAttributeValue() {
    return this.prisma.listingAttributeValue;
  }

  get inventoryUnit() {
    return this.prisma.inventoryUnit;
  }

  get availabilitySlot() {
    return this.prisma.availabilitySlot;
  }

  get fxRateSnapshot() {
    return this.prisma.fxRateSnapshot;
  }

  get bookingPriceBreakdown() {
    return this.prisma.bookingPriceBreakdown;
  }

  get taxForm() {
    return this.prisma.taxForm;
  }

  get taxCalculation() {
    return this.prisma.taxCalculation;
  }

  // Phase 3: Policy engine model accessors
  get policyRule() {
    return this.prisma.policyRule;
  }

  get policyAuditLog() {
    return this.prisma.policyAuditLog;
  }

  get currencyConfig() {
    return this.prisma.currencyConfig;
  }

  get localeConfig() {
    return this.prisma.localeConfig;
  }

  get countryConfig() {
    return this.prisma.countryConfig;
  }

  // Phase 4: V4 Advanced model accessors
  get pricingRule() {
    return this.prisma.pricingRule;
  }

  // trustScore model was removed in migration 20260322155535_drop_deprecated_trust_score_tax_rule

  get complianceRecord() {
    return this.prisma.complianceRecord;
  }

  get platformMetric() {
    return this.prisma.platformMetric;
  }

  get escrowTransaction() {
    return this.prisma.escrowTransaction;
  }

  get disputeEscalation() {
    return this.prisma.disputeEscalation;
  }

  // ── Phase 5 — V5 Enterprise Models ──────────────────────

  get marketplaceHealthMetric() {
    return this.prisma.marketplaceHealthMetric;
  }

  get hostActivationCampaign() {
    return this.prisma.hostActivationCampaign;
  }

  get aiConversation() {
    return this.prisma.aiConversation;
  }

  get aiConversationTurn() {
    return this.prisma.aiConversationTurn;
  }

  get demandForecast() {
    return this.prisma.demandForecast;
  }

  get demandSignal() {
    return this.prisma.demandSignal;
  }

  get marketOpportunity() {
    return this.prisma.marketOpportunity;
  }

  get searchEvent() {
    return this.prisma.searchEvent;
  }

  get userSearchProfile() {
    return this.prisma.userSearchProfile;
  }

  get pricingRecommendation() {
    return this.prisma.pricingRecommendation;
  }

  get fraudSignal() {
    return this.prisma.fraudSignal;
  }

  get deviceFingerprint() {
    return this.prisma.deviceFingerprint;
  }

  get inventoryGraphNode() {
    return this.prisma.inventoryGraphNode;
  }

  get inventoryGraphEdge() {
    return this.prisma.inventoryGraphEdge;
  }

  get paymentProvider() {
    return this.prisma.paymentProvider;
  }

  get taxPolicy() {
    return this.prisma.taxPolicy;
  }

  get countryPolicyPack() {
    return this.prisma.countryPolicyPack;
  }

  get reputationScore() {
    return this.prisma.reputationScore;
  }

  get moderationAction() {
    return this.prisma.moderationAction;
  }

  get serviceHealthCheck() {
    return this.prisma.serviceHealthCheck;
  }

  get anomalyDetection() {
    return this.prisma.anomalyDetection;
  }

  get regionConfig() {
    return this.prisma.regionConfig;
  }

  get expansionSimulation() {
    return this.prisma.expansionSimulation;
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

  $transaction<R>(fn: (tx: any) => Promise<R>): Promise<R>;
  $transaction(fn: any[], options?: { isolationLevel?: string }): Promise<any[]>;
  $transaction(fn: any, options?: any): Promise<any> {
    if (typeof options === 'undefined') {
      return this.prisma.$transaction(fn);
    }

    return this.prisma.$transaction(fn, options);
  }

  $queryRaw<T = any>(query: any, ...args: any[]) {
    return this.prisma.$queryRaw<T>(query, ...args);
  }

  $executeRaw<T = any>(query: any, ...args: any[]) {
    return this.prisma.$executeRaw<T>(query, ...args);
  }

  $queryRawUnsafe<T = any>(query: string, ...values: any[]) {
    return this.prisma.$queryRawUnsafe<T>(query, ...values);
  }

  $executeRawUnsafe(query: string, ...values: any[]) {
    return this.prisma.$executeRawUnsafe(query, ...values);
  }
}
