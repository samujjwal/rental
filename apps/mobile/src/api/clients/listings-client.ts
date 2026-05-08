/**
 * Listings Client
 * 
 * Handles all listing-related API endpoints:
 * - Search and browse listings
 * - Create, update, delete listings
 * - Listing details and availability
 * - Image uploads
 * - Price suggestions
 * - Categories
 */

import type { ListingDetail, Category, SearchParams, SearchResponse } from '~/types';
import { BaseClient } from './base-client';

export class ListingsClient extends BaseClient {
  /**
   * Search listings with filters
   */
  async search(params: SearchParams): Promise<SearchResponse> {
    const query = this.buildQueryString(params);
    return this.request<SearchResponse>(`/search?${query}`);
  }

  /**
   * Get all categories
   */
  async categories(): Promise<Category[]> {
    return this.request<Category[]>('/categories');
  }

  /**
   * Get listing details by ID
   */
  async getListing(listingId: string): Promise<ListingDetail> {
    return this.request<ListingDetail>(`/listings/${listingId}`);
  }

  /**
   * Get current user's listings
   */
  async getMyListings(): Promise<ListingDetail[]> {
    return this.request<ListingDetail[]>('/listings/my-listings');
  }

  /**
   * Create a new listing
   */
  async createListing(payload: any): Promise<ListingDetail> {
    return this.request<ListingDetail>('/listings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Upload images for a listing
   */
  async uploadImages(images: Array<{ uri: string; fileName?: string; mimeType?: string }>): Promise<string[]> {
    const formData = new FormData();
    images.forEach((img, i) => {
      formData.append('files', {
        uri: img.uri,
        name: img.fileName || `image_${i}.jpg`,
        type: img.mimeType || 'image/jpeg',
      } as any);
    });

    const token = this.getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}/upload/images`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Image upload failed');
    }

    const results: { url: string }[] = await response.json();
    return results.map((r) => r.url);
  }

  /**
   * Update an existing listing
   */
  async updateListing(listingId: string, payload: any): Promise<ListingDetail> {
    return this.request<ListingDetail>(`/listings/${listingId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Publish a listing
   */
  async publishListing(listingId: string): Promise<void> {
    return this.request<void>(`/listings/${listingId}/publish`, {
      method: 'POST',
    });
  }

  /**
   * Pause a listing
   */
  async pauseListing(listingId: string): Promise<void> {
    return this.request<void>(`/listings/${listingId}/pause`, {
      method: 'POST',
    });
  }

  /**
   * Activate a paused listing
   */
  async activateListing(listingId: string): Promise<void> {
    return this.request<void>(`/listings/${listingId}/activate`, {
      method: 'POST',
    });
  }

  /**
   * Delete a listing
   */
  async deleteListing(listingId: string): Promise<void> {
    return this.request<void>(`/listings/${listingId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Check availability for a listing
   */
  async checkAvailability(listingId: string, startDate: string, endDate: string): Promise<any> {
    return this.request<any>(`/listings/${listingId}/check-availability`, {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate }),
    });
  }

  /**
   * Get price suggestion for a listing
   */
  async getPriceSuggestion(params?: {
    categoryId?: string;
    city?: string;
    condition?: string;
  }): Promise<{
    averagePrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    suggestedRange: { min: number; max: number };
    sampleSize: number;
  }> {
    const query = this.buildQueryString(params || {});
    return this.request<any>(`/listings/price-suggestion${query ? `?${query}` : ''}`);
  }
}
