/**
 * Policy Engine — Central orchestrator for policy evaluation.
 *
 * Domain services call PolicyEngine.evaluate() with a policy type and context.
 * The engine loads matching rules from the registry, evaluates conditions via
 * the RuleEvaluator, aggregates actions, logs the decision, and returns a
 * PolicyDecision.
 *
 * Domain services NEVER access the rule store directly.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  PolicyType,
  PolicyContext,
  PolicyDecision,
  RuleEvaluationResult,
  TaxBreakdown,
  TaxLineItem,
  TaxSnapshot,
  FeeBreakdown,
  FeeLineItem,
  BookingConstraintDecision,
  CancellationDecision,
  CancellationTier,
  RuleAction,
} from '../interfaces';
import { RuleEvaluatorService } from './rule-evaluator.service';
import { PolicyRegistryService } from './policy-registry.service';
import { PolicyAuditService } from './policy-audit.service';
import { createHash } from 'crypto';

@Injectable()
export class PolicyEngineService {
  private readonly logger = new Logger(PolicyEngineService.name);

  constructor(
    private readonly registry: PolicyRegistryService,
    private readonly evaluator: RuleEvaluatorService,
    private readonly audit: PolicyAuditService,
  ) {}

  // ──────────────────────────────────────────────────────
  // Generic Evaluation
  // ──────────────────────────────────────────────────────

  /**
   * Evaluate all active rules for a given policy type against the provided context.
   * Returns a PolicyDecision with matched/eliminated rules and aggregated actions.
   */
  async evaluate(
    policyType: PolicyType,
    context: PolicyContext,
    entityType?: string,
    entityId?: string,
    requestId?: string,
  ): Promise<PolicyDecision> {
    const startMs = performance.now();

    // 1. Load candidate rules from registry
    const rules = await this.registry.findActiveRules(
      policyType,
      context.country,
      context.state,
      context.city,
    );

    // 2. Evaluate each rule
    const applied: RuleEvaluationResult[] = [];
    const eliminated: RuleEvaluationResult[] = [];

    for (const rule of rules) {
      const result = this.evaluator.evaluateRule(rule, context);
      if (result.matched) {
        applied.push(result);
      } else {
        eliminated.push(result);
      }
    }

    // 3. Check for fallback
    let fallbackUsed = false;
    if (applied.length === 0) {
      this.logger.warn(
        `No ${policyType} rules matched for context: country=${context.country}, state=${context.state}, city=${context.city}`,
      );
      fallbackUsed = true;
    }

    // 4. Aggregate actions from matched rules
    const actions = applied.flatMap((r) => r.actions);

    const evaluationMs = performance.now() - startMs;

    const decision: PolicyDecision = {
      policyType,
      matched: applied.length > 0,
      appliedRules: applied,
      eliminatedRules: eliminated,
      actions,
      evaluationMs,
      fallbackUsed,
    };

    // 5. Audit (async, non-blocking)
    this.audit.logDecision(policyType, context, decision, entityType, entityId, requestId);

    return decision;
  }

  // ──────────────────────────────────────────────────────
  // Tax-Specific Evaluation
  // ──────────────────────────────────────────────────────

  /**
   * Calculate tax for a given subtotal using the TAX policy rules.
   * Returns a TaxBreakdown with individual tax lines and snapshot for auditing.
   */
  async calculateTax(
    context: PolicyContext,
    subtotal: number,
    entityType?: string,
    entityId?: string,
  ): Promise<TaxBreakdown> {
    // Load rules upfront to capture version numbers for the audit snapshot
    const ruleList = await this.registry.findActiveRules('TAX', context.country, context.state, context.city);
    const ruleVersionMap = new Map<string, number>(ruleList.map((r) => [r.id, r.version]));

    const decision = await this.evaluate('TAX', context, entityType, entityId);

    const taxLines: TaxLineItem[] = [];
    for (const action of decision.actions) {
      if (action.type === 'SET_RATE') {
        const params = action.params as Record<string, unknown>;
        const rate = Number(params.rate) || 0;
        const amount = Math.round((subtotal * rate) / 100 * 100) / 100;

        taxLines.push({
          type: String(params.taxType || 'TAX'),
          name: String(params.name || 'Tax'),
          rate,
          amount,
          jurisdiction: String(params.jurisdiction || context.country),
          ruleId: this.findRuleIdForAction(decision, action),
        });
      } else if (action.type === 'COMPOUND') {
        // Compound tax — applied on subtotal + previous tax lines
        const params = action.params as Record<string, unknown>;
        const rate = Number(params.rate) || 0;
        const previousTaxTotal = taxLines.reduce((sum, t) => sum + t.amount, 0);
        const compoundBase = subtotal + previousTaxTotal;
        const amount = Math.round((compoundBase * rate) / 100 * 100) / 100;

        taxLines.push({
          type: String(params.taxType || 'COMPOUND_TAX'),
          name: String(params.name || 'Compound Tax'),
          rate,
          amount,
          jurisdiction: String(params.jurisdiction || context.country),
          ruleId: this.findRuleIdForAction(decision, action),
        });
      }
    }

    const totalTax = taxLines.reduce((sum, t) => sum + t.amount, 0);
    const total = Math.round((subtotal + totalTax) * 100) / 100;

    const snapshot: TaxSnapshot = {
      evaluatedAt: new Date().toISOString(),
      rules: decision.appliedRules.map((r) => {
        const rateAction = r.actions.find((a) => a.type === 'SET_RATE' || a.type === 'COMPOUND');
        return {
          ruleId: r.ruleId,
          version: ruleVersionMap.get(r.ruleId) ?? 1,
          rate: rateAction ? Number((rateAction.params as Record<string, unknown>).rate) || 0 : 0,
          amount: taxLines.find((t) => t.ruleId === r.ruleId)?.amount || 0,
          jurisdiction: rateAction
            ? String((rateAction.params as Record<string, unknown>).jurisdiction || context.country)
            : context.country,
        };
      }),
      contextHash: createHash('sha256')
        .update(
          JSON.stringify({
            country: context.country,
            state: context.state,
            city: context.city,
            subtotal,
          }),
        )
        .digest('hex')
        .substring(0, 64),
    };

    return {
      subtotal,
      taxLines,
      totalTax: Math.round(totalTax * 100) / 100,
      total,
      currency: context.currency,
      snapshot,
    };
  }

  // ──────────────────────────────────────────────────────
  // Fee-Specific Evaluation
  // ──────────────────────────────────────────────────────

  /**
   * Calculate platform/service fees using the FEE policy rules.
   */
  async calculateFees(
    context: PolicyContext,
    subtotal: number,
    entityType?: string,
    entityId?: string,
  ): Promise<FeeBreakdown> {
    const decision = await this.evaluate('FEE', context, entityType, entityId);

    const fees: FeeLineItem[] = [];
    for (const action of decision.actions) {
      if (action.type === 'SET_RATE') {
        const params = action.params as Record<string, unknown>;
        const rate = Number(params.rate) || 0;
        const amount = Math.round((subtotal * rate) / 100 * 100) / 100;
        fees.push({
          feeType: String(params.feeType || 'PLATFORM_FEE'),
          name: String(params.name || 'Service Fee'),
          rate,
          amount,
          ruleId: this.findRuleIdForAction(decision, action),
        });
      } else if (action.type === 'SET_FIXED_AMOUNT') {
        const params = action.params as Record<string, unknown>;
        fees.push({
          feeType: String(params.feeType || 'FIXED_FEE'),
          name: String(params.name || 'Fixed Fee'),
          rate: 0,
          amount: Number(params.amount) || 0,
          ruleId: this.findRuleIdForAction(decision, action),
        });
      }
    }

    const totalFees = fees.reduce((sum, f) => sum + f.amount, 0);

    return {
      baseFees: fees,
      totalFees: Math.round(totalFees * 100) / 100,
      currency: context.currency,
    };
  }

  // ──────────────────────────────────────────────────────
  // Booking Constraint Evaluation
  // ──────────────────────────────────────────────────────

  /**
   * Evaluate booking constraints: blocks, min/max stay, age requirements,
   * document requirements, and price multipliers.
   */
  async evaluateBookingConstraints(
    context: PolicyContext,
    entityType?: string,
    entityId?: string,
  ): Promise<BookingConstraintDecision> {
    const decision = await this.evaluate('BOOKING_CONSTRAINT', context, entityType, entityId);

    const result: BookingConstraintDecision = {
      isAllowed: true,
      blockedReasons: [],
      minStay: null,
      maxStay: null,
      minAge: null,
      requiredDocuments: [],
      priceMultiplier: 1.0,
      appliedRules: decision.appliedRules.map((r) => r.ruleId),
    };

    for (const action of decision.actions) {
      const params = action.params as Record<string, unknown>;

      switch (action.type) {
        case 'BLOCK':
          result.isAllowed = false;
          result.blockedReasons.push({
            reason: String(params.reason || 'Booking not allowed'),
            ruleId: this.findRuleIdForAction(decision, action),
            referenceUrl: params.referenceUrl ? String(params.referenceUrl) : undefined,
          });
          break;

        case 'SET_MIN_MAX': {
          const min = params.min != null ? Number(params.min) : null;
          const max = params.max != null ? Number(params.max) : null;
          const minAge = params.minAge != null ? Number(params.minAge) : null;

          // Take the most restrictive values
          if (min !== null && (result.minStay === null || min > result.minStay)) {
            result.minStay = min;
          }
          if (max !== null && (result.maxStay === null || max < result.maxStay)) {
            result.maxStay = max;
          }
          if (minAge !== null && (result.minAge === null || minAge > result.minAge)) {
            result.minAge = minAge;
          }
          break;
        }

        case 'SET_MULTIPLIER': {
          const multiplier = Number(params.multiplier) || 1.0;
          result.priceMultiplier *= multiplier; // Compound multipliers
          break;
        }

        case 'REQUIRE_DOCUMENT':
          result.requiredDocuments.push({
            documentType: String(params.documentType || 'UNKNOWN'),
            label: params.label ? String(params.label) : undefined,
            threshold: params.threshold != null ? Number(params.threshold) : undefined,
          });
          break;
      }
    }

    return result;
  }

  // ──────────────────────────────────────────────────────
  // Cancellation Policy Evaluation
  // ──────────────────────────────────────────────────────

  /**
   * Evaluate cancellation rules and return tiered refund percentages.
   *
   * CANCELLATION rules should use actions:
   *  - SET_OBJECT { tiers: [{ minHoursBefore, maxHoursBefore, refundPercentage, label }] }
   *  - SET_BOOLEAN { refundServiceFee, refundPlatformFee, alwaysRefundDeposit }
   *  - SET_FIXED_AMOUNT { penalty }
   */
  async evaluateCancellation(
    context: PolicyContext,
    entityType?: string,
    entityId?: string,
  ): Promise<CancellationDecision> {
    const decision = await this.evaluate('CANCELLATION', context, entityType, entityId);

    const result: CancellationDecision = {
      tiers: [],
      refundServiceFee: true,
      refundPlatformFee: true,
      alwaysRefundDeposit: true,
      flatPenalty: 0,
      appliedRules: decision.appliedRules.map((r) => r.ruleId),
    };

    for (const action of decision.actions) {
      const params = action.params as Record<string, unknown>;
      const ruleId = this.findRuleIdForAction(decision, action);

      switch (action.type) {
        case 'SET_OBJECT': {
          const rawTiers = params.tiers as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(rawTiers)) {
            for (const t of rawTiers) {
              result.tiers.push({
                minHoursBefore: Number(t.minHoursBefore) || 0,
                maxHoursBefore: t.maxHoursBefore != null ? Number(t.maxHoursBefore) : null,
                refundPercentage: Number(t.refundPercentage) || 0,
                label: String(t.label || ''),
                ruleId,
              });
            }
          }
          break;
        }

        case 'SET_BOOLEAN':
          if (params.refundServiceFee !== undefined)
            result.refundServiceFee = Boolean(params.refundServiceFee);
          if (params.refundPlatformFee !== undefined)
            result.refundPlatformFee = Boolean(params.refundPlatformFee);
          if (params.alwaysRefundDeposit !== undefined)
            result.alwaysRefundDeposit = Boolean(params.alwaysRefundDeposit);
          break;

        case 'SET_FIXED_AMOUNT':
          result.flatPenalty += Number(params.penalty || params.amount) || 0;
          break;
      }
    }

    // Sort tiers by minHoursBefore descending (most generous tier first)
    result.tiers.sort((a, b) => b.minHoursBefore - a.minHoursBefore);

    return result;
  }

  // ──────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────

  /**
   * Find the rule ID that produced a given action (for audit linkage).
   */
  private findRuleIdForAction(decision: PolicyDecision, action: RuleAction): string {
    for (const rule of decision.appliedRules) {
      if (rule.actions.includes(action)) {
        return rule.ruleId;
      }
    }
    return 'unknown';
  }
}
