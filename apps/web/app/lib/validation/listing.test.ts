import { describe, it, expect } from "vitest";
import {
  listingSchema,
  searchSchema,
} from "~/lib/validation/listing";

const validListing = {
  title: "Spacious 2BR Apartment in Thamel",
  description:
    "A beautiful apartment located in the heart of Thamel. Features modern amenities and great views. Perfect for short or long-term stays.",
  category: "apartment",
  basePrice: 500,
  condition: "good" as const,
  location: {
    address: "123 Thamel Marg",
    city: "Kathmandu",
    state: "Bagmati",
    country: "Nepal",
    postalCode: "44600",
    coordinates: { lat: 27.7172, lng: 85.324 },
  },
  photos: ["https://img.gharbatai.np/a.jpg"],
  deliveryOptions: { pickup: true, delivery: false, shipping: false },
  securityDeposit: 1000,
  minimumRentalPeriod: 1,
  cancellationPolicy: "flexible" as const,
};

describe("listingSchema", () => {
  it("accepts valid listing", () => {
    const result = listingSchema.safeParse(validListing);
    expect(result.success).toBe(true);
  });

  it("rejects short title", () => {
    const result = listingSchema.safeParse({ ...validListing, title: "Short" });
    expect(result.success).toBe(false);
  });

  it("rejects title over 200 chars", () => {
    const result = listingSchema.safeParse({ ...validListing, title: "A".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects short description", () => {
    const result = listingSchema.safeParse({ ...validListing, description: "Too short" });
    expect(result.success).toBe(false);
  });

  it("rejects negative basePrice", () => {
    const result = listingSchema.safeParse({ ...validListing, basePrice: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects basePrice above 10000", () => {
    const result = listingSchema.safeParse({ ...validListing, basePrice: 10001 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid condition", () => {
    const result = listingSchema.safeParse({ ...validListing, condition: "broken" });
    expect(result.success).toBe(false);
  });

  it("rejects empty photos array", () => {
    const result = listingSchema.safeParse({ ...validListing, photos: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 photos", () => {
    const photos = Array.from({ length: 11 }, (_, i) => `https://img.np/${i}.jpg`);
    const result = listingSchema.safeParse({ ...validListing, photos });
    expect(result.success).toBe(false);
  });

  it("rejects invalid lat/lng", () => {
    const result = listingSchema.safeParse({
      ...validListing,
      location: { ...validListing.location, coordinates: { lat: 200, lng: 85 } },
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional pricePerWeek and transforms 0 to undefined", () => {
    const result = listingSchema.safeParse({ ...validListing, pricePerWeek: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pricePerWeek).toBeUndefined();
    }
  });

  it("accepts valid pricePerWeek", () => {
    const result = listingSchema.safeParse({ ...validListing, pricePerWeek: 3000 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pricePerWeek).toBe(3000);
    }
  });

  it("rejects invalid cancellation policy", () => {
    const result = listingSchema.safeParse({ ...validListing, cancellationPolicy: "none" });
    expect(result.success).toBe(false);
  });

  it("defaults features to empty array", () => {
    const result = listingSchema.safeParse(validListing);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.features).toEqual([]);
    }
  });

  it("defaults categorySpecificData to empty object", () => {
    const result = listingSchema.safeParse(validListing);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categorySpecificData).toEqual({});
    }
  });
});

describe("searchSchema", () => {
  it("accepts empty search (all defaults)", () => {
    const result = searchSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it("accepts full search params", () => {
    const result = searchSchema.safeParse({
      query: "apartment",
      category: "house",
      minPrice: 100,
      maxPrice: 5000,
      location: "Kathmandu",
      lat: 27.7,
      lng: 85.3,
      radius: 10,
      condition: "good",
      instantBooking: true,
      sortBy: "price-asc",
      page: 2,
      limit: 50,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid sortBy", () => {
    const result = searchSchema.safeParse({ sortBy: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects limit over 100", () => {
    const result = searchSchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects lat out of range", () => {
    const result = searchSchema.safeParse({ lat: 91 });
    expect(result.success).toBe(false);
  });

  it("rejects negative minPrice", () => {
    const result = searchSchema.safeParse({ minPrice: -1 });
    expect(result.success).toBe(false);
  });
});
