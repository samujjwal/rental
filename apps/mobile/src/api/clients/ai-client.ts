/**
 * AI Client
 * 
 * Handles all AI-related API endpoints:
 * - Generate listing descriptions
 * - Price suggestions
 */

import { BaseClient } from './base-client';

export class AIClient extends BaseClient {
  /**
   * Generate listing description using AI
   */
  async generateDescription(data: {
    title: string;
    category?: string;
    city?: string;
    features?: string[];
    condition?: string;
    basePrice?: number;
  }): Promise<{
    description: string;
    model: string;
    tokens?: number;
  }> {
    return this.request<any>('/ai/generate-description', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
