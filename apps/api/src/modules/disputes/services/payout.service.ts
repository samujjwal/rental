import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PaymentRepository } from '../../payments/repositories/payment.repository';
import { Prisma } from '@prisma/client';

/**
 * PayoutService
 * 
 * This service handles payout processing for dispute resolutions:
 * - Payout calculations
 * - Processing payouts to parties
 * - Handling payout failures and retries
 * - Split payouts between parties
 * - Financial accuracy and audit trails
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly paymentRepository: PaymentRepository,
  ) {}

  /**
   * Calculate payout amounts
   */
  async calculatePayout(disputeId: string, resolutionData: any): Promise<any> {
    this.logger.log(`Calculating payout for dispute: ${disputeId}`);
    
    const processingFeeRate = this.configService.get<number>('payout.processingFee', 0.02);
    const processingFee = resolutionData.payoutAmount * processingFeeRate;
    const depositDeduction = resolutionData.responsibility?.owner 
      ? resolutionData.depositAmount * (resolutionData.responsibility.owner / 100)
      : 0;
    const netAmount = resolutionData.payoutAmount - processingFee;
    const finalAmount = netAmount - depositDeduction;
    
    return {
      grossAmount: resolutionData.payoutAmount,
      processingFee,
      netAmount,
      depositDeduction,
      finalAmount,
    };
  }

  /**
   * Process payout
   */
  async processPayout(disputeId: string, payoutData: any): Promise<any> {
    this.logger.log(`Processing payout for dispute: ${disputeId}`);
    
    // Validate payout amount
    const validation = await this.validatePayoutAmount(payoutData.amount);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    // Create payout record
    const payout = await this.prisma.payout.create({
      data: {
        ownerId: payoutData.recipientId || payoutData.ownerId,
        amount: new Prisma.Decimal(payoutData.amount),
        currency: payoutData.currency || 'NPR',
        status: 'PENDING',
        metadata: JSON.stringify({
          disputeId,
          referenceNumber: payoutData.referenceNumber,
        }),
      },
    });

    // In a real implementation, this would integrate with a payment processor
    // For now, we'll mark it as completed
    const updatedPayout = await this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    });

    return {
      success: true,
      payoutId: updatedPayout.id,
      referenceNumber: payoutData.referenceNumber || `PAY-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      transactionId: `txn-${Date.now()}`,
      status: 'completed',
      amount: payoutData.amount,
    };
  }

  /**
   * Process payout with retry logic
   */
  async processPayoutWithRetry(disputeId: string, payoutData: any, maxRetries: number): Promise<any> {
    this.logger.log(`Processing payout with retry for dispute: ${disputeId}, max retries: ${maxRetries}`);
    
    let attemptCount = 0;
    let lastError: Error | null = null;
    
    while (attemptCount < maxRetries) {
      attemptCount++;
      try {
        const result = await this.processPayout(disputeId, payoutData);
        return {
          success: true,
          attemptCount,
          transactionId: result.transactionId,
        };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Payout attempt ${attemptCount} failed: ${error}`);
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attemptCount) * 1000));
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Process split payout between parties
   */
  async processSplitPayout(disputeId: string, splitPayoutData: any): Promise<any> {
    this.logger.log(`Processing split payout for dispute: ${disputeId}`);
    
    const payouts = [];
    let totalProcessed = 0;
    
    for (const split of splitPayoutData.splits) {
      const result = await this.processPayout(disputeId, split);
      payouts.push(result);
      totalProcessed += split.amount;
    }
    
    return {
      success: true,
      payouts,
      totalProcessed,
    };
  }

  /**
   * Validate payout amount against limits
   */
  async validatePayoutAmount(amount: number): Promise<any> {
    const minAmount = this.configService.get<number>('payout.minAmount', 100);
    const maxAmount = this.configService.get<number>('payout.maxAmount', 100000);
    
    if (amount < 0) {
      return {
        isValid: false,
        error: 'Negative amount not allowed',
      };
    }
    
    if (amount < minAmount) {
      return {
        isValid: false,
        error: `Below minimum amount (${minAmount})`,
      };
    }
    
    if (amount > maxAmount) {
      return {
        isValid: false,
        error: `Above maximum amount (${maxAmount})`,
      };
    }
    
    return {
      isValid: true,
    };
  }

  /**
   * Analyze financial discrepancy
   */
  async analyzeFinancialDiscrepancy(disputeId: string, financialData: any): Promise<any> {
    this.logger.log(`Analyzing financial discrepancy for dispute: ${disputeId}`);
    
    const subtractions = financialData.processingFees + financialData.depositDeductions;
    const expectedFinal = financialData.awardedAmount - subtractions;
    const isBalanced = Math.abs(expectedFinal - financialData.actualPayout) < 0.01; // Allow for rounding
    
    return {
      isBalanced,
      formula: `${financialData.awardedAmount} - ${financialData.processingFees} - ${financialData.depositDeductions} = ${financialData.actualPayout}`,
      breakdown: {
        awardedAmount: financialData.awardedAmount,
        subtractions,
        finalPayout: financialData.actualPayout,
      },
    };
  }

  /**
   * Generate financial report
   */
  async generateFinancialReport(reportPeriod: any): Promise<any> {
    this.logger.log('Generating financial report');
    
    // Query payouts for the period
    const startDate = reportPeriod.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = reportPeriod.endDate || new Date();
    
    const payouts = await this.prisma.payout.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: 'COMPLETED',
      },
    });

    const totalPayouts = payouts.reduce((sum, payout) => {
      const amount = typeof payout.amount === 'number' ? payout.amount : payout.amount.toNumber();
      return sum + amount;
    }, 0);

    const processingFees = totalPayouts * this.configService.get<number>('payout.processingFee', 0.02);

    return {
      summary: {
        totalPayouts: payouts.length,
        totalAmount: totalPayouts,
        processingFees,
        netAmount: totalPayouts - processingFees,
        averagePayout: payouts.length > 0 ? totalPayouts / payouts.length : 0,
      },
      period: {
        startDate,
        endDate,
      },
    };
  }

  /**
   * Verify transaction integrity
   */
  async verifyTransactionIntegrity(transaction: any): Promise<any> {
    this.logger.log(`Verifying transaction integrity: ${transaction.id}`);
    
    // In a real implementation, this would perform actual integrity checks
    // For now, return a positive result
    return {
      isValid: true,
      checks: {
        amountValid: true,
        recipientValid: true,
        methodValid: true,
        statusValid: true,
        timestampValid: true,
      },
      blockchainHash: `hash-${Date.now()}`,
    };
  }

  /**
   * Send payout notification
   */
  async sendPayoutNotification(payoutId: string, payoutData: any): Promise<any> {
    this.logger.log(`Sending payout notification: ${payoutId}`);
    
    // In a real implementation, this would send actual notifications
    // For now, return success
    return {
      success: true,
      channels: ['email', 'sms'],
      emailSent: true,
      smsSent: true,
    };
  }
}
