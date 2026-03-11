/**
 * Compliance Automation Service
 *
 * Evaluates and tracks entity compliance against country-specific requirements:
 * - Identity verification status
 * - Tax registration requirements
 * - Business license requirements
 * - Insurance coverage requirements
 * - Property permits
 * - Safety inspection certificates
 * - Data privacy compliance
 * - AML/Sanctions screening
 *
 * Uses the PolicyEngine with COMPLIANCE policy type to determine
 * which checks are required for a given entity in a given jurisdiction.
 * Stores results in ComplianceRecord model.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventsService } from '@/common/events/events.service';
import { CacheService } from '@/common/cache/cache.service';
import { PolicyEngineService } from '../policy-engine/services/policy-engine.service';
import { PolicyContext } from '../policy-engine/interfaces/policy.interfaces';

export type ComplianceCheckType =
  | 'IDENTITY_VERIFICATION'
  | 'TAX_REGISTRATION'
  | 'BUSINESS_LICENSE'
  | 'INSURANCE_COVERAGE'
  | 'PROPERTY_PERMIT'
  | 'SAFETY_INSPECTION'
  | 'DATA_PRIVACY'
  | 'AML_CHECK'
  | 'SANCTIONS_CHECK'
  | 'AGE_VERIFICATION';

export type ComplianceStatus =
  | 'PENDING'
  | 'PASSED'
  | 'FAILED'
  | 'EXPIRED'
  | 'WAIVED'
  | 'IN_REVIEW';

export interface ComplianceRequirement {
  checkType: ComplianceCheckType;
  required: boolean;
  description: string;
  validityDays: number | null;   // How long the check remains valid
  blockOnFailure: boolean;       // Whether to block operations if not compliant
}

export interface ComplianceCheckResult {
  entityId: string;
  entityType: string;
  checkType: ComplianceCheckType;
  status: ComplianceStatus;
  isCompliant: boolean;
  expiresAt: Date | null;
  details: Record<string, unknown>;
}

export interface EntityComplianceSummary {
  entityId: string;
  entityType: string;
  overallCompliant: boolean;
  checks: ComplianceCheckResult[];
  missingChecks: ComplianceCheckType[];
  expiringChecks: ComplianceCheckResult[];
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly cache: CacheService,
    private readonly policyEngine: PolicyEngineService,
  ) {}

  /**
   * Determine which compliance checks are required for an entity
   * based on its jurisdiction and type.
   */
  async getRequiredChecks(
    context: PolicyContext,
    entityType: string,
  ): Promise<ComplianceRequirement[]> {
    const decision = await this.policyEngine.evaluate(
      'COMPLIANCE',
      context,
      entityType,
    );

    const requirements: ComplianceRequirement[] = [];

    for (const action of decision.actions) {
      const params = action.params as Record<string, unknown>;

      if (action.type === 'REQUIRE_DOCUMENT') {
        requirements.push({
          checkType: (params.documentType || params.checkType || 'IDENTITY_VERIFICATION') as ComplianceCheckType,
          required: true,
          description: String(params.label || params.description || ''),
          validityDays: params.validityDays ? Number(params.validityDays) : null,
          blockOnFailure: params.blockOnFailure !== false,
        });
      } else if (action.type === 'SET_OBJECT') {
        // Bulk compliance requirements from policy
        const checks = params.checks as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(checks)) {
          for (const check of checks) {
            requirements.push({
              checkType: String(check.checkType || 'IDENTITY_VERIFICATION') as ComplianceCheckType,
              required: check.required !== false,
              description: String(check.description || ''),
              validityDays: check.validityDays ? Number(check.validityDays) : null,
              blockOnFailure: check.blockOnFailure !== false,
            });
          }
        }
      }
    }

    // Default minimum requirements if no policies matched
    if (requirements.length === 0 && decision.fallbackUsed) {
      requirements.push(
        {
          checkType: 'IDENTITY_VERIFICATION',
          required: true,
          description: 'Identity verification required',
          validityDays: null,
          blockOnFailure: true,
        },
        {
          checkType: 'AGE_VERIFICATION',
          required: true,
          description: 'Age verification required (18+)',
          validityDays: null,
          blockOnFailure: true,
        },
      );
    }

    return requirements;
  }

  /**
   * Run compliance evaluation for an entity.
   * Checks all required items and creates/updates ComplianceRecord entries.
   */
  async evaluateCompliance(
    entityId: string,
    entityType: string,
    country: string,
    state?: string,
    city?: string,
  ): Promise<EntityComplianceSummary> {
    // Build policy context
    const context: PolicyContext = {
      locale: 'en',
      country,
      state: state || null,
      city: city || null,
      timezone: 'UTC',
      currency: 'USD',
      userId: entityType === 'USER' ? entityId : null,
      userRole: 'USER',
      userCountry: country,
      listingId: entityType === 'LISTING' ? entityId : null,
      listingCategory: null,
      listingCountry: country,
      listingState: state || null,
      listingCity: city || null,
      bookingValue: null,
      bookingDuration: null,
      bookingCurrency: null,
      startDate: null,
      endDate: null,
      guestCount: null,
      hostPresent: null,
      requestTimestamp: new Date().toISOString(),
      evaluationDate: new Date().toISOString().split('T')[0],
      ipCountry: null,
      platform: 'web',
      tenantId: null,
      workspaceConfig: {},
    };

    const requirements = await this.getRequiredChecks(context, entityType);

    // Get existing compliance records
    const existingRecords = await this.prisma.complianceRecord.findMany({
      where: { entityId, entityType },
    });

    const existingMap = new Map<string, (typeof existingRecords)[number]>(
      existingRecords.map((r) => [r.checkType, r]),
    );

    const checks: ComplianceCheckResult[] = [];
    const missingChecks: ComplianceCheckType[] = [];
    const expiringChecks: ComplianceCheckResult[] = [];
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const req of requirements) {
      const existing = existingMap.get(req.checkType);

      if (!existing) {
        // No record — create PENDING
        const record = await this.prisma.complianceRecord.create({
          data: {
            entityId,
            entityType,
            checkType: req.checkType,
            status: 'PENDING',
            country,
            result: { requirement: req.description },
            expiresAt: req.validityDays
              ? new Date(now.getTime() + req.validityDays * 24 * 60 * 60 * 1000)
              : null,
          },
        });

        missingChecks.push(req.checkType);

        checks.push({
          entityId,
          entityType,
          checkType: req.checkType,
          status: 'PENDING',
          isCompliant: false,
          expiresAt: record.expiresAt,
          details: { requirement: req.description },
        });
      } else {
        // Check if expired
        const isExpired = existing.expiresAt && existing.expiresAt < now;
        const status = isExpired ? 'EXPIRED' : existing.status;

        if (isExpired && existing.status !== 'EXPIRED') {
          await this.prisma.complianceRecord.update({
            where: { id: existing.id },
            data: { status: 'EXPIRED' },
          });
        }

        const isCompliant = status === 'PASSED' || status === 'WAIVED';

        const result: ComplianceCheckResult = {
          entityId,
          entityType,
          checkType: req.checkType as ComplianceCheckType,
          status: status as ComplianceStatus,
          isCompliant,
          expiresAt: existing.expiresAt,
          details: existing.result as Record<string, unknown>,
        };

        checks.push(result);

        if (!isCompliant) {
          missingChecks.push(req.checkType as ComplianceCheckType);
        }

        // Check if expiring soon
        if (existing.expiresAt && existing.expiresAt < thirtyDays && isCompliant) {
          expiringChecks.push(result);
        }
      }
    }

    const overallCompliant = missingChecks.length === 0;

    // Emit compliance event
    this.events.emitComplianceCheck({
      entityId,
      entityType,
      checkType: 'OVERALL' as any,
      status: overallCompliant ? 'PASSED' : 'FAILED',
      country,
    });

    this.logger.log(
      `Compliance evaluation for ${entityType} ${entityId}: ${overallCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'} (${missingChecks.length} missing)`,
    );

    return {
      entityId,
      entityType,
      overallCompliant,
      checks,
      missingChecks,
      expiringChecks,
    };
  }

  /**
   * Update a compliance check result (e.g., after manual verification).
   */
  async updateCheckStatus(
    entityId: string,
    entityType: string,
    checkType: ComplianceCheckType,
    status: ComplianceStatus,
    details?: Record<string, unknown>,
    validityDays?: number,
  ): Promise<ComplianceCheckResult> {
    const record = await this.prisma.complianceRecord.findFirst({
      where: { entityId, entityType, checkType },
    });

    if (!record) {
      throw new Error(`No compliance record found for ${entityType} ${entityId} / ${checkType}`);
    }

    const now = new Date();
    const expiresAt = validityDays
      ? new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000)
      : record.expiresAt;

    const updated = await this.prisma.complianceRecord.update({
      where: { id: record.id },
      data: {
        status,
        result: JSON.parse(JSON.stringify({ ...(record.result as object || {}), ...details })),
        validatedAt: status === 'PASSED' ? now : undefined,
        expiresAt,
      },
    });

    this.events.emitComplianceCheck({
      entityId,
      entityType,
      checkType,
      status,
      country: updated.country,
    });

    return {
      entityId,
      entityType,
      checkType,
      status,
      isCompliant: status === 'PASSED' || status === 'WAIVED',
      expiresAt: updated.expiresAt,
      details: updated.result as Record<string, unknown>,
    };
  }

  /**
   * Find entities with expiring compliance records (for renewal reminders).
   */
  async findExpiringRecords(withinDays: number = 30): Promise<any[]> {
    const deadline = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);

    return this.prisma.complianceRecord.findMany({
      where: {
        status: 'PASSED',
        expiresAt: { lte: deadline, gte: new Date() },
      },
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });
  }
}
