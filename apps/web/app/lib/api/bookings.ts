import { api } from "~/lib/api-client";
import type {
  Booking,
  CreateBookingRequest,
  BookingCalculation,
  BookingAvailability,
  CreateReviewRequest,
} from "~/types/booking";

export const bookingApi = {
  async getMyBookings(status?: string): Promise<Booking[]> {
    const params = status ? `?status=${status}` : "";
    return api.get<Booking[]>(`/bookings/my-bookings${params}`);
  },

  async getOwnerBookings(status?: string): Promise<Booking[]> {
    const params = status ? `?status=${status}` : "";
    return api.get<Booking[]>(`/bookings/owner-bookings${params}`);
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

  async confirmBooking(id: string): Promise<Booking> {
    return api.post<Booking>(`/bookings/${id}/confirm`);
  },

  async completeBooking(id: string): Promise<Booking> {
    return api.post<Booking>(`/bookings/${id}/complete`);
  },

  async calculatePrice(
    listingId: string,
    startDate: string,
    endDate: string,
    deliveryMethod: "pickup" | "delivery" | "shipping"
  ): Promise<BookingCalculation> {
    return api.post<BookingCalculation>("/bookings/calculate", {
      listingId,
      startDate,
      endDate,
      deliveryMethod,
    });
  },

  async checkAvailability(
    listingId: string,
    startDate: string,
    endDate: string
  ): Promise<BookingAvailability> {
    return api.get<BookingAvailability>(
      `/bookings/availability?listingId=${listingId}&startDate=${startDate}&endDate=${endDate}`
    );
  },

  async getBlockedDates(listingId: string): Promise<string[]> {
    return api.get<string[]>(`/bookings/blocked-dates/${listingId}`);
  },

  async submitReview(
    bookingId: string,
    data: { rating: number; comment: string }
  ): Promise<{ message: string; review: any }> {
    return api.post(`/bookings/${bookingId}/review`, data);
  },
};
