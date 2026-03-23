/**
 * useListingCompletenessScore
 *
 * Returns a 0-100 score representing how complete the listing creation form is.
 * Re-computes whenever the watched fields change.
 */
import { useMemo } from "react";
import type { UseFormWatch } from "react-hook-form";
import type { z } from "zod";
import type { listingSchema } from "~/lib/validation/listing";

type FormValues = z.input<typeof listingSchema>;

interface UseListingCompletenessScoreOptions {
  watch: UseFormWatch<FormValues>;
  imageUrls: string[];
}

export function useListingCompletenessScore({
  watch,
  imageUrls,
}: UseListingCompletenessScoreOptions): number {
  const title = watch("title");
  const description = watch("description");
  const category = watch("category");
  const basePrice = watch("basePrice");
  const condition = watch("condition");
  const location = watch("location");
  const features = watch("features");

  return useMemo(() => {
    const checks = [
      { filled: !!title && title.length >= 10, weight: 10 },
      { filled: !!description && description.length >= 50, weight: 15 },
      { filled: !!category, weight: 10 },
      { filled: typeof basePrice === "number" && basePrice > 0, weight: 10 },
      { filled: !!condition, weight: 5 },
      { filled: !!location?.city, weight: 10 },
      { filled: !!location?.address, weight: 5 },
      { filled: !!location?.country, weight: 5 },
      { filled: imageUrls.length >= 3, weight: 20 },
      { filled: imageUrls.length >= 5, weight: 5 },
      { filled: Array.isArray(features) && features.length > 0, weight: 5 },
    ];

    const total = checks.reduce((s, c) => s + c.weight, 0);
    const earned = checks.filter((c) => c.filled).reduce((s, c) => s + c.weight, 0);
    return Math.round((earned / total) * 100);
  }, [title, description, category, basePrice, condition, location, features, imageUrls]);
}
