/**
 * Rule Evaluator — Pure-function rule condition evaluator.
 *
 * Evaluates JSON-based conditions against a PolicyContext.
 * Zero side effects. Fully testable in isolation.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  RuleCondition,
  ConditionOperator,
  ConditionResult,
  PolicyContext,
  RuleEvaluationResult,
  SerializedPolicyRule,
} from '../interfaces';

@Injectable()
export class RuleEvaluatorService {
  private readonly logger = new Logger(RuleEvaluatorService.name);

  /**
   * Evaluate all conditions of a rule against a context.
   * ALL conditions must match for the rule to be considered matched (AND logic).
   */
  evaluateRule(rule: SerializedPolicyRule, context: PolicyContext): RuleEvaluationResult {
    const conditionResults = rule.conditions.map((c) => this.evaluateCondition(c, context));
    const matched = conditionResults.length === 0 || conditionResults.every((r) => r.matched);

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      matched,
      conditionResults,
      actions: matched ? rule.actions : [],
    };
  }

  /**
   * Evaluate a single condition against a context.
   */
  evaluateCondition(condition: RuleCondition, context: PolicyContext): ConditionResult {
    const actualValue = this.resolveField(condition.field, context);
    const rawResult = this.compare(actualValue, condition.operator, condition.value);
    const matched = condition.negate ? !rawResult : rawResult;

    return {
      field: condition.field,
      operator: condition.operator,
      expected: condition.value,
      actual: actualValue,
      matched,
    };
  }

  /**
   * Resolve a dot-path field from the PolicyContext.
   * Supports nested access like "workspaceConfig.maxListings".
   */
  resolveField(field: string, context: PolicyContext): unknown {
    const parts = field.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Compare an actual value against an expected value using the given operator.
   * This is a pure function with no side effects.
   */
  compare(actual: unknown, operator: ConditionOperator, expected: unknown): boolean {
    switch (operator) {
      case 'always':
        return true;

      case 'eq':
        return actual === expected;

      case 'neq':
        return actual !== expected;

      case 'gt':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;

      case 'gte':
        return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;

      case 'lt':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;

      case 'lte':
        return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;

      case 'in':
        return Array.isArray(expected) && expected.includes(actual);

      case 'nin':
        return Array.isArray(expected) && !expected.includes(actual);

      case 'between': {
        if (!Array.isArray(expected) || expected.length !== 2) return false;
        const num = typeof actual === 'number' ? actual : NaN;
        return num >= (expected[0] as number) && num <= (expected[1] as number);
      }

      case 'contains':
        return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);

      case 'startsWith':
        return typeof actual === 'string' && typeof expected === 'string' && actual.startsWith(expected);

      case 'regex': {
        if (typeof actual !== 'string' || typeof expected !== 'string') return false;
        try {
          return new RegExp(expected, 'i').test(actual);
        } catch {
          this.logger.warn(`Invalid regex pattern in rule condition: ${expected}`);
          return false;
        }
      }

      case 'exists':
        return actual !== null && actual !== undefined;

      case 'dayOfWeek': {
        if (typeof actual !== 'string' || !Array.isArray(expected)) return false;
        try {
          const day = new Date(actual).getUTCDay();
          return expected.includes(day);
        } catch (error) {
          this.logger.debug(`dayOfWeek evaluation failed for value '${actual}': ${error instanceof Error ? error.message : error}`);
          return false;
        }
      }

      case 'dateRange': {
        if (typeof actual !== 'string' || !Array.isArray(expected) || expected.length !== 2) return false;
        try {
          const date = new Date(actual).getTime();
          const start = new Date(expected[0] as string).getTime();
          const end = new Date(expected[1] as string).getTime();
          return date >= start && date <= end;
        } catch (error) {
          this.logger.debug(`dateRange evaluation failed for value '${actual}': ${error instanceof Error ? error.message : error}`);
          return false;
        }
      }

      default:
        this.logger.warn(`Unknown condition operator: ${operator}`);
        return false;
    }
  }
}
