/**
 * PaymentProvider — Gateway abstraction interface.
 *
 * This interface decouples the domain layer from any specific payment gateway (Stripe, Razorpay, etc.).
 * New payment gateways can be added by implementing this interface and registering the provider in the module.
 *
 * The PaymentProviderFactory selects the correct provider based on country/currency configuration.
 */

export interface PaymentProviderConfig {
  /** Unique provider identifier, e.g. 'stripe', 'razorpay', 'paystack' */
  providerId: string;
  /** Human-readable name */
  name: string;
  /** Supported ISO 3166-1 alpha-2 country codes */
  supportedCountries: string[];
  /** Supported ISO 4217 currency codes */
  supportedCurrencies: string[];
}

export interface CreatePaymentIntentParams {
  bookingId: string;
  amount: number;
  currency: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  providerId: string;
}

export interface HoldDepositParams {
  bookingId: string;
  amount: number;
  currency: string;
}

export interface RefundParams {
  paymentIntentId: string;
  amount: number;
  currency: string;
  reason?: string;
}

export interface PayoutParams {
  accountId: string;
  amount: number;
  currency: string;
}

export interface CreateConnectAccountResult {
  accountId: string;
}

export interface AccountStatus {
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

/**
 * PaymentProvider — Interface that all payment gateway implementations must satisfy.
 */
export interface PaymentProvider {
  /** Unique provider identifier */
  readonly providerId: string;

  /** Provider configuration (supported countries, currencies) */
  readonly config: PaymentProviderConfig;

  // ─── Customer / Account Management ──────────────────────────────
  createCustomer(userId: string, email: string, name: string): Promise<string>;
  createConnectAccount(userId: string, email: string): Promise<string>;
  createAccountLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<string>;
  getAccountStatus(accountId: string): Promise<AccountStatus>;

  // ─── Payment Operations ─────────────────────────────────────────
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResult>;
  capturePaymentIntent(paymentIntentId: string): Promise<void>;

  // ─── Deposit Operations ─────────────────────────────────────────
  holdDeposit(params: HoldDepositParams): Promise<string>;
  releaseDeposit(depositHoldId: string): Promise<void>;
  captureDeposit(depositHoldId: string, amount?: number): Promise<void>;

  // ─── Refunds & Payouts ──────────────────────────────────────────
  createRefund(params: RefundParams): Promise<string>;
  createPayout(params: PayoutParams): Promise<string>;

  // ─── Payment Methods ────────────────────────────────────────────
  attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;
  setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;
  getPaymentMethods(customerId: string): Promise<any>;
}

/**
 * PAYMENT_PROVIDER injection token.
 * Use with NestJS DI: @Inject(PAYMENT_PROVIDER)
 */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
