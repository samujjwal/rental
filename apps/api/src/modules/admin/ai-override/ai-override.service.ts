/**
 * AI Override Service
 * 
 * Provides AI-powered suggestions and admin override functionality:
 * - Generate AI suggestions for various decisions
 * - Review and override AI suggestions
 * - Audit trail for overrides
 * - Reasoning capture for overrides
 * 
 * Note: Uses in-memory storage for demonstration. For production, 
 * integrate with a proper database model (AISuggestion).
 */

import { Injectable, Logger } from '@nestjs/common';

export interface AISuggestion {
  id: string;
  type: 'FRAUD_DETECTION' | 'DISPUTE_RESOLUTION' | 'PRICING_RECOMMENDATION' | 'RISK_ASSESSMENT';
  entityId: string;
  entityType: 'BOOKING' | 'USER' | 'LISTING' | 'DISPUTE';
  suggestion: string;
  confidence: number; // 0-1
  reasoning: string;
  data: any;
  status: 'PENDING' | 'APPROVED' | 'OVERRIDDEN' | 'REJECTED';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  overrideReason?: string;
}

export interface CreateSuggestionDto {
  type: AISuggestion['type'];
  entityId: string;
  entityType: AISuggestion['entityType'];
  suggestion: string;
  confidence: number;
  reasoning: string;
  data: any;
}

export interface OverrideSuggestionDto {
  overrideReason: string;
  action: 'APPROVE' | 'OVERRIDE' | 'REJECT';
  customAction?: string;
}

@Injectable()
export class AIOverrideService {
  private readonly logger = new Logger(AIOverrideService.name);
  private suggestions: Map<string, AISuggestion> = new Map();
  private idCounter = 1;

  /**
   * Create an AI suggestion
   */
  async createSuggestion(dto: CreateSuggestionDto, adminId: string): Promise<AISuggestion> {
    const id = `ai_sugg_${this.idCounter++}`;
    const suggestion: AISuggestion = {
      id,
      type: dto.type,
      entityId: dto.entityId,
      entityType: dto.entityType,
      suggestion: dto.suggestion,
      confidence: dto.confidence,
      reasoning: dto.reasoning,
      data: dto.data,
      status: 'PENDING',
      createdAt: new Date(),
    };

    this.suggestions.set(id, suggestion);
    this.logger.log(`AI suggestion created: ${id} for ${dto.entityType}:${dto.entityId}`);
    return suggestion;
  }

