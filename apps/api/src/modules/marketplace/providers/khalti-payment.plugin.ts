import { Logger } from '@nestjs/common';
import { PaymentProviderPlugin } from '../services/payment-orchestration.service';

/**
 * Khalti Payment Provider Plugin
 *
 * Integrates with Khalti (Nepal's digital wallet & payment gateway) for:
 * - Payment initiation via Khalti's e-Payment API v2
 * - Payment verification / lookup
 * - Refund processing
 * - Merchant payout
 *
 * API Reference: https://docs.khalti.com/
 *
 * Environment variables required:
 *   KHALTI_SECRET_KEY  - Live/Test secret key from Khalti merchant dashboard
 *   KHALTI_API_URL     - API base URL (sandbox or production)
 */
export class KhaltiPaymentPlugin implements PaymentProviderPlugin {
  readonly name = 'khalti';
  private readonly logger = new Logger(KhaltiPaymentPlugin.name);

  private readonly secretKey: string;
  private readonly apiUrl: string;
  private readonly initialized: boolean;

  constructor(config: {
    secretKey?: string;
    apiUrl?: string;
  }) {
    this.secretKey =
      config.secretKey || process.env.KHALTI_SECRET_KEY || '';
    this.apiUrl =
      config.apiUrl ||
      process.env.KHALTI_API_URL ||
      'https://a.khalti.com'; // production; use https://a.khalti.com for live

    this.initialized = !!this.secretKey;
    if (!this.initialized) {
      this.logger.warn(
        'Khalti payment plugin instantiated without credentials. Payment operations will fail until configured.',
      );
    }
  }

  /**
   * Ensure the plugin has valid credentials before making API calls.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'Khalti payment provider is not configured. Missing required credentials (KHALTI_SECRET_KEY).',
      );
    }
  }

  /**
   * Initiate a Khalti payment.
   *
   * Calls Khalti's e-Payment initiation API to get a payment URL
   * where the user completes payment.
   */
  async authorize(
    amount: number,
    currency: string,
    metadata: Record<string, any>,
  ): Promise<{ transactionId: string; status: string }> {
    this.ensureInitialized();
    if (currency !== 'NPR') {
      throw new Error(`Khalti only supports NPR, received: ${currency}`);
    }

    // Khalti expects amount in paisa (1 NPR = 100 paisa)
    const amountInPaisa = Math.round(amount * 100);
    const purchaseOrderId = `khalti_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const response = await fetch(`${this.apiUrl}/api/v2/epayment/initiate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${this.secretKey}`,
        },
        body: JSON.stringify({
          return_url: metadata.returnUrl || `${metadata.baseUrl || ''}/payments/khalti/callback`,
          website_url: metadata.websiteUrl || metadata.baseUrl || 'https://rental.example.com',
          amount: amountInPaisa,
          purchase_order_id: purchaseOrderId,
          purchase_order_name: metadata.description || 'Rental Payment',
          customer_info: {
            name: metadata.customerName || undefined,
            email: metadata.customerEmail || undefined,
            phone: metadata.customerPhone || undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Khalti initiation failed: ${response.status} ${errorBody}`);
        return { transactionId: purchaseOrderId, status: 'initiation_failed' };
      }

      const data = await response.json();

      this.logger.log(
        `Khalti payment initiated: ${purchaseOrderId}, pidx: ${data.pidx}`,
      );

      return {
        transactionId: purchaseOrderId,
        status: 'pending_redirect',
        ...({
          pidx: data.pidx,
          paymentUrl: data.payment_url,
        } as any),
      };
    } catch (error) {
      this.logger.error(`Khalti authorize error: ${error.message}`);
      return { transactionId: purchaseOrderId, status: 'error' };
    }
  }

  /**
   * Verify/capture a Khalti payment after user completes payment.
   *
   * Calls Khalti's Payment Lookup API to verify transaction status.
   */
  async capture(
    transactionId: string,
    amount: number,
  ): Promise<{ status: string }> {
    this.ensureInitialized();
    try {
      // Khalti uses pidx for lookup. In real integration, pidx would be stored
      // alongside transactionId. Here we try lookup by pidx.
      const response = await fetch(`${this.apiUrl}/api/v2/epayment/lookup/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${this.secretKey}`,
        },
        body: JSON.stringify({
          pidx: transactionId, // Caller should pass pidx here
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `Khalti lookup failed: ${response.status} ${await response.text()}`,
        );
        return { status: 'verification_failed' };
      }

      const data = await response.json();

      // Khalti status values: Completed, Pending, Initiated, Refunded, Expired
      const statusMap: Record<string, string> = {
        Completed: 'captured',
        Pending: 'pending',
        Initiated: 'pending',
        Refunded: 'refunded',
        Expired: 'expired',
      };

      const mappedStatus = statusMap[data.status] || 'unknown';
      this.logger.log(
        `Khalti payment status: ${data.status} → ${mappedStatus} for ${transactionId}`,
      );

      return {
        status: mappedStatus,
        ...({
          khaltiStatus: data.status,
          totalAmount: data.total_amount,
          transactionId: data.transaction_id,
          fee: data.fee,
        } as any),
      };
    } catch (error) {
      this.logger.error(`Khalti capture error: ${error.message}`);
      return { status: 'error' };
    }
  }

  /**
   * Refund a Khalti payment.
   *
   * Note: Khalti refunds are typically handled via merchant dashboard
   * or support. This method logs the refund request.
   */
  async refund(
    transactionId: string,
    amount: number,
    reason?: string,
  ): Promise<{ refundId: string; status: string }> {
    this.ensureInitialized();
    const refundId = `khalti_ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.logger.log(
      `Khalti refund requested: ${refundId} for ${transactionId}, amount: ${amount / 100} NPR, reason: ${reason}`,
    );

    // Khalti doesn't have a public refund API — refunds are processed
    // through the merchant dashboard or by contacting Khalti support
    return {
      refundId,
      status: 'pending_manual_processing',
    };
  }

  /**
   * Payout to recipient.
   *
   * Khalti doesn't have a direct payout API for merchants.
   * Payouts are processed via bank transfer using Khalti's settlement.
   */
  async payout(
    recipientId: string,
    amount: number,
    currency: string,
  ): Promise<{ payoutId: string; status: string }> {
    this.ensureInitialized();
    if (currency !== 'NPR') {
      throw new Error(`Khalti payouts only support NPR`);
    }

    const payoutId = `khalti_payout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.logger.log(
      `Khalti payout queued: ${payoutId} to ${recipientId}, amount: ${amount / 100} NPR`,
    );

    return {
      payoutId,
      status: 'queued',
    };
  }
}
