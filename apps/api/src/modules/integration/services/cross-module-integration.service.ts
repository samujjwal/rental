/**
 * Cross-Module Integration Service
 * 
 * Manages event-driven communication between modules
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  IntegrationEvent,
  EventHandler,
  ModuleIntegration,
  IntegrationContext,
  IntegrationMetrics,
  IntegrationHealth,
} from '../interfaces/integration.interface';

@Injectable()
export class CrossModuleIntegrationService implements OnModuleDestroy {
  private readonly logger = new Logger(CrossModuleIntegrationService.name);
  private modules = new Map<string, ModuleIntegration>();
  private handlers = new Map<string, Set<EventHandler>>();
  private eventQueue: IntegrationEvent[] = [];
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;

  private metrics: IntegrationMetrics = {
    eventsPublished: 0,
    eventsProcessed: 0,
    eventsFailed: 0,
    averageProcessingTime: 0,
    activeHandlers: 0,
    queueSize: 0,
  };

  private processingTimes: number[] = [];

  constructor() {
    // Start event processing loop
    this.processingInterval = setInterval(() => this.processEvents(), 100);
  }

  onModuleDestroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }

  registerModule(module: ModuleIntegration): void {
    this.modules.set(module.name, module);

    // Register event handlers
    module.handlers.forEach((handler) => {
      this.subscribe(handler);
    });

    this.logger.log(`Registered module: ${module.name} v${module.version}`);

    // Check dependencies
    const deps = this.checkDependencies(module.name);
    if (!deps.satisfied) {
      this.logger.warn(`Module ${module.name} has missing dependencies: ${deps.missing.join(', ')}`);
    }
  }

  unregisterModule(moduleName: string): void {
    const module = this.modules.get(moduleName);
    if (!module) return;

    // Unsubscribe handlers
    module.handlers.forEach((handler) => {
      this.unsubscribe(handler.eventType, moduleName);
    });

    this.modules.delete(moduleName);
    this.logger.log(`Unregistered module: ${moduleName}`);
  }

  checkDependencies(moduleName: string): { satisfied: boolean; missing: string[] } {
    const module = this.modules.get(moduleName);
    if (!module) {
      return { satisfied: false, missing: ['Module not found'] };
    }

    const missing = module.dependencies.filter((dep) => !this.modules.has(dep));
    return {
      satisfied: missing.length === 0,
      missing,
    };
  }

  async publishEvent(event: Omit<IntegrationEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: IntegrationEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
    };

    this.eventQueue.push(fullEvent);
    this.metrics.eventsPublished++;
    this.metrics.queueSize = this.eventQueue.length;

    this.logger.debug(`Published event: ${fullEvent.type} (${fullEvent.id})`);
  }

  subscribe(handler: EventHandler): () => void {
    if (!this.handlers.has(handler.eventType)) {
      this.handlers.set(handler.eventType, new Set());
    }

    this.handlers.get(handler.eventType)!.add(handler);
    this.metrics.activeHandlers = this.getTotalHandlerCount();

    this.logger.debug(`Subscribed handler for event type: ${handler.eventType}`);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(handler.eventType, handler.eventType);
    };
  }

  unsubscribe(eventType: string, handlerId: string): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => {
        if (handler.eventType === handlerId) {
          handlers.delete(handler);
        }
      });

      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }

    this.metrics.activeHandlers = this.getTotalHandlerCount();
  }

  private async processEvents(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      this.metrics.queueSize = this.eventQueue.length;

      const startTime = Date.now();

      try {
        await this.processEvent(event);

        const processingTime = Date.now() - startTime;
        this.processingTimes.push(processingTime);

        // Keep only last 100 processing times
        if (this.processingTimes.length > 100) {
          this.processingTimes.shift();
        }

        this.metrics.averageProcessingTime =
          this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;

        this.metrics.eventsProcessed++;
      } catch (error) {
        this.logger.error(`Failed to process event ${event.id}: ${error}`);
        this.metrics.eventsFailed++;
      }
    }

    this.isProcessing = false;
  }

  private async processEvent(event: IntegrationEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);

    if (!handlers || handlers.size === 0) {
      this.logger.warn(`No handlers for event type: ${event.type}`);
      return;
    }

    // Sort handlers by priority (higher priority first)
    const sortedHandlers = Array.from(handlers).sort(
      (a, b) => (b.priority || 0) - (a.priority || 0),
    );

    // Execute handlers
    for (const handler of sortedHandlers) {
      // Check filter if present
      if (handler.filter && !handler.filter(event)) {
        continue;
      }

      // Check if handler is for specific target
      if (event.target && handler.eventType !== event.type) {
        continue;
      }

      try {
        await handler.handler(event);
      } catch (error) {
        this.logger.error(`Handler failed for event ${event.id}: ${error}`);
        // Continue with other handlers even if one fails
      }
    }
  }

  createContext(moduleName: string, operationId?: string): IntegrationContext {
    return {
      moduleName,
      operationId: operationId || this.generateOperationId(),
      timestamp: new Date(),
    };
  }

  getModule(name: string): ModuleIntegration | undefined {
    return this.modules.get(name);
  }

  getAllModules(): ModuleIntegration[] {
    return Array.from(this.modules.values());
  }

  getMetrics(): IntegrationMetrics {
    return { ...this.metrics };
  }

  getHealth(): IntegrationHealth[] {
    return Array.from(this.modules.values()).map((module) => ({
      status: this.checkDependencies(module.name).satisfied ? 'healthy' : 'degraded',
      moduleName: module.name,
      lastCheck: new Date(),
      metrics: this.getMetrics(),
    }));
  }

  private getTotalHandlerCount(): number {
    let count = 0;
    this.handlers.forEach((handlers) => {
      count += handlers.size;
    });
    return count;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
