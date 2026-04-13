/**
 * Cross-Module Integration Interfaces
 * 
 * Defines types and interfaces for module communication and event-driven architecture
 */

export interface IntegrationEvent {
  id: string;
  type: string;
  source: string;
  target?: string;
  payload: any;
  timestamp: Date;
  correlationId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface EventHandler {
  eventType: string;
  handler: (event: IntegrationEvent) => Promise<void>;
  priority?: number;
  filter?: (event: IntegrationEvent) => boolean;
}

export interface ModuleIntegration {
  name: string;
  version: string;
  events: string[];
  dependencies: string[];
  handlers: EventHandler[];
}

export interface IntegrationContext {
  moduleName: string;
  operationId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CrossModuleMessage<T = any> {
  sender: string;
  recipient?: string;
  type: string;
  data: T;
  context: IntegrationContext;
  replyTo?: string;
  timeout?: number;
}

export interface IntegrationResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
  context: IntegrationContext;
}

export interface EventBus {
  publish: (event: IntegrationEvent) => Promise<void>;
  subscribe: (handler: EventHandler) => () => void;
  unsubscribe: (eventType: string, handlerId: string) => void;
}

export interface ModuleRegistry {
  register: (module: ModuleIntegration) => void;
  unregister: (moduleName: string) => void;
  getModule: (name: string) => ModuleIntegration | undefined;
  getAllModules: () => ModuleIntegration[];
  checkDependencies: (moduleName: string) => { satisfied: boolean; missing: string[] };
}

export interface IntegrationMetrics {
  eventsPublished: number;
  eventsProcessed: number;
  eventsFailed: number;
  averageProcessingTime: number;
  activeHandlers: number;
  queueSize: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure?: Date;
  successCount: number;
}

export interface IntegrationHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  moduleName: string;
  lastCheck: Date;
  metrics: IntegrationMetrics;
  circuitBreaker?: CircuitBreakerState;
}
