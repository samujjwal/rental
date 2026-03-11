import { describe, it, expect } from "vitest";
import { listingSchema, searchSchema } from "./listing";
import { loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema } from "./auth";

/* ════════════════════════ listingSchema ════════════════════════ */

const validListing = {
  title: "Camera for Rent in Kathmandu",
  description: "A ".padEnd(55, "x"), // 55 chars → ≥50
  category: "electronics",
  basePrice: 500,
  condition: "good" as const,
  location: {
    address: "Thamel, KTM",
    city: "Kathmandu",
    state: "Bagmati",
    country: "NP",
    postalCode: "44600",
    coordinates: { lat: 27.71, lng: 85.31 },
  },
  photos: ["https://img.example.com/1.jpg"],
  deliveryOptions: { pickup: true, delivery: false, shipping: false },
  securityDeposit: 1000,
  minimumRentalPeriod: 1,
  cancellationPolicy: "flexible" as const,
};

describe("listingSchema", () => {
  it("accepts valid input", () => {
    const result = listingSchema.safeParse(validListing);
    expect(result.success).toBe(true);
  });

  it("rejects title shorter than 10 characters", () => {
    const result = listingSchema.safeParse({ ...validListing, title: "Short" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain("10 characters");
  });

  it("rejects title longer than 200 characters", () => {
    const result = listingSchema.safeParse({ ...validListing, title: "A".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects description shorter than 50 characters", () => {
    const result = listingSchema.safeParse({ ...validListing, description: "Too short" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain("50 characters");
  });

  it("rejects empty category", () => {
    const result = listingSchema.safeParse({ ...validListing, category: "" });
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

  it("transforms pricePerWeek 0 to undefined", () => {
    const result = listingSchema.safeParse({ ...validListing, pricePerWeek: 0 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pricePerWeek).toBeUndefined();
  });

  it("transforms pricePerMonth 0 to undefined", () => {
    const result = listingSchema.safeParse({ ...validListing, pricePerMonth: 0 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pricePerMonth).toBeUndefined();
  });

  it("accepts all valid condition values", () => {
    for (const c of ["new", "like-new", "good", "fair", "poor"] as const) {
      expect(listingSchema.safeParse({ ...validListing, condition: c }).success).toBe(true);
    }
  });

  it("rejects invalid condition", () => {
    const result = listingSchema.safeParse({ ...validListing, condition: "broken" });
    expect(result.success).toBe(false);
  });

  it("rejects latitude out of range", () => {
    const bad = { ...validListing, location: { ...validListing.location, coordinates: { lat: 91, lng: 0 } } };
    expect(listingSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects longitude out of range", () => {
    const bad = { ...validListing, location: { ...validListing.location, coordinates: { lat: 0, lng: 181 } } };
    expect(listingSchema.safeParse(bad).success).toBe(false);
  });

  it("requires at least one image", () => {
    const result = listingSchema.safeParse({ ...validListing, photos: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain("At least one image");
  });

  it("rejects more than 10 photos", () => {
    const photos = Array(11).fill("https://img.example.com/x.jpg");
    expect(listingSchema.safeParse({ ...validListing, photos }).success).toBe(false);
  });

  it("rejects non-URL image strings", () => {
    expect(listingSchema.safeParse({ ...validListing, photos: ["not-a-url"] }).success).toBe(false);
  });

  it("defaults instantBooking to false", () => {
    const result = listingSchema.safeParse(validListing);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.instantBooking).toBe(false);
  });

  it("rejects securityDeposit above 5000", () => {
    expect(listingSchema.safeParse({ ...validListing, securityDeposit: 5001 }).success).toBe(false);
  });

  it("rejects minimumRentalPeriod below 1", () => {
    expect(listingSchema.safeParse({ ...validListing, minimumRentalPeriod: 0 }).success).toBe(false);
  });

  it("accepts valid cancellationPolicy values", () => {
    for (const p of ["flexible", "moderate", "strict"] as const) {
      expect(listingSchema.safeParse({ ...validListing, cancellationPolicy: p }).success).toBe(true);
    }
  });

  it("defaults features to empty array", () => {
    const result = listingSchema.safeParse(validListing);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.features).toEqual([]);
  });

  it("transforms deliveryRadius 0 to undefined", () => {
    const result = listingSchema.safeParse({ ...validListing, deliveryRadius: 0 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.deliveryRadius).toBeUndefined();
  });

  it("rejects rules longer than 1000 characters", () => {
    expect(listingSchema.safeParse({ ...validListing, rules: "R".repeat(1001) }).success).toBe(false);
  });
});

/* ════════════════════════ searchSchema ════════════════════════ */

describe("searchSchema", () => {
  it("accepts empty object (all optional)", () => {
    const result = searchSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("defaults page to 1", () => {
    const result = searchSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(1);
  });

  it("defaults limit to 20", () => {
    const result = searchSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(20);
  });

  it("rejects limit above 100", () => {
    expect(searchSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("rejects page below 1", () => {
    expect(searchSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it("accepts valid sortBy values", () => {
    for (const s of ["price-asc", "price-desc", "rating", "newest", "popular"]) {
      expect(searchSchema.safeParse({ sortBy: s }).success).toBe(true);
    }
  });

  it("rejects invalid sortBy", () => {
    expect(searchSchema.safeParse({ sortBy: "random" }).success).toBe(false);
  });

  it("accepts lat/lng within range", () => {
    expect(searchSchema.safeParse({ lat: 27.7, lng: 85.3 }).success).toBe(true);
  });

  it("rejects lat out of range", () => {
    expect(searchSchema.safeParse({ lat: -91 }).success).toBe(false);
  });

  it("accepts optional condition filter", () => {
    expect(searchSchema.safeParse({ condition: "new" }).success).toBe(true);
  });
});

/* ════════════════════════ loginSchema ════════════════════════ */

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(loginSchema.safeParse({ email: "test@example.np", password: "12345678" }).success).toBe(true);
  });

  it("rejects empty email", () => {
    expect(loginSchema.safeParse({ email: "", password: "12345678" }).success).toBe(false);
  });

  it("rejects invalid email format", () => {
    expect(loginSchema.safeParse({ email: "not-email", password: "12345678" }).success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    expect(loginSchema.safeParse({ email: "a@b.np", password: "1234567" }).success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.np", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain("required");
  });
});

/* ════════════════════════ signupSchema ════════════════════════ */

const validSignup = {
  email: "ram@example.np",
  password: "Test@123",
  confirmPassword: "Test@123",
  firstName: "Ram",
};

describe("signupSchema", () => {
  it("accepts valid signup data", () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it("rejects password without uppercase", () => {
    expect(signupSchema.safeParse({ ...validSignup, password: "test@123", confirmPassword: "test@123" }).success).toBe(false);
  });

  it("rejects password without lowercase", () => {
    expect(signupSchema.safeParse({ ...validSignup, password: "TEST@123", confirmPassword: "TEST@123" }).success).toBe(false);
  });

  it("rejects password without digit", () => {
    expect(signupSchema.safeParse({ ...validSignup, password: "Test@abc", confirmPassword: "Test@abc" }).success).toBe(false);
  });

  it("rejects password without special character", () => {
    expect(signupSchema.safeParse({ ...validSignup, password: "Test1234", confirmPassword: "Test1234" }).success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const result = signupSchema.safeParse({ ...validSignup, confirmPassword: "Different@1" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.message.includes("do not match"))).toBe(true);
  });

  it("rejects firstName shorter than 2 characters", () => {
    expect(signupSchema.safeParse({ ...validSignup, firstName: "R" }).success).toBe(false);
  });

  it("accepts optional lastName", () => {
    expect(signupSchema.safeParse({ ...validSignup, lastName: "Sharma" }).success).toBe(true);
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it("rejects invalid phone number", () => {
    expect(signupSchema.safeParse({ ...validSignup, phone: "abc" }).success).toBe(false);
  });

  it("accepts valid phone with +", () => {
    expect(signupSchema.safeParse({ ...validSignup, phone: "+9779812345678" }).success).toBe(true);
  });

  it("accepts empty string phone", () => {
    expect(signupSchema.safeParse({ ...validSignup, phone: "" }).success).toBe(true);
  });

  it("accepts optional role", () => {
    expect(signupSchema.safeParse({ ...validSignup, role: "owner" }).success).toBe(true);
  });
});

/* ════════════════════════ forgotPasswordSchema ════════════════════════ */

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "x@y.np" }).success).toBe(true);
  });

  it("rejects empty email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

/* ════════════════════════ resetPasswordSchema ════════════════════════ */

describe("resetPasswordSchema", () => {
  it("accepts matching strong passwords", () => {
    expect(resetPasswordSchema.safeParse({ password: "New@1234", confirmPassword: "New@1234" }).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({ password: "New@1234", confirmPassword: "Old@5678" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.message.includes("do not match"))).toBe(true);
  });

  it("rejects weak password", () => {
    expect(resetPasswordSchema.safeParse({ password: "weakpass", confirmPassword: "weakpass" }).success).toBe(false);
  });
});
