import { z } from "zod";

export const listingSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .min(10, "Title must be at least 10 characters")
    .max(100, "Title must be less than 100 characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .min(50, "Description must be at least 50 characters")
    .max(2000, "Description must be less than 2000 characters"),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  pricePerDay: z
    .number()
    .min(1, "Price per day must be at least $1")
    .max(10000, "Price per day must be less than $10,000"),
  pricePerWeek: z
    .number()
    .min(1)
    .max(50000)
    .optional()
    .or(z.literal(0))
    .transform((val) => (val === 0 ? undefined : val)),
  pricePerMonth: z
    .number()
    .min(1)
    .max(200000)
    .optional()
    .or(z.literal(0))
    .transform((val) => (val === 0 ? undefined : val)),
  condition: z.enum(["new", "like-new", "good", "fair", "poor"]),
  location: z.object({
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    country: z.string().min(1, "Country is required"),
    postalCode: z.string().min(1, "Postal code is required"),
    coordinates: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  }),
  images: z
    .array(z.string().url())
    .min(1, "At least one image is required")
    .max(10, "Maximum 10 images allowed"),
  instantBooking: z.boolean().default(false),
  deliveryOptions: z.object({
    pickup: z.boolean(),
    delivery: z.boolean(),
    shipping: z.boolean(),
  }),
  deliveryRadius: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .or(z.literal(0))
    .transform((val) => (val === 0 ? undefined : val)),
  deliveryFee: z
    .number()
    .min(0)
    .max(500)
    .optional()
    .or(z.literal(0))
    .transform((val) => (val === 0 ? undefined : val)),
  securityDeposit: z
    .number()
    .min(0, "Security deposit must be at least $0")
    .max(5000, "Security deposit must be less than $5,000"),
  minimumRentalPeriod: z
    .number()
    .min(1, "Minimum rental period must be at least 1 day")
    .max(365, "Minimum rental period must be less than 365 days"),
  maximumRentalPeriod: z
    .number()
    .min(1)
    .max(365)
    .optional()
    .or(z.literal(0))
    .transform((val) => (val === 0 ? undefined : val)),
  cancellationPolicy: z.enum(["flexible", "moderate", "strict"]),
  rules: z
    .string()
    .max(1000, "Rules must be less than 1000 characters")
    .optional(),
  features: z.array(z.string()).optional().default([]),
});

export const searchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  location: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radius: z.number().min(1).max(100).optional(),
  condition: z.enum(["new", "like-new", "good", "fair", "poor"]).optional(),
  instantBooking: z.boolean().optional(),
  delivery: z.boolean().optional(),
  sortBy: z
    .enum(["price-asc", "price-desc", "rating", "newest", "popular"])
    .optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
});

export type ListingInput = z.infer<typeof listingSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
