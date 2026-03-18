import { Logger } from '@nestjs/common';
import { PaymentProviderPlugin } from '../services/payment-provider.interface';

/**
 * Razorpay Payment Provider Plugin
 *
 * Integrates with Razorpay (India's leading payment gateway) for:
 * - Order creation & payment authorization
 * - Payment capture & verification
 * - Refund processing
 * - Route-based payouts (Razorpay Route / RazorpayX)
 *
 * API Reference: https://razorpay.com/docs/api/
 *
 * Environment variables required:
 *   RAZORPAY_KEY_ID     - API Key ID
 *   RAZORPAY_KEY_SECRET - API Key Secret
 *   RAZORPAY_API_URL    - API base URL
 */
export class RazorpayPaymentPlugin implements PaymentProviderPlugin {
  readonly name = 'razorpay';
  private readonly logger = new Logger(RazorpayPaymentPlugin.name);

  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly apiUrl: string;
  private readonly initialized: boolean;

  constructor(config: {
    keyId?: string;
    keySecret?: string;
    apiUrl?: string;
  }) {
    this.keyId =
      config.keyId || process.env.RAZORPAY_KEY_ID || '';
    this.keySecret =
      config.keySecret || process.env.RAZORPAY_KEY_SECRET || '';
    this.apiUrl =
      config.apiUrl || process.env.RAZORPAY_API_URL || 'https://api.razorpay.com';

    this.initialized = !!(this.keyId && this.keySecret);
    if (!this.initialized) {
      this.logger.warn(
        'Razorpay payment plugin instantiated without credentials. Payment operations will fail until configured.',
      );
    }
  }

  /**
   * Ensure the plugin has valid credentials before making API calls.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'Razorpay payment provider is not configured. Missing required credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET).',
      );
    }
  }

  /**
   * Create a Razorpay order (authorize).
   */
  async authorize(
    amount: number,
    currency: string,
    metadata: Record<string, any>,
  ): Promise<{ transactionId: string; status: string }> {
    this.ensureInitialized();
    // Razorpay expects amount in smallest unit (paise for INR)
    const amountInPaise = Math.round(amount * 100);

    try {
      const response = await fetch(`${this.apiUrl}/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${btoa(`${this.keyId}:${this.keySecret}`)}`,
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency,
          receipt: metadata.bookingId || `rcpt_${Date.now()}`,
          notes: {
            userId: metadata.userId,
            bookingId: metadata.bookingId,
            platform: 'rental',
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Razorpay order creation failed: ${response.status} ${errorBody}`);
        return {
          transactionId: `rp_err_${Date.now()}`,
          status: 'creation_failed',
        };
      }

      const order = await response.json();

      this.logger.log(
        `Razorpay order created: ${order.id}, amount: ${amount} ${currency}`,
      );

      return {
        transactionId: order.id,
        status: 'created',
        ...({
          orderId: order.id,
          razorpayKeyId: this.keyId,
          amount: order.amount,
          currency: order.currency,
        } as any),
      };
    } catch (error) {
      this.logger.error(`Razorpay authorize error: ${error.message}`);
      return {
        transactionId: `rp_err_${Date.now()}`,
        status: 'error',
      };
    }
  }

  /**
   * Capture a Razorpay payment.
   *
   * After the client-side completes payment, verify the signature
   * and capture the payment.
   */
  async capture(
    transactionId: string,
    amount: number,
  ): Promise<{ status: string }> {
    this.ensureInitialized();
    const amountInPaise = Math.round(amount * 100);

    try {
      const response = await fetch(
        `${this.apiUrl}/v1/payments/${transactionId}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${btoa(`${this.keyId}:${this.keySecret}`)}`,
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: 'INR',
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Razorpay capture failed: ${response.status} ${errorBody}`);
        return { status: 'capture_failed' };
      }

      const payment = await response.json();
      this.logger.log(`Razorpay payment captured: ${transactionId}`);

      return {
        status: payment.status === 'captured' ? 'captured' : payment.status,
      };
    } catch (error) {
      this.logger.error(`Razorpay capture error: ${error.message}`);
      return { status: 'error' };
    }
  }

  /**
   * Refund a Razorpay payment (full or partial).
   */
  async refund(
    transactionId: string,
    amount: number,
    reason?: string,
  ): Promise<{ refundId: string; status: string }> {
    this.ensureInitialized();
    const amountInPaise = Math.round(amount * 100);

    try {
      const response = await fetch(
        `${this.apiUrl}/v1/payments/${transactionId}/refund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${btoa(`${this.keyId}:${this.keySecret}`)}`,
          },
          body: JSON.stringify({
            amount: amountInPaise,
            notes: { reason: reason || 'Customer requested refund' },
            speed: 'normal', // 'normal' (5-7 days) or 'optimum' (instant for eligible)
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Razorpay refund failed: ${response.status} ${errorBody}`);
        return { refundId: `rp_ref_err_${Date.now()}`, status: 'refund_failed' };
      }

      const refund = await response.json();
      this.logger.log(`Razorpay refund created: ${refund.id} for ${transactionId}`);

      return {
        refundId: refund.id,
        status: refund.status === 'processed' ? 'refunded' : 'pending',
      };
    } catch (error) {
      this.logger.error(`Razorpay refund error: ${error.message}`);
      return { refundId: `rp_ref_err_${Date.now()}`, status: 'error' };
    }
  }

  /**
   * Payout via RazorpayX (Fund Accounts → Payouts).
   */
  async payout(
    recipientId: string,
    amount: number,
    currency: string,
  ): Promise<{ payoutId: string; status: string }> {
    this.ensureInitialized();
    const amountInPaise = Math.round(amount * 100);

    try {
      const response = await fetch(`${this.apiUrl}/v1/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${btoa(`${this.keyId}:${this.keySecret}`)}`,
        },
        body: JSON.stringify({
          fund_account_id: recipientId,
          amount: amountInPaise,
          currency,
          mode: 'NEFT', // NEFT, RTGS, IMPS, UPI
          purpose: 'payout',
          queue_if_low_balance: true,
          notes: {
            platform: 'rental',
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Razorpay payout failed: ${response.status} ${errorBody}`);
        return { payoutId: `rp_po_err_${Date.now()}`, status: 'payout_failed' };
      }

      const payout = await response.json();
      this.logger.log(`Razorpay payout created: ${payout.id} to ${recipientId}`);

      return {
        payoutId: payout.id,
        status: payout.status === 'processed' ? 'paid' : 'queued',
      };
    } catch (error) {
      this.logger.error(`Razorpay payout error: ${error.message}`);
      return { payoutId: `rp_po_err_${Date.now()}`, status: 'error' };
    }
  }

  /**
   * Verify Razorpay webhook/callback signature.
   */
  async verifySignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): Promise<boolean> {
    const body = `${orderId}|${paymentId}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.keySecret);
    const msgData = encoder.encode(body);

    try {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );

      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
      const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      return expectedSignature === signature;
    } catch (error) {
      this.logger.warn(`Razorpay webhook signature verification failed: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }
}
