/**
 * Disputes Client
 * 
 * Handles all dispute-related API endpoints:
 * - Create disputes
 * - Get disputes
 * - Respond to disputes
 * - Close disputes
 */

import type { Dispute, DisputeDetail, CreateDisputePayload } from '~/types';
import type { DisputeResponse as DisputeResponseType } from '@rental-portal/shared-types';
import { BaseClient } from './base-client';

export class DisputesClient extends BaseClient {
  /**
   * Create a new dispute
   */
  async createDispute(payload: CreateDisputePayload): Promise<Dispute> {
    return this.request<Dispute>('/disputes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get current user's disputes
   */
  async getMyDisputes(status?: string): Promise<{
    disputes: Dispute[];
    total: number;
  }> {
    return this.request<any>(
      `/disputes${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    );
  }

  /**
   * Get dispute by ID
   */
  async getDisputeById(disputeId: string): Promise<DisputeDetail> {
    return this.request<DisputeDetail>(`/disputes/${disputeId}`);
  }

  /**
   * Respond to a dispute
   */
  async respondToDispute(disputeId: string, message: string): Promise<DisputeResponseType> {
    return this.request<DisputeResponseType>(`/disputes/${disputeId}/responses`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  /**
   * Close a dispute
   */
  async closeDispute(disputeId: string, reason: string): Promise<DisputeDetail> {
    return this.request<DisputeDetail>(`/disputes/${disputeId}/close`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }
}
