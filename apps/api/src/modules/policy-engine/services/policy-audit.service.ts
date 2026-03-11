/**
 * Policy Audit Service — Logs every policy evaluation decision.
 *
 * Writes are async (fire-and-forget) so they don't add latency to the hot path.
 * Records are stored in the policy_audit_log table for regulatory compliance.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { createHash } from 'crypto';
import {
  PolicyContext,
  PolicyDecision,
  PolicyType,
  RuleEvaluationResult,
} from '../interfaces';

@Injectable()
export class PolicyAuditService {
  private readonly logger = new Logger(PolicyAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a policy evaluation decision asynchronously.
   * Failures are logged but never propagated to the caller.
   */
  logDecision(
    policyType: PolicyType,
    context: PolicyContext,
    decision: PolicyDecision,
    entityType?: string,
    entityId?: string,
    requestId?: string,
  ): void {
    // Fire-and-forget — don't await
    this.writeAuditLog(policyType, context, decision, entityType, entityId, requestId).catch(
      (error) => {
        this.logger.error(`Failed to write policy audit log: ${error.message}`, error.stack);
      },
    );
  }

  private async writeAuditLog(
    policyType: PolicyType,
    context: PolicyContext,
    decision: PolicyDecision,
    entityType?: string,
    entityId?: string,
    requestId?: string,
  ): Promise<void> {
    const sanitizedContext = this.sanitizeContext(context);
    const contextHash = this.hashContext(sanitizedContext);

    const candidateRules = [
      ...decision.appliedRules.map((r) => r.ruleId),
      ...decision.eliminatedRules.map((r) => r.ruleId),
    ];

    const eliminatedDetails = decision.eliminatedRules.map((r) => ({
      ruleId: r.ruleId,
      failedConditions: r.conditionResults
        .filter((c) => !c.matched)
        .map((c: any) => ({
          field: c.field,
          operator: c.operator,
          expected: c.expected,
          actual: c.actual,
        })),
    }));

    const explanation = this.buildExplanation(policyType, decision);

    // Find the first matched rule to link to (if any)
    const primaryRuleId = decision.appliedRules.length > 0 ? decision.appliedRules[0].ruleId : null;

    await this.prisma.policyAuditLog.create({
      data: {
        policyType,
        context: sanitizedContext as any,
        contextHash,
        candidateRules,
        matchedRules: decision.appliedRules.map((r) => r.ruleId),
        eliminatedRules: eliminatedDetails as any,
        decision: {
          matched: decision.matched,
          actions: decision.actions,
          fallbackUsed: decision.fallbackUsed,
        } as any,
        explanation,
        requestId: requestId || null,
        userId: context.userId,
        entityType: entityType || null,
        entityId: entityId || null,
        evaluationMs: decision.evaluationMs,
        policyRuleId: primaryRuleId,
      },
    });
  }

  /**
   * Remove PII from context before logging.
   */
  private sanitizeContext(context: PolicyContext): Record<string, unknown> {
    return {
      country: context.country,
      state: context.state,
      city: context.city,
      locale: context.locale,
      currency: context.currency,
      userRole: context.userRole,
      listingCategory: context.listingCategory,
      listingCountry: context.listingCountry,
      bookingValue: context.bookingValue,
      bookingDuration: context.bookingDuration,
      startDate: context.startDate,
      endDate: context.endDate,
      platform: context.platform,
      evaluationDate: context.evaluationDate,
      // Deliberately omitting: userId, listingId, etc. for PII minimization
    };
  }

  private hashContext(context: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(context)).digest('hex').substring(0, 64);
  }

  private buildExplanation(policyType: PolicyType, decision: PolicyDecision): string {
    if (!decision.matched) {
      return `No ${policyType} rules matched. ${decision.fallbackUsed ? 'Fallback rule applied.' : 'No fallback available.'}`;
    }
    const ruleNames = decision.appliedRules.map((r) => `"${r.ruleName}"`).join(', ');
    return `${policyType} evaluated: ${decision.appliedRules.length} rule(s) matched [${ruleNames}]. Evaluation took ${decision.evaluationMs.toFixed(1)}ms.`;
  }
}
