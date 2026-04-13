/**
 * Partial Failure Handling Interfaces
 * 
 * Defines types and interfaces for handling partial failures gracefully
 */

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  fallbackUsed?: boolean;
  partialData?: Partial<T>;
}

export interface BatchOperationResult<T> {
  successful: T[];
  failed: Array<{ item: T; error: Error }>;
  partial: boolean;
  totalCount: number;
  successCount: number;
  failureCount: number;
}

export interface FallbackStrategy<T> {
  name: string;
  execute: () => Promise<T> | T;
  priority: number;
}

export interface DegradationLevel {
  level: number;
  name: string;
  features: string[];
  disabledFeatures: string[];
}

export interface PartialFailureConfig {
  maxFailures?: number;
  degradationLevels: DegradationLevel[];
  fallbackStrategies?: Record<string, FallbackStrategy<any>>;
  recoveryTimeout?: number;
  notificationEnabled?: boolean;
}

export interface FailureContext {
  operation: string;
  component: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  error: Error;
  data?: any;
}

export interface RecoveryStrategy {
  name: string;
  condition: (failure: FailureContext) => boolean;
  action: (failure: FailureContext) => Promise<boolean>;
  maxAttempts: number;
  backoffDelay: number;
}

export interface PartialFailureMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  fallbackUsages: number;
  degradedOperations: number;
  currentDegradationLevel: number;
  recoveriesAttempted: number;
  recoveriesSuccessful: number;
}
