import { z } from "zod";

export const bookingSchema = z
  .object({
    listingId: z.string().min(1, "Listing is required"),
    startDate: z
      .string()
      .min(1, "Start date is required")
      .refine((date) => {
        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selectedDate >= today;
      }, "Start date must be today or in the future"),
    endDate: z.string().min(1, "End date is required"),
    guestCount: z.number().int().min(1).max(100).optional(),
    deliveryMethod: z.enum(["pickup", "delivery", "shipping"]),
    deliveryAddress: z.string().max(500).optional(),
    specialRequests: z
      .string()
      .max(500, "Special requests must be less than 500 characters")
      .optional(),
    promoCode: z.string().max(50).optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end > start;
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    }
  )
  .refine(
    (data) => {
      if (data.deliveryMethod === "delivery" && !data.deliveryAddress) {
        return false;
      }
      return true;
    },
    {
      message: "Delivery address is required for delivery method",
      path: ["deliveryAddress"],
    }
  );

export const reviewSchema = z.object({
  bookingId: z.string().min(1, "Booking is required"),
  reviewType: z.enum(["RENTER_TO_OWNER", "OWNER_TO_RENTER"]),
  overallRating: z
    .number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  accuracyRating: z.number().min(1).max(5).optional(),
  communicationRating: z.number().min(1).max(5).optional(),
  cleanlinessRating: z.number().min(1).max(5).optional(),
  valueRating: z.number().min(1).max(5).optional(),
  comment: z
    .string()
    .min(10, "Comment must be at least 10 characters")
    .max(2000, "Comment must be less than 2000 characters")
    .optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
