import { api } from "~/lib/api-client";
import type {
  Booking,
  CreateBookingRequest,
  BookingCalculation,
  BookingAvailability,
} from "~/types/booking";

export const bookingsApi = {
  async getMyBookings(status?: string): Promise<Booking[]> {
    const params = status ? `?status=${status}` : "";
    return api.get<Booking[]>(`/bookings/my-bookings${params}`);
  },

  async getBookingsByRenterId(renterId: string): Promise<Booking[]> {
    // Backend uses authenticated user for renter bookings
    return api.get<Booking[]>(`/bookings/my-bookings`);
  },

  async getBookingsByOwnerId(ownerId: string): Promise<Booking[]> {
    // Backend uses authenticated user for owner bookings
    return api.get<Booking[]>(`/bookings/host-bookings`);
  },

  async getOwnerBookings(status?: string): Promise<Booking[]> {
    const params = status ? `?status=${status}` : "";
    return api.get<Booking[]>(`/bookings/host-bookings${params}`);
  },

  async getBookingById(id: string): Promise<Booking> {
    return api.get<Booking>(`/bookings/${id}`);
  },

  async createBooking(data: CreateBookingRequest): Promise<Booking> {
    return api.post<Booking>("/bookings", data);
  },

  async cancelBooking(
    id: string,
    reason: string
  ): Promise<{ booking: Booking; refund: number }> {
    return api.post<{ booking: Booking; refund: number }>(
      `/bookings/${id}/cancel`,
      { reason }
    );
  },

  async approveBooking(id: string): Promise<Booking> {
    return api.post<Booking>(`/bookings/${id}/approve`);
  },

  async rejectBooking(id: string, reason?: string): Promise<Booking> {
    return api.post<Booking>(`/bookings/${id}/reject`, { reason });
  },

  async startBooking(id: string): Promise<Booking> {
    return api.post<Booking>(`/bookings/${id}/start`);
  },

  async requestReturn(id: string): Promise<Booking> {
    return api.post<Booking>(`/bookings/${id}/request-return`);
  },

  async approveReturn(id: string): Promise<Booking> {
    return api.post<Booking>(`/bookings/${id}/approve-return`);
  },

  async rejectReturn(id: string, reason: string): Promise<Booking> {
    return api.post<Booking>(`/bookings/${id}/reject-return`, { reason });
  },

  async calculatePrice(
    listingId: string,
    startDate: string,
    endDate: string,
    deliveryMethod: "pickup" | "delivery" | "shipping",
    options?: { guestCount?: number; promoCode?: string }
  ): Promise<BookingCalculation> {
    return api.post<BookingCalculation>("/bookings/calculate-price", {
      listingId,
      startDate,
      endDate,
      deliveryMethod,
      ...(options?.guestCount != null && { guestCount: options.guestCount }),
      ...(options?.promoCode && { promoCode: options.promoCode }),
    });
  },

  async checkAvailability(
    listingId: string,
    startDate: string,
    endDate: string
  ): Promise<BookingAvailability> {
    return api.post<BookingAvailability>(
      `/listings/${listingId}/check-availability`,
      { startDate, endDate }
    );
  },

  async getBlockedDates(listingId: string): Promise<string[]> {
    return api.get<string[]>(`/bookings/blocked-dates/${listingId}`);
  },

};
