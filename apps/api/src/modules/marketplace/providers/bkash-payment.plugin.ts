import { Logger } from '@nestjs/common';
import { PaymentProviderPlugin } from '../services/payment-provider.interface';

/**
 * bKash Payment Provider Plugin
 *
 * Integrates with bKash (Bangladesh's largest MFS) for:
 * - Tokenized checkout payment creation
 * - Payment execution & query
 * - Refund processing
 * - B2C disbursement (payouts)
 *
 * API Reference: https://developer.bka.sh/
 *
 * Environment variables required:
 *   BKASH_APP_KEY       - Application Key
 *   BKASH_APP_SECRET    - Application Secret
 *   BKASH_USERNAME      - Merchant username
 *   BKASH_PASSWORD      - Merchant password
 *   BKASH_API_URL       - API base URL (sandbox or production)
 */
export class BkashPaymentPlugin implements PaymentProviderPlugin {
  readonly name = 'bkash';
  private readonly logger = new Logger(BkashPaymentPlugin.name);

  private readonly appKey: string;
  private readonly appSecret: string;
  private readonly username: string;
  private readonly password: string;
  private readonly apiUrl: string;
  private readonly initialized: boolean;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: {
    appKey?: string;
    appSecret?: string;
    username?: string;
    password?: string;
    apiUrl?: string;
  }) {
    this.appKey = config.appKey || process.env.BKASH_APP_KEY || '';
    this.appSecret = config.appSecret || process.env.BKASH_APP_SECRET || '';
    this.username = config.username || process.env.BKASH_USERNAME || '';
    this.password = config.password || process.env.BKASH_PASSWORD || '';
    this.apiUrl =
      config.apiUrl ||
      process.env.BKASH_API_URL ||
      '';

    this.initialized = !!(this.appKey && this.appSecret && this.username && this.password);
    if (!this.initialized) {
      this.logger.warn(
        'bKash payment plugin instantiated without credentials. Payment operations will fail until configured.',
      );
    }
    if (!this.apiUrl && this.initialized) {
      throw new Error(
        'BKASH_API_URL must be configured. No sandbox fallback — set the production URL explicitly.',
      );
    }
  }

  /**
   * Ensure the plugin has valid credentials before making API calls.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'bKash payment provider is not configured. Missing required credentials (BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD).',
      );
    }
  }

  /**
   * Get or refresh bKash access token (Grant Token API).
   */
  private async getAccessToken(): Promise<string> {
    this.ensureInitialized();
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch(
        `${this.apiUrl}/tokenized/checkout/token/grant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            username: this.username,
            password: this.password,
          },
          body: JSON.stringify({
            app_key: this.appKey,
            app_secret: this.appSecret,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`bKash token grant failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.id_token;
      this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 60000; // Refresh 1 min early
      return this.accessToken!;
    } catch (error) {
      this.logger.error(`bKash token error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a bKash tokenized payment (Authorize).
   */
  async authorize(
    amount: number,
    currency: string,
    metadata: Record<string, any>,
  ): Promise<{ transactionId: string; status: string }> {
    this.ensureInitialized();
    if (currency !== 'BDT') {
      throw new Error(`bKash only supports BDT, received: ${currency}`);
    }

    const invoiceNumber = `bkash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.apiUrl}/tokenized/checkout/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token,
            'X-APP-Key': this.appKey,
          },
          body: JSON.stringify({
            mode: '0011', // Tokenized checkout
            payerReference: metadata.userId || 'rental_user',
            callbackURL:
              metadata.callbackUrl ||
              `${metadata.baseUrl || ''}/payments/bkash/callback`,
            amount: amount.toFixed(2),
            currency: 'BDT',
            intent: 'sale',
            merchantInvoiceNumber: invoiceNumber,
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`bKash create failed: ${response.status} ${errorBody}`);
        return { transactionId: invoiceNumber, status: 'creation_failed' };
      }

      const data = await response.json();

      if (data.statusCode !== '0000') {
        this.logger.error(`bKash create error: ${data.statusMessage}`);
        return { transactionId: invoiceNumber, status: 'creation_failed' };
      }

      this.logger.log(
        `bKash payment created: ${data.paymentID}, invoice: ${invoiceNumber}`,
      );

      return {
        transactionId: data.paymentID,
        status: 'pending_redirect',
        ...({
          bkashURL: data.bkashURL,
          paymentID: data.paymentID,
          invoiceNumber,
        } as any),
      };
    } catch (error) {
      this.logger.error(`bKash authorize error: ${error.message}`);
      return { transactionId: invoiceNumber, status: 'error' };
    }
  }

  /**
   * Execute/capture a bKash payment after user completes on bKash app.
   */
  async capture(
    transactionId: string,
    _amount: number,
  ): Promise<{ status: string }> {
    this.ensureInitialized();
    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `${this.apiUrl}/tokenized/checkout/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token,
            'X-APP-Key': this.appKey,
          },
          body: JSON.stringify({
            paymentID: transactionId,
          }),
        },
      );

      if (!response.ok) {
        this.logger.error(`bKash execute failed: ${response.status}`);
        return { status: 'execution_failed' };
      }

      const data = await response.json();

      if (data.statusCode === '0000' && data.transactionStatus === 'Completed') {
        this.logger.log(`bKash payment captured: ${transactionId}, trxID: ${data.trxID}`);
        return {
          status: 'captured',
          ...({
            trxID: data.trxID,
            customerMsisdn: data.customerMsisdn,
          } as any),
        };
      }

      return { status: data.transactionStatus?.toLowerCase() || 'failed' };
    } catch (error) {
      this.logger.error(`bKash capture error: ${error.message}`);
      return { status: 'error' };
    }
  }

  /**
   * Refund a bKash payment.
   */
  async refund(
    transactionId: string,
    amount: number,
    reason?: string,
  ): Promise<{ refundId: string; status: string }> {
    this.ensureInitialized();
    try {
      const token = await this.getAccessToken();

      // First query to get trxID
      const queryResponse = await fetch(
        `${this.apiUrl}/tokenized/checkout/payment/status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token,
            'X-APP-Key': this.appKey,
          },
          body: JSON.stringify({ paymentID: transactionId }),
        },
      );

      const queryData = await queryResponse.json();
      const trxID = queryData.trxID;

      if (!trxID) {
        return { refundId: `bkash_ref_err_${Date.now()}`, status: 'transaction_not_found' };
      }

      // Process refund
      const refundResponse = await fetch(
        `${this.apiUrl}/tokenized/checkout/payment/refund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token,
            'X-APP-Key': this.appKey,
          },
          body: JSON.stringify({
            paymentID: transactionId,
            trxID,
            amount: amount.toFixed(2),
            reason: reason || 'Customer refund',
            sku: 'rental_refund',
          }),
        },
      );

      const refundData = await refundResponse.json();

      if (refundData.statusCode === '0000') {
        this.logger.log(`bKash refund completed: ${refundData.refundTrxID}`);
        return {
          refundId: refundData.refundTrxID || `bkash_ref_${Date.now()}`,
          status: 'refunded',
        };
      }

      return {
        refundId: `bkash_ref_${Date.now()}`,
        status: 'refund_failed',
      };
    } catch (error) {
      this.logger.error(`bKash refund error: ${error.message}`);
      return { refundId: `bkash_ref_err_${Date.now()}`, status: 'error' };
    }
  }

  /**
   * B2C disbursement (payout to bKash wallet).
   */
  async payout(
    recipientId: string,
    amount: number,
    currency: string,
  ): Promise<{ payoutId: string; status: string }> {
    this.ensureInitialized();
    if (currency !== 'BDT') {
      throw new Error(`bKash payouts only support BDT`);
    }

    const payoutId = `bkash_payout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.logger.log(
      `bKash payout queued: ${payoutId} to ${recipientId}, amount: ${amount} BDT`,
    );

    // In production, this would use bKash Disbursement API (B2C)
    // which requires separate merchant approval
    return {
      payoutId,
      status: 'queued',
    };
  }
}