  /**
   * Get all pending suggestions
   */
  async getPendingSuggestions(type?: AISuggestion['type']): Promise<AISuggestion[]> {
    const all = Array.from(this.suggestions.values());
    const pending = all.filter((s) => s.status === 'PENDING');
    
    if (type) {
      return pending.filter((s) => s.type === type);
    }
    
    return pending.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 100);
  }

  /**
   * Get suggestions for a specific entity
   */
  async getEntitySuggestions(
    entityId: string,
    entityType: string,
  ): Promise<AISuggestion[]> {
    const validTypes: AISuggestion['entityType'][] = ['BOOKING', 'USER', 'LISTING', 'DISPUTE'];
    if (!validTypes.includes(entityType as AISuggestion['entityType'])) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }
    
    const all = Array.from(this.suggestions.values());
    return all
      .filter((s) => s.entityId === entityId && s.entityType === entityType as AISuggestion['entityType'])
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get a specific suggestion by ID
   */
  async getSuggestion(id: string): Promise<AISuggestion | null> {
    return this.suggestions.get(id) || null;
  }

  /**
   * Review and override/approve/reject a suggestion
   */
  async reviewSuggestion(
    id: string,
    dto: OverrideSuggestionDto,
    adminId: string,
  ): Promise<AISuggestion> {
    const suggestion = this.suggestions.get(id);

    if (!suggestion) {
      throw new Error(`Suggestion not found: ${id}`);
    }

    const status = dto.action === 'APPROVE' ? 'APPROVED' : dto.action === 'OVERRIDE' ? 'OVERRIDDEN' : 'REJECTED';

    const updated: AISuggestion = {
      ...suggestion,
      status,
      reviewedAt: new Date(),
      reviewedBy: adminId,
      overrideReason: dto.overrideReason,
    };

    this.suggestions.set(id, updated);
    this.logger.log(`AI suggestion ${id} ${status.toLowerCase()} by admin ${adminId}`);
    return updated;
  }

  /**
   * Get audit trail for overrides
   */
  async getOverrideHistory(
    entityType?: AISuggestion['entityType'],
    entityId?: string,
    limit: number = 50,
  ): Promise<AISuggestion[]> {
    const all = Array.from(this.suggestions.values());
    let filtered = all.filter((s) => s.status === 'OVERRIDDEN' || s.status === 'REJECTED');

    if (entityType) {
      filtered = filtered.filter((s) => s.entityType === entityType);
    }
    if (entityId) {
      filtered = filtered.filter((s) => s.entityId === entityId);
    }

    return filtered
      .sort((a, b) => (b.reviewedAt?.getTime() || 0) - (a.reviewedAt?.getTime() || 0))
      .slice(0, limit);
  }

  /**
   * Get statistics for AI suggestions
   */
  async getSuggestionStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    overridden: number;
    rejected: number;
    byType: Record<string, number>;
  }> {
    const all = Array.from(this.suggestions.values());
    const byType: Record<string, number> = {};

    for (const s of all) {
      byType[s.type] = (byType[s.type] || 0) + 1;
    }

    return {
      total: all.length,
      pending: all.filter((s) => s.status === 'PENDING').length,
      approved: all.filter((s) => s.status === 'APPROVED').length,
      overridden: all.filter((s) => s.status === 'OVERRIDDEN').length,
      rejected: all.filter((s) => s.status === 'REJECTED').length,
      byType,
    };
  }

  /**
   * Generate fraud detection suggestion (mock implementation)
   */
  async generateFraudDetection(bookingId: string, bookingData: any): Promise<AISuggestion> {
    // Mock AI analysis - in production, integrate with actual AI service
    const riskFactors = [];
    let confidence = 0.3;

    if (bookingData.renterAccountAge < 30) {
      riskFactors.push('New account (< 30 days)');
      confidence += 0.2;
    }
    if (!bookingData.emailVerified) {
      riskFactors.push('Unverified email');
      confidence += 0.15;
    }
    if (bookingData.totalPrice > 5000) {
      riskFactors.push('High-value booking');
      confidence += 0.1;
    }

    const suggestion = await this.createSuggestion(
      {
        type: 'FRAUD_DETECTION',
        entityId: bookingId,
        entityType: 'BOOKING',
        suggestion: riskFactors.length > 2 ? 'Flag for manual review' : 'Proceed with standard verification',
        confidence: Math.min(confidence, 0.95),
        reasoning: `Risk factors: ${riskFactors.join(', ') || 'None identified'}`,
        data: { riskFactors, bookingDetails: bookingData },
      },
      'SYSTEM',
    );

    return suggestion;
  }

  /**
   * Generate dispute resolution suggestion (mock implementation)
   */
  async generateDisputeResolution(disputeId: string, disputeData: any): Promise<AISuggestion> {
    // Mock AI analysis - in production, integrate with actual AI service
    const suggestion = await this.createSuggestion(
      {
        type: 'DISPUTE_RESOLUTION',
        entityId: disputeId,
        entityType: 'DISPUTE',
        suggestion: 'Recommend refund to renter based on evidence',
        confidence: 0.75,
        reasoning: 'Based on dispute history and booking details, evidence favors renter',
        data: { disputeDetails: disputeData },
      },
      'SYSTEM',
    );

    return suggestion;
  }

  /**
   * Generate pricing recommendation (mock implementation)
   */
  async generatePricingRecommendation(listingId: string, listingData: any): Promise<AISuggestion> {
    // Mock AI analysis - in production, integrate with actual AI service
    const currentPrice = Number(listingData.basePrice);
    const suggestedPrice = Math.round(currentPrice * 1.1); // 10% increase

    const suggestion = await this.createSuggestion(
      {
        type: 'PRICING_RECOMMENDATION',
        entityId: listingId,
        entityType: 'LISTING',
        suggestion: `Increase price to ${suggestedPrice}`,
        confidence: 0.8,
        reasoning: 'Market analysis suggests 10% price increase would optimize revenue',
        data: {
          currentPrice,
          suggestedPrice,
          marketData: {},
        },
      },
      'SYSTEM',
    );

    return suggestion;
  }
}

