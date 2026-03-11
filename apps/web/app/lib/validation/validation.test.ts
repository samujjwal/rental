import { describe, it, expect } from "vitest";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "~/lib/validation/auth";
import { bookingSchema, reviewSchema } from "~/lib/validation/booking";
import { listingSchema, searchSchema } from "~/lib/validation/listing";

/* ================================================================== */
/*  Auth — loginSchema                                                 */
/* ================================================================== */
describe("loginSchema", () => {
  const valid = { email: "a@b.com", password: "LongPass1!" };

  it("accepts valid credentials", () => {
    expect(loginSchema.parse(valid)).toEqual(valid);
  });

  it("rejects empty email", () => {
    const r = loginSchema.safeParse({ ...valid, email: "" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const r = loginSchema.safeParse({ ...valid, email: "notanemail" });
    expect(r.success).toBe(false);
  });

  it("rejects password shorter than 8 chars", () => {
    const r = loginSchema.safeParse({ ...valid, password: "Ab1!" });
    expect(r.success).toBe(false);
  });
});

/* ================================================================== */
/*  Auth — signupSchema                                                */
/* ================================================================== */
describe("signupSchema", () => {
  const valid = {
    email: "a@b.com",
    password: "StrongP1!",
    confirmPassword: "StrongP1!",
    firstName: "Sam",
  };

  it("accepts valid signup data", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const r = signupSchema.safeParse({ ...valid, confirmPassword: "Other1!" });
    expect(r.success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const r = signupSchema.safeParse({
      ...valid,
      password: "nouppercase1!",
      confirmPassword: "nouppercase1!",
    });
    expect(r.success).toBe(false);
  });

  it("rejects password without special character", () => {
    const r = signupSchema.safeParse({
      ...valid,
      password: "NoSpecial1",
      confirmPassword: "NoSpecial1",
    });
    expect(r.success).toBe(false);
  });

  it("rejects firstName shorter than 2 chars", () => {
    const r = signupSchema.safeParse({ ...valid, firstName: "A" });
    expect(r.success).toBe(false);
  });

  it("allows optional phone in E.164 format", () => {
    const r = signupSchema.safeParse({ ...valid, phone: "+9779841234567" });
    expect(r.success).toBe(true);
  });

  it("rejects invalid phone format", () => {
    const r = signupSchema.safeParse({ ...valid, phone: "abc" });
    expect(r.success).toBe(false);
  });

  it("allows empty string phone", () => {
    const r = signupSchema.safeParse({ ...valid, phone: "" });
    expect(r.success).toBe(true);
  });
});

/* ================================================================== */
/*  Auth — forgotPasswordSchema / resetPasswordSchema                  */
/* ================================================================== */
describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    expect(forgotPasswordSchema.parse({ email: "a@b.com" })).toBeDefined();
  });

  it("rejects empty email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching strong passwords", () => {
    const r = resetPasswordSchema.safeParse({
      password: "NewPass1!",
      confirmPassword: "NewPass1!",
    });
    expect(r.success).toBe(true);
  });

  it("rejects mismatch", () => {
    const r = resetPasswordSchema.safeParse({
      password: "NewPass1!",
      confirmPassword: "Different1!",
    });
    expect(r.success).toBe(false);
  });
});

