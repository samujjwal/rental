export interface PaymentProviderPlugin {
  name: string;
  authorize(
    amount: number,
    currency: string,
    metadata: Record<string, any>,
  ): Promise<{ transactionId: string; status: string }>;
  capture(transactionId: string, amount: number): Promise<{ status: string }>;
  refund(
    transactionId: string,
    amount: number,
    reason?: string,
  ): Promise<{ refundId: string; status: string }>;
  payout(
    recipientId: string,
    amount: number,
    currency: string,
  ): Promise<{ payoutId: string; status: string }>;
}