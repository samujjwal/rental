/**
 * AiUsageLedgerService
 *
 * Persists per-request AI token usage to the `ai_usage_ledger` table so that:
 * - Engineering can report actual OpenAI spend per user/org/prompt.
 * - A future budget-cap guard can query this table to enforce spend limits.
 *
 * Cost estimate uses rough USD-cent prices for GPT-4o-mini / GPT-4o.
 * Actual billing should always be reconciled against the OpenAI dashboard.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface RecordUsageInput {
  userId?: string;
  organizationId?: string;
  promptId: string;
  promptVersion: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Approximate cost per 1 000 tokens in USD cents (integer arithmetic). */
const COST_PER_1K_INPUT_CENTS: Record<string, number> = {
  'gpt-4o': 250,       // $2.50 / 1k input tokens
  'gpt-4o-mini': 15,   // $0.15 / 1k input tokens
  'gpt-3.5-turbo': 50, // $0.50 / 1k input tokens (legacy)
};
const COST_PER_1K_OUTPUT_CENTS: Record<string, number> = {
  'gpt-4o': 1000,
  'gpt-4o-mini': 60,
  'gpt-3.5-turbo': 150,
};

function estimateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const modelKey = Object.keys(COST_PER_1K_INPUT_CENTS).find(k => model.startsWith(k)) ?? '';
  const inputRate = COST_PER_1K_INPUT_CENTS[modelKey] ?? 0;
  const outputRate = COST_PER_1K_OUTPUT_CENTS[modelKey] ?? 0;
  return Math.round((inputTokens / 1000) * inputRate + (outputTokens / 1000) * outputRate);
}

@Injectable()
export class AiUsageLedgerService {
  private readonly logger = new Logger(AiUsageLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist a single AI request's token usage.
   * Failures are logged and swallowed — cost tracking must never break the main flow.
   */
  async record(input: RecordUsageInput): Promise<void> {
    try {
      const totalTokens = input.inputTokens + input.outputTokens;
      const estimatedCostCents = estimateCostCents(input.model, input.inputTokens, input.outputTokens);

      await (this.prisma as any).aiUsageLedger.create({
        data: {
          userId: input.userId ?? 'anonymous',
          organizationId: input.organizationId ?? null,
          promptId: input.promptId,
          promptVersion: input.promptVersion,
          model: input.model,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          totalTokens,
          estimatedCostCents,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to record AI usage: ${err?.message}`);
    }
  }

  /**
   * Aggregate total token usage and estimated cost for a user in the current calendar month.
   * Used by a future budget-cap guard.
   */
  async getMonthlyUsage(userId: string): Promise<{ totalTokens: number; estimatedCostCents: number }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await (this.prisma as any).aiUsageLedger.aggregate({
      where: { userId, createdAt: { gte: startOfMonth } },
      _sum: { totalTokens: true, estimatedCostCents: true },
    });

    return {
      totalTokens: result._sum.totalTokens ?? 0,
      estimatedCostCents: result._sum.estimatedCostCents ?? 0,
    };
  }

  /**
   * Aggregate usage grouped by promptId for operational reporting.
   */
  async getPromptUsageSummary(since: Date): Promise<Array<{ promptId: string; totalTokens: number; estimatedCostCents: number; callCount: number }>> {
    const rows = await (this.prisma as any).aiUsageLedger.groupBy({
      by: ['promptId'],
      where: { createdAt: { gte: since } },
      _sum: { totalTokens: true, estimatedCostCents: true },
      _count: { id: true },
      orderBy: { _sum: { estimatedCostCents: 'desc' } },
    });

    return rows.map((r: any) => ({
      promptId: r.promptId,
      totalTokens: r._sum.totalTokens ?? 0,
      estimatedCostCents: r._sum.estimatedCostCents ?? 0,
      callCount: r._count.id ?? 0,
    }));
  }
}