/* ================================================================== */
/*  Booking — bookingSchema                                            */
/* ================================================================== */
describe("bookingSchema", () => {
  // Use explicit future dates to avoid DST edge cases
  const startDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split("T")[0];
  })();
  const endDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split("T")[0];
  })();

  const valid = {
    listingId: "abc-123",
    startDate,
    endDate,
    deliveryMethod: "pickup" as const,
  };

  it("accepts valid booking data", () => {
    expect(bookingSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects start date in the past", () => {
    const r = bookingSchema.safeParse({
      ...valid,
      startDate: "2020-01-01",
    });
    expect(r.success).toBe(false);
  });

  it("rejects endDate before startDate", () => {
    const r = bookingSchema.safeParse({
      ...valid,
      endDate: valid.startDate,
      startDate: valid.endDate,
    });
    expect(r.success).toBe(false);
  });

  it("requires deliveryAddress when delivery method is delivery", () => {
    const r = bookingSchema.safeParse({
      ...valid,
      deliveryMethod: "delivery",
    });
    expect(r.success).toBe(false);
  });

  it("accepts delivery with address", () => {
    const r = bookingSchema.safeParse({
      ...valid,
      deliveryMethod: "delivery",
      deliveryAddress: "123 Main St",
    });
    expect(r.success).toBe(true);
  });

  it("limits specialRequests to 500 chars", () => {
    const r = bookingSchema.safeParse({
      ...valid,
      specialRequests: "x".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

/* ================================================================== */
/*  Booking — reviewSchema                                             */
/* ================================================================== */
describe("reviewSchema", () => {
  const validReview = {
    bookingId: "bk-1",
    reviewType: "RENTER_TO_OWNER" as const,
    overallRating: 4,
  };

  it("accepts valid review", () => {
    expect(reviewSchema.safeParse(validReview).success).toBe(true);
  });

  it("rejects rating below 1", () => {
    const r = reviewSchema.safeParse({ ...validReview, overallRating: 0 });
    expect(r.success).toBe(false);
  });

  it("rejects rating above 5", () => {
    const r = reviewSchema.safeParse({ ...validReview, overallRating: 6 });
    expect(r.success).toBe(false);
  });

  it("rejects comment shorter than 10 chars", () => {
    const r = reviewSchema.safeParse({ ...validReview, comment: "short" });
    expect(r.success).toBe(false);
  });
});

/* ================================================================== */
/*  Listing — listingSchema                                            */
/* ================================================================== */
describe("listingSchema", () => {
  const validListing = {
    title: "Nice Camera for Rent",
    description: "A".repeat(50),
    category: "electronics",
    basePrice: 25,
    condition: "good" as const,
    location: {
      address: "123 Main",
      city: "Kathmandu",
      state: "Bagmati",
      country: "Nepal",
      postalCode: "44600",
      coordinates: { lat: 27.7, lng: 85.3 },
    },
    photos: ["https://img.example.com/1.jpg"],
    deliveryOptions: { pickup: true, delivery: false, shipping: false },
    securityDeposit: 100,
    minimumRentalPeriod: 1,
    cancellationPolicy: "flexible" as const,
  };

  it("accepts valid listing data", () => {
    expect(listingSchema.safeParse(validListing).success).toBe(true);
  });

  it("rejects title shorter than 10 chars", () => {
    const r = listingSchema.safeParse({ ...validListing, title: "Short" });
    expect(r.success).toBe(false);
  });

  it("rejects description shorter than 50 chars", () => {
    const r = listingSchema.safeParse({
      ...validListing,
      description: "Too short",
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative basePrice", () => {
    const r = listingSchema.safeParse({ ...validListing, basePrice: -1 });
    expect(r.success).toBe(false);
  });

  it("rejects empty photos array", () => {
    const r = listingSchema.safeParse({ ...validListing, photos: [] });
    expect(r.success).toBe(false);
  });

  it("rejects more than 10 photos", () => {
    const photos = Array.from({ length: 11 }, (_, i) => `https://img.example.com/${i}.jpg`);
    const r = listingSchema.safeParse({ ...validListing, photos });
    expect(r.success).toBe(false);
  });

  it("rejects latitude out of range", () => {
    const r = listingSchema.safeParse({
      ...validListing,
      location: { ...validListing.location, coordinates: { lat: 100, lng: 85 } },
    });
    expect(r.success).toBe(false);
  });

  it("transforms pricePerWeek=0 to undefined", () => {
    const r = listingSchema.parse({ ...validListing, pricePerWeek: 0 });
    expect(r.pricePerWeek).toBeUndefined();
  });
});

/* ================================================================== */
/*  Listing — searchSchema                                             */
/* ================================================================== */
describe("searchSchema", () => {
  it("accepts empty search (all defaults)", () => {
    const r = searchSchema.parse({});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });

  it("accepts valid search filters", () => {
    const r = searchSchema.safeParse({
      query: "camera",
      category: "electronics",
      minPrice: 0,
      maxPrice: 100,
      sortBy: "price-asc",
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid sortBy", () => {
    const r = searchSchema.safeParse({ sortBy: "invalid" });
    expect(r.success).toBe(false);
  });

  it("rejects limit above 100", () => {
    const r = searchSchema.safeParse({ limit: 200 });
    expect(r.success).toBe(false);
  });
});
