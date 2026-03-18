export type PaymentCommandStatus = 'PENDING' | 'ENQUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type PaymentCommandType = 'PAYOUT' | 'REFUND' | 'DEPOSIT_RELEASE';

export interface PaymentCommandPayload {
  commandType: PaymentCommandType;
  status: PaymentCommandStatus;
  amount: number;
  currency: string;
  queueName: string;
  requestedAt: string;
  reason?: string;
  requestedByRole?: string;
  jobName?: string;
  jobId?: string;
  processedAt?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}