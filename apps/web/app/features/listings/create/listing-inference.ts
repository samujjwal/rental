/**
 * listing-inference
 *
 * Pure utility functions for inferring listing field values from natural language
 * title/description text. Used by the Quick Create (AI-assisted) flow.
 *
 * All functions are side-effect free and easily unit-testable.
 */
import { geoApi } from "~/lib/api/geo";
import { APP_MAP_CENTER } from "~/config/locale";
import type { ListingInput } from "~/lib/validation/listing";

export const KEYWORD_PRICE_HINTS: Array<{ pattern: RegExp; price: number }> = [
  { pattern: /(camera|lens|gopro|drone)/i, price: 5000 },
  { pattern: /(car|suv|truck|van)/i, price: 10000 },
  { pattern: /(bike|bicycle|scooter)/i, price: 2500 },
  { pattern: /(tool|drill|saw|ladder)/i, price: 3000 },
  { pattern: /(dress|suit|tuxedo|fashion)/i, price: 3500 },
  { pattern: /(speaker|party|event|projector)/i, price: 6000 },
];

/**
 * Known city → coordinate map. Fast fallback when the geocoding API is unavailable.
 * All coordinates are WGS-84 (lat/lng). Keys are lower-case ASCII city names.
 */
export const CITY_COORDINATE_HINTS: Record<string, { lat: number; lng: number }> = {
  kathmandu: { lat: 27.7172, lng: 85.324 },
  pokhara: { lat: 28.2096, lng: 83.9856 },
  lalitpur: { lat: 27.6588, lng: 85.3247 },
  bharatpur: { lat: 27.6833, lng: 84.4333 },
  biratnagar: { lat: 26.4525, lng: 87.2718 },
  birgunj: { lat: 27.0104, lng: 84.8777 },
  dharan: { lat: 26.8065, lng: 87.2846 },
};

/** Return the best-matching category ID from a list of categories, given a title + description. */
export function inferCategoryId(
  title: string,
  description: string,
  categories: Array<{ id: string; name: string }>,
): string | undefined {
  const text = `${title} ${description}`.toLowerCase();

  const direct = categories.find((c) => text.includes(c.name.toLowerCase()));
  if (direct) return direct.id;

  const hints: Array<{ keyword: RegExp; names: string[] }> = [
    { keyword: /(camera|lens|drone|gopro|photo)/i, names: ["electronics", "photography"] },
    { keyword: /(car|truck|suv|bike|scooter|vehicle)/i, names: ["vehicle", "vehicles", "transport"] },
    { keyword: /(tool|drill|ladder|saw|generator)/i, names: ["tools", "equipment"] },
    { keyword: /(dress|suit|tuxedo|fashion|jewelry)/i, names: ["fashion", "wearables", "clothing"] },
    { keyword: /(party|speaker|projector|event)/i, names: ["event", "party"] },
  ];

  for (const hint of hints) {
    if (!hint.keyword.test(text)) continue;
    const match = categories.find((c) =>
      hint.names.some((name) => c.name.toLowerCase().includes(name)),
    );
    if (match) return match.id;
  }

  return categories[0]?.id;
}

/** Infer item condition from natural language. */
export function inferCondition(
  title: string,
  description: string,
): ListingInput["condition"] {
  const text = `${title} ${description}`.toLowerCase();
  if (/brand new|unused|sealed/.test(text)) return "new";
  if (/like new|mint|excellent/.test(text)) return "like-new";
  if (/fair|visible wear/.test(text)) return "fair";
  if (/poor|damaged|for parts/.test(text)) return "poor";
  return "good";
}

/** Infer a reasonable daily price from the title/description text (in local currency units). */
export function inferDailyPrice(title: string, description: string): number {
  const text = `${title} ${description}`;
  const explicit = text.match(
    /(?:[A-Z]{2,4}\s*\.?|[^\w\s])?\s*(\d{1,6})(?:\.\d+)?\s*(?:\/day|per day|daily)/i,
  );
  if (explicit) return Math.max(1, Math.min(10_000, Number(explicit[1])));
  const hint = KEYWORD_PRICE_HINTS.find((entry) => entry.pattern.test(text));
  return hint?.price ?? 30;
}

/**
 * Resolve lat/lng for a city string.
 * Falls back to the known-cities map, then the geocoding API, then APP_MAP_CENTER.
 */
export async function inferCoordinates(
  city: string,
  country = "Nepal",
  lat?: number,
  lng?: number,
): Promise<{ lat: number; lng: number }> {
  if (typeof lat === "number" && typeof lng === "number") {
    return { lat, lng };
  }

  const key = city.trim().toLowerCase();
  if (CITY_COORDINATE_HINTS[key]) {
    return CITY_COORDINATE_HINTS[key];
  }

  if (city.trim()) {
    try {
      const result = await geoApi.autocomplete(`${city.trim()}, ${country}`, { limit: 1 });
      if (result.results?.length > 0) {
        const coords = result.results[0].coordinates;
        return { lat: coords.lat, lng: coords.lon };
      }
    } catch {
      // Geocoding failed — fall through to the app default centre.
    }
  }

  return { lat: APP_MAP_CENTER[0], lng: APP_MAP_CENTER[1] };
}

/** Extract feature keywords from natural language. */
export function inferFeatureHints(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const features: string[] = [];
  if (/waterproof/.test(text)) features.push("waterproof");
  if (/wireless|bluetooth/.test(text)) features.push("wireless");
  if (/portable/.test(text)) features.push("portable");
  if (/professional|pro/.test(text)) features.push("professional-grade");
  return features;
}
