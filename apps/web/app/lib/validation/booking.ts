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
    deliveryMethod: z.enum(["pickup", "delivery", "shipping"]),
    deliveryAddress: z.string().optional(),
    specialRequests: z
      .string()
      .max(500, "Special requests must be less than 500 characters")
      .optional(),
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
  rating: z
    .number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z
    .string()
    .min(10, "Comment must be at least 10 characters")
    .max(1000, "Comment must be less than 1000 characters"),
  categories: z.object({
    accuracy: z.number().min(1).max(5).optional(),
    communication: z.number().min(1).max(5).optional(),
    cleanliness: z.number().min(1).max(5).optional(),
    value: z.number().min(1).max(5).optional(),
  }),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
