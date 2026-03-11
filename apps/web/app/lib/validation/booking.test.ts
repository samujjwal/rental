import { describe, it, expect } from "vitest";
import {
  bookingSchema,
  reviewSchema,
} from "./booking";

describe("bookingSchema", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);
  const laterDate = new Date();
  laterDate.setDate(laterDate.getDate() + 3);

  const validBooking = {
    listingId: "listing-1",
    startDate: futureDate.toISOString().split("T")[0],
    endDate: laterDate.toISOString().split("T")[0],
    deliveryMethod: "pickup" as const,
  };

  it("validates correct booking", () => {
    const result = bookingSchema.safeParse(validBooking);
    expect(result.success).toBe(true);
  });

  it("rejects empty listingId", () => {
    const result = bookingSchema.safeParse({ ...validBooking, listingId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects start date in the past", () => {
    const pastDate = new Date("2020-01-01").toISOString().split("T")[0];
    const result = bookingSchema.safeParse({
      ...validBooking,
      startDate: pastDate,
    });
    expect(result.success).toBe(false);
  });

  it("rejects end date before start date", () => {
    const result = bookingSchema.safeParse({
      ...validBooking,
      endDate: validBooking.startDate,
    });
    expect(result.success).toBe(false);
  });

  it("requires delivery address for delivery method", () => {
    const result = bookingSchema.safeParse({
      ...validBooking,
      deliveryMethod: "delivery",
    });
    expect(result.success).toBe(false);
  });

  it("accepts delivery with address", () => {
    const result = bookingSchema.safeParse({
      ...validBooking,
      deliveryMethod: "delivery",
      deliveryAddress: "123 Main St, Kathmandu",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional fields", () => {
    const result = bookingSchema.safeParse({
      ...validBooking,
      guestCount: 2,
      specialRequests: "Early check-in please",
      promoCode: "NEPAL2024",
    });
    expect(result.success).toBe(true);
  });

  it("rejects guestCount over 100", () => {
    const result = bookingSchema.safeParse({
      ...validBooking,
      guestCount: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects specialRequests over 500 chars", () => {
    const result = bookingSchema.safeParse({
      ...validBooking,
      specialRequests: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts shipping delivery method", () => {
    const result = bookingSchema.safeParse({
      ...validBooking,
      deliveryMethod: "shipping",
    });
    expect(result.success).toBe(true);
  });
});

describe("reviewSchema", () => {
  const validReview = {
    bookingId: "booking-1",
    reviewType: "RENTER_TO_OWNER" as const,
    overallRating: 4,
    comment: "Great experience renting this item!",
  };

  it("validates correct review", () => {
    const result = reviewSchema.safeParse(validReview);
    expect(result.success).toBe(true);
  });

  it("rejects empty bookingId", () => {
    const result = reviewSchema.safeParse({ ...validReview, bookingId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects rating below 1", () => {
    const result = reviewSchema.safeParse({
      ...validReview,
      overallRating: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects rating above 5", () => {
    const result = reviewSchema.safeParse({
      ...validReview,
      overallRating: 6,
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional sub-ratings", () => {
    const result = reviewSchema.safeParse({
      ...validReview,
      accuracyRating: 5,
      communicationRating: 4,
      cleanlinessRating: 3,
      valueRating: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects comment shorter than 10 characters", () => {
    const result = reviewSchema.safeParse({
      ...validReview,
      comment: "bad",
    });
    expect(result.success).toBe(false);
  });

  it("rejects comment longer than 2000 characters", () => {
    const result = reviewSchema.safeParse({
      ...validReview,
      comment: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts OWNER_TO_RENTER review type", () => {
    const result = reviewSchema.safeParse({
      ...validReview,
      reviewType: "OWNER_TO_RENTER",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid review type", () => {
    const result = reviewSchema.safeParse({
      ...validReview,
      reviewType: "INVALID",
    });
    expect(result.success).toBe(false);
  });
});
