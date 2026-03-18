export enum ModerationStatus {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED',
}

export interface ModerationFlag {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  description: string;
  details?: any;
}

export interface ModerationResult {
  status: ModerationStatus;
  confidence: number;
  flags: ModerationFlag[];
  requiresHumanReview: boolean;
  blockedReasons?: string[];
}