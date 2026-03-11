import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface AuthEvent {
  userId?: string;
  userRole?: string;
  listingId: string;
  listingStatus: string;
  accessGranted: boolean;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface AuthMetrics {
  totalRequests: number;
  successfulAccess: number;
  deniedAccess: number;
  publicAccess: number;
  ownerAccess: number;
  adminAccess: number;
  failedAuth: number;
  suspiciousActivity: number;
}

@Injectable()
export class ListingAuthMonitorService {
  private readonly logger = new Logger(ListingAuthMonitorService.name);
  private readonly metrics: AuthMetrics = {
    totalRequests: 0,
    successfulAccess: 0,
    deniedAccess: 0,
    publicAccess: 0,
    ownerAccess: 0,
    adminAccess: 0,
    failedAuth: 0,
    suspiciousActivity: 0,
  };

  private readonly recentEvents: AuthEvent[] = [];
  private readonly maxRecentEvents = 1000;
  private readonly suspiciousThreshold = 10; // Failed attempts per minute

  constructor(private eventEmitter: EventEmitter2) {}

  recordAuthEvent(event: AuthEvent) {
    this.metrics.totalRequests++;

    // Update metrics
    if (event.accessGranted) {
      this.metrics.successfulAccess++;
      
      if (!event.userId) {
        this.metrics.publicAccess++;
      } else if (event.userRole === 'ADMIN' || event.userRole === 'SUPER_ADMIN') {
        this.metrics.adminAccess++;
      } else if (event.reason?.includes('owner')) {
        this.metrics.ownerAccess++;
      }
    } else {
      this.metrics.deniedAccess++;
      
      if (event.reason?.includes('Invalid token') || event.reason?.includes('Authentication failed')) {
        this.metrics.failedAuth++;
      }
    }

    // Check for suspicious activity
    if (this.isSuspiciousActivity(event)) {
      this.metrics.suspiciousActivity++;
      this.handleSuspiciousActivity(event);
    }

    // Store recent events
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }

    // Emit event for other services
    this.eventEmitter.emit('listing.auth.event', event);

    // Log important events
    this.logAuthEvent(event);
  }

  private isSuspiciousActivity(event: AuthEvent): boolean {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    // Count failed attempts from same IP in last minute
    const recentFailures = this.recentEvents.filter(e => 
      e.timestamp > oneMinuteAgo &&
      e.ipAddress === event.ipAddress &&
      !e.accessGranted
    );

    // Check for rapid failed attempts
    if (recentFailures.length >= this.suspiciousThreshold) {
      return true;
    }

    // Check for token manipulation attempts
    if (event.reason?.includes('Invalid token') && 
        event.userAgent?.includes('curl') || 
        event.userAgent?.includes('python')) {
      return true;
    }

    // Check for enumeration attempts
    const recentEnumerations = this.recentEvents.filter(e =>
      e.timestamp > oneMinuteAgo &&
      e.ipAddress === event.ipAddress &&
      !e.accessGranted &&
      ['DRAFT', 'ARCHIVED', 'MAINTENANCE'].includes(e.listingStatus)
    );

    return recentEnumerations.length >= 5;
  }

  private handleSuspiciousActivity(event: AuthEvent) {
    this.logger.warn(`Suspicious activity detected from IP: ${event.ipAddress}`, {
      userId: event.userId,
      listingId: event.listingId,
      reason: event.reason,
      userAgent: event.userAgent,
    });

    // Emit security event
    this.eventEmitter.emit('security.suspicious_activity', {
      type: 'listing_auth_abuse',
      ipAddress: event.ipAddress,
      userId: event.userId,
      timestamp: event.timestamp,
      details: {
        listingId: event.listingId,
        reason: event.reason,
        userAgent: event.userAgent,
      },
    });
  }

  private logAuthEvent(event: AuthEvent) {
    const logLevel = this.getLogLevel(event);
    const message = `Listing Access: ${event.accessGranted ? 'GRANTED' : 'DENIED'} - ${event.reason}`;
    
    const context = {
      listingId: event.listingId,
      listingStatus: event.listingStatus,
      userId: event.userId,
      userRole: event.userRole,
      ipAddress: event.ipAddress,
    };

    switch (logLevel) {
      case 'error':
        this.logger.error(message, context);
        break;
      case 'warn':
        this.logger.warn(message, context);
        break;
      case 'info':
        this.logger.log(message, context);
        break;
      case 'debug':
        this.logger.debug(message, context);
        break;
    }
  }

  private getLogLevel(event: AuthEvent): 'error' | 'warn' | 'info' | 'debug' {
    if (!event.accessGranted && event.reason?.includes('Invalid token')) {
      return 'warn';
    }
    
    if (event.accessGranted && event.userRole === 'ADMIN') {
      return 'info';
    }
    
    if (!event.accessGranted && event.listingStatus !== 'AVAILABLE') {
      return 'debug';
    }
    
    return 'debug';
  }

  getMetrics(): AuthMetrics {
    return { ...this.metrics };
  }

  getRecentEvents(limit: number = 100): AuthEvent[] {
    return this.recentEvents.slice(-limit);
  }

  getEventsByListingId(listingId: string, limit: number = 50): AuthEvent[] {
    return this.recentEvents
      .filter(e => e.listingId === listingId)
      .slice(-limit);
  }

  getEventsByUserId(userId: string, limit: number = 50): AuthEvent[] {
    return this.recentEvents
      .filter(e => e.userId === userId)
      .slice(-limit);
  }

  getEventsByIpAddress(ipAddress: string, limit: number = 50): AuthEvent[] {
    return this.recentEvents
      .filter(e => e.ipAddress === ipAddress)
      .slice(-limit);
  }

  resetMetrics() {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key as keyof AuthMetrics] = 0;
    });
    this.recentEvents.length = 0;
  }

  // Health check method
  getHealthStatus() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 300000);
    
    const recentEvents = this.recentEvents.filter(e => e.timestamp > fiveMinutesAgo);
    const errorRate = recentEvents.length > 0 
      ? (recentEvents.filter(e => !e.accessGranted).length / recentEvents.length) * 100 
      : 0;

    return {
      status: errorRate > 50 ? 'unhealthy' : errorRate > 20 ? 'degraded' : 'healthy',
      metrics: this.metrics,
      recentEventsCount: recentEvents.length,
      errorRate: Math.round(errorRate * 100) / 100,
      lastEvent: this.recentEvents.length > 0 ? this.recentEvents[this.recentEvents.length - 1].timestamp : null,
    };
  }
}
