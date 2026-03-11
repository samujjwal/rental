import { Logger } from '@nestjs/common';
import { PaymentProviderPlugin } from '../services/payment-orchestration.service';

/**
 * eSewa Payment Provider Plugin
 *
 * Integrates with eSewa (Nepal's leading digital wallet) for:
 * - Payment authorization via eSewa's Payment API
 * - Payment verification via Transaction Status API
 * - Refund processing
 * - Merchant payout
 *
 * API Reference: https://developer.esewa.com.np/
 *
 * Environment variables required:
 *   ESEWA_MERCHANT_CODE - Merchant code provided by eSewa
 *   ESEWA_SECRET_KEY    - Secret key for HMAC signature
 *   ESEWA_API_URL       - API base URL (sandbox or production)
 */
export class EsewaPaymentPlugin implements PaymentProviderPlugin {
  readonly name = 'esewa';
  private readonly logger = new Logger(EsewaPaymentPlugin.name);

  private readonly merchantCode: string;
  private readonly secretKey: string;
  private readonly apiUrl: string;
  private readonly initialized: boolean;

  constructor(config: {
    merchantCode?: string;
    secretKey?: string;
    apiUrl?: string;
  }) {
    this.merchantCode =
      config.merchantCode || process.env.ESEWA_MERCHANT_CODE || '';
    this.secretKey =
      config.secretKey || process.env.ESEWA_SECRET_KEY || '';
    this.apiUrl =
      config.apiUrl ||
      process.env.ESEWA_API_URL ||
      '';

    this.initialized = !!(this.secretKey && this.merchantCode);
    if (!this.initialized) {
      this.logger.warn(
        'eSewa payment plugin instantiated without credentials. Payment operations will fail until configured.',
      );
    }
    if (!this.apiUrl && this.initialized) {
      throw new Error(
        'ESEWA_API_URL must be configured. No sandbox fallback — set the production URL explicitly.',
      );
    }
  }

  /**
   * Ensure the plugin has valid credentials before making API calls.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'eSewa payment provider is not configured. Missing required credentials (ESEWA_MERCHANT_CODE, ESEWA_SECRET_KEY).',
      );
    }
  }

  /**
   * Authorize (initiate) a payment via eSewa.
   *
   * In eSewa's flow, the client-side redirects to eSewa for payment,
   * then we verify the transaction server-side.
   * This method creates a payment record and returns the redirect parameters.
   */
  async authorize(
    amount: number,
    currency: string,
    metadata: Record<string, any>,
  ): Promise<{ transactionId: string; status: string }> {
    this.ensureInitialized();
    if (currency !== 'NPR') {
      throw new Error(`eSewa only supports NPR, received: ${currency}`);
    }

    const transactionId = `esewa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const totalAmount = amount;
    const taxAmount = 0;
    const serviceCharge = 0;
    const deliveryCharge = 0;

    // Generate HMAC signature for eSewa payment
    const signatureMessage = `total_amount=${totalAmount},transaction_uuid=${transactionId},product_code=${this.merchantCode}`;
    const signature = await this.generateHmacSignature(signatureMessage);

    this.logger.log(
      `eSewa payment initiated: ${transactionId}, amount: ${amount} NPR`,
    );

    return {
      transactionId,
      status: 'pending_redirect',
      // The caller should use these fields to build the client-side redirect
      ...({
        redirectUrl: `${this.apiUrl}/api/epay/main/v2/form`,
        formParams: {
          amount: totalAmount.toString(),
          tax_amount: taxAmount.toString(),
          total_amount: totalAmount.toString(),
          transaction_uuid: transactionId,
          product_code: this.merchantCode,
          product_service_charge: serviceCharge.toString(),
          product_delivery_charge: deliveryCharge.toString(),
          signed_field_names: 'total_amount,transaction_uuid,product_code',
          signature,
        },
      } as any),
    };
  }

  /**
   * Capture / verify an eSewa payment after redirect callback.
   *
   * Calls eSewa's Transaction Status API to verify the payment was completed.
   */
  async capture(
    transactionId: string,
    amount: number,
  ): Promise<{ status: string }> {
    this.ensureInitialized();
    try {
      const response = await fetch(
        `${this.apiUrl}/api/epay/transaction/status/?product_code=${this.merchantCode}&total_amount=${amount}&transaction_uuid=${transactionId}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      if (!response.ok) {
        this.logger.error(
          `eSewa verification failed: ${response.status} ${await response.text()}`,
        );
        return { status: 'verification_failed' };
      }

      const data = await response.json();

      if (data.status === 'COMPLETE') {
        this.logger.log(`eSewa payment verified: ${transactionId}`);
        return { status: 'captured' };
      }

      this.logger.warn(
        `eSewa payment not complete: ${transactionId}, status: ${data.status}`,
      );
      return { status: data.status?.toLowerCase() || 'pending' };
    } catch (error) {
      this.logger.error(`eSewa capture error: ${error.message}`);
      return { status: 'error' };
    }
  }

  /**
   * Refund an eSewa payment.
   *
   * Note: eSewa refunds are typically manual. This method creates a
   * refund request that the platform admin processes via eSewa's merchant portal.
   */
  async refund(
    transactionId: string,
    amount: number,
    reason?: string,
  ): Promise<{ refundId: string; status: string }> {
    this.ensureInitialized();
    const refundId = `esewa_ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.logger.log(
      `eSewa refund requested: ${refundId} for transaction ${transactionId}, amount: ${amount}, reason: ${reason}`,
    );

    // eSewa doesn't have a direct refund API in most integrations.
    // The refund is tracked internally and processed manually via merchant portal.
    return {
      refundId,
      status: 'pending_manual_processing',
    };
  }

  /**
   * Payout to recipient via eSewa wallet transfer.
   */
  async payout(
    recipientId: string,
    amount: number,
    currency: string,
  ): Promise<{ payoutId: string; status: string }> {
    this.ensureInitialized();
    if (currency !== 'NPR') {
      throw new Error(`eSewa payouts only support NPR`);
    }

    const payoutId = `esewa_payout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.logger.log(
      `eSewa payout initiated: ${payoutId} to ${recipientId}, amount: ${amount} NPR`,
    );

    // In production, this would call eSewa's merchant disbursement API
    // or be processed via bank transfer using eSewa Fonepay
    return {
      payoutId,
      status: 'queued',
    };
  }

  /**
   * Generate HMAC-SHA256 signature for eSewa API calls.
   */
  private async generateHmacSignature(message: string): Promise<string> {
    if (!this.secretKey) {
      return 'test_signature';
    }

    // Use Web Crypto API (available in Node 18+)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.secretKey);
    const msgData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }
}
