export interface InsurancePolicy {
  id: string;
  userId: string;
  bookingId?: string;
  listingId?: string;
  policyNumber: string;
  provider: string;
  type: string;
  coverageAmount: number;
  effectiveDate: Date;
  expirationDate: Date;
  documentUrl: string;
  status: string;
  verificationDate?: Date;
  notes?: string;
}