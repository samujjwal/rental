/**
 * Users Client
 * 
 * Handles all user-related API endpoints:
 * - User profile
 * - User stats
 * - Favorites
 * - Data export
 * - Owner upgrade
 */

import type { UserProfile, AuthUser, UserStats, ListingDetail } from '~/types';
import { BaseClient } from './base-client';

export class UsersClient extends BaseClient {
  /**
   * Get current user's profile
   */
  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/users/me');
  }

  /**
   * Update current user's profile
   */
  async updateProfile(payload: Partial<Omit<UserProfile, 'id' | 'email'>>): Promise<UserProfile> {
    return this.request<UserProfile>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Upgrade to owner account
   */
  async upgradeToOwner(): Promise<AuthUser> {
    return this.request<AuthUser>('/users/upgrade-to-owner', {
      method: 'POST',
    });
  }

  /**
   * Get user stats
   */
  async getUserStats(): Promise<UserStats> {
    return this.request<UserStats>('/users/me/stats');
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserProfile> {
    return this.request<UserProfile>(`/users/${userId}`);
  }

  /**
   * Get user's listings
   */
  async getUserListings(userId: string): Promise<{ listings: ListingDetail[] }> {
    return this.request<any>(`/listings?ownerId=${encodeURIComponent(userId)}`);
  }

  /**
   * Get user's favorites
   */
  async getFavorites(): Promise<ListingDetail[]> {
    return this.request<any>('/favorites').then(
      (response) => (response.favorites || []).map((favorite: any) => favorite.listing),
    );
  }

  /**
   * Add listing to favorites
   */
  async addFavorite(listingId: string): Promise<void> {
    return this.request<void>('/favorites', {
      method: 'POST',
      body: JSON.stringify({ listingId }),
    });
  }

  /**
   * Remove listing from favorites
   */
  async removeFavorite(listingId: string): Promise<void> {
    return this.request<void>(`/favorites/${listingId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Export user data
   */
  async exportData(): Promise<any> {
    return this.request<any>('/users/me/export');
  }
}
