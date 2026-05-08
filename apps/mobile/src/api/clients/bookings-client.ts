/**
 * Bookings Client
 * 
 * Handles all booking-related API endpoints:
 * - Create, approve, cancel bookings
 * - Get booking details and lists
 * - Booking state transitions
 * - Price calculation
 * - Return requests
 */

import type { BookingSummary, BookingDetail, BookingResponse } from '~/types';
import type { BookingAvailability } from '@rental-portal/shared-types';
import { BaseClient } from './base-client';

export class BookingsClient extends BaseClient {
  /**
   * Get current user's bookings as renter
   */
  async getMyBookings(status?: string, page?: number, limit?: number): Promise<{
    data: BookingSummary[];
    total: number;
    page: number;
    limit: number;
  }> {
    const query = this.buildQueryString({
      status: status?.toUpperCase(),
      page,
      limit,
    });
    return this.request<any>(`/bookings/my-bookings${query ? `?${query}` : ''}`);
  }

  /**
   * Get bookings as host
   */
  async getHostBookings(status?: string, page?: number, limit?: number): Promise<{
    data: BookingSummary[];
    total: number;
    page: number;
    limit: number;
  }> {
    const query = this.buildQueryString({
      status: status?.toUpperCase(),
      page,
      limit,
    });
    return this.request<any>(`/bookings/host-bookings${query ? `?${query}` : ''}`);
  }

  /**
   * Get booking details by ID
   */
  async getBooking(bookingId: string): Promise<BookingDetail> {
    return this.request<BookingDetail>(`/bookings/${bookingId}`);
  }

  /**
   * Calculate price for a booking
   */
  async calculatePrice(listingId: string, startDate: string, endDate: string): Promise<{
    totalDays: number;
    pricePerDay: number;
    subtotal: number;
    serviceFee: number;
    platformFee: number;
    totalAmount: number;
  }> {
    return this.request<any>('/bookings/calculate-price', {
      method: 'POST',
      body: JSON.stringify({ listingId, startDate, endDate }),
    });
  }

  /**
   * Create a new booking
   */
  async createBooking(payload: any): Promise<BookingResponse> {
    return this.request<BookingResponse>('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Approve a booking (host action)
   */
  async approveBooking(bookingId: string): Promise<BookingDetail> {
    return this.request<BookingDetail>(`/bookings/${bookingId}/approve`, {
      method: 'POST',
    });
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string, reason?: string): Promise<BookingDetail> {
    return this.request<BookingDetail>(`/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Reject a booking (host action)
   */
  async rejectBooking(bookingId: string, reason?: string): Promise<BookingDetail> {
    return this.request<BookingDetail>(`/bookings/${bookingId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Start a booking (check-in)
   */
  async startBooking(bookingId: string): Promise<BookingDetail> {
    return this.request<BookingDetail>(`/bookings/${bookingId}/start`, {
      method: 'POST',
    });
  }

  /**
   * Request return (renter action)
   */
  async requestReturn(bookingId: string): Promise<BookingDetail> {
    return this.request<BookingDetail>(`/bookings/${bookingId}/request-return`, {
      method: 'POST',
    });
  }

  /**
   * Approve return (host action)
   */
  async approveReturn(bookingId: string): Promise<BookingDetail> {
    return this.request<BookingDetail>(`/bookings/${bookingId}/approve-return`, {
      method: 'POST',
    });
  }

  /**
   * Reject return (host action)
   */
  async rejectReturn(bookingId: string, reason: string): Promise<BookingDetail> {
    return this.request<BookingDetail>(`/bookings/${bookingId}/reject-return`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Get booking invoice
   */
  async getBookingInvoice(bookingId: string): Promise<any> {
    return this.request<any>(`/bookings/${bookingId}/invoice?format=json`);
  }
}
