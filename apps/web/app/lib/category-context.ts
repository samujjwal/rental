/**
 * Category-aware contextual labels and behaviour config.
 *
 * Determines how a listing detail page adapts its terminology,
 * form fields, and descriptions based on the listing's category.
 */

// ---------------------------------------------------------------------------
// Category families
// ---------------------------------------------------------------------------

export type CategoryFamily =
  | "vehicle"
  | "property"
  | "equipment"
  | "electronics"
  | "clothing"
  | "instrument"
  | "event-space"
  | "bike"
  | "sports"
  | "parking"
  | "storage"
  | "general";

const FAMILY_MAP: Record<string, CategoryFamily> = {
  // Vehicles
  car: "vehicle",
  truck: "vehicle",
  suv: "vehicle",
  van: "vehicle",
  vehicle: "vehicle",
  vehicles: "vehicle",
  motorcycle: "vehicle",
  scooter: "vehicle",
  rv: "vehicle",

  // Properties
  apartment: "property",
  house: "property",
  villa: "property",
  studio: "property",
  "office-space": "property",
  condo: "property",
  room: "property",
  cabin: "property",
  cottage: "property",
  townhouse: "property",
  penthouse: "property",
  property: "property",

  // Equipment / Tools
  equipment: "equipment",
  tools: "equipment",
  "heavy-equipment": "equipment",
  machinery: "equipment",

  // Electronics / Camera
  "camera-electronics": "electronics",
  electronics: "electronics",
  camera: "electronics",
  gadgets: "electronics",

  // Clothing / Fashion
  "clothing-costumes": "clothing",
  clothing: "clothing",
  fashion: "clothing",
  wearables: "clothing",
  costumes: "clothing",

  // Musical instruments
  "musical-instrument": "instrument",
  instruments: "instrument",
  instrument: "instrument",

  // Event spaces
  "event-space": "event-space",
  "event-venue": "event-space",
  "banquet-hall": "event-space",
  "conference-room": "event-space",

  // Bikes (bicycle, motorcycle, scooter)
  bike: "bike",
  bicycle: "bike",
  ebike: "bike",

  // Sports
  "sports-equipment": "sports",
  sports: "sports",
  "outdoor-gear": "sports",

  // Parking
  "parking-space": "parking",
  parking: "parking",
  garage: "parking",

  // Storage
  "storage-space": "storage",
  storage: "storage",
  warehouse: "storage",
  locker: "storage",
};

/**
 * Resolve the category slug (or display name) to a top-level family.
 * Falls back to "general" for unknown categories.
 */
export function getCategoryFamily(
  categorySlug: string | undefined | null,
  categoryName?: string | null
): CategoryFamily {
  if (categorySlug) {
    const slug = categorySlug.toLowerCase().trim();
    if (FAMILY_MAP[slug]) return FAMILY_MAP[slug];

    // Partial match
    for (const key of Object.keys(FAMILY_MAP)) {
      if (slug.includes(key) || key.includes(slug)) return FAMILY_MAP[key];
    }
  }

  // Try category display name as fallback
  if (categoryName) {
    const name = categoryName.toLowerCase().trim();
    if (FAMILY_MAP[name]) return FAMILY_MAP[name];
    for (const key of Object.keys(FAMILY_MAP)) {
      if (name.includes(key) || key.includes(name)) return FAMILY_MAP[key];
    }
  }

  return "general";
}

// ---------------------------------------------------------------------------
// Context config per family
// ---------------------------------------------------------------------------

export interface CategoryContext {
  // ── Booking form fields ────────────────────────────────────────────────────
  /** Whether to show the "Guests" / occupant count input in the booking form */
  showGuestCount: boolean;
  /** Label for the guest count field (if shown) */
  guestLabel: string;
  /** Whether to show a quantity / number-of-units input in the booking form */
  showQuantity: boolean;
  /** Label for the quantity field (if shown) */
  quantityLabel: string;
  /**
   * Whether this category supports pickup / delivery / shipping options.
   * False for properties, event-spaces and parking (you physically go there).
   */
  supportsDelivery: boolean;
  /** Label for the booking start date input */
  startDateLabel: string;
  /** Label for the booking end date input */
  endDateLabel: string;

  // ── Content section visibility ─────────────────────────────────────────────
  /** Whether to display the physical condition badge (false for properties) */
  showCondition: boolean;
  /** Whether to show the check-in / check-out time row in rental terms */
  showCheckInOut: boolean;
  /** Whether to show a cleaning fee row (true only for property-type rentals) */
  showCleaningFee: boolean;

  // ── Labels ─────────────────────────────────────────────────────────────────
  /** Section heading for rental terms / stay details */
  rentalTermsHeading: string;
  /** Label for the "minimum rental period" term row */
  minRentalLabel: string;
  /** Label for the "maximum rental period" term row */
  maxRentalLabel: string;
  /** Heading for the rules/guidelines section */
  rulesHeading: string;
  /** Heading for the features / amenities block */
  featuresLabel: string;
  /** How to label the pricing period (e.g. "per day", "per night") */
  pricePeriodLabel: string;
  /**
   * Short unit used in the sidebar price display (e.g. "day", "night").
   * Equals pricePeriodLabel with "per " stripped.
   */
  pricePeriodUnit: string;
  /** Text after the security deposit amount explaining refund */
  depositReturnText: string;
  /** Label for the security deposit row */
  securityDepositLabel: string;
  /** Placeholder for the "message to owner" textarea */
  messagePlaceholder: string;
  /** What to call the listing owner */
  ownerLabel: string;
  /** Unit for delivery radius */
  distanceUnit: string;
  /** Descriptive noun for the item being rented */
  itemNoun: string;
}

const DEFAULTS: CategoryContext = {
  // booking form
  showGuestCount: false,
  guestLabel: "Guests",
  showQuantity: false,
  quantityLabel: "Number of Units",
  supportsDelivery: true,
  startDateLabel: "Start Date",
  endDateLabel: "End Date",
  // content sections
  showCondition: true,
  showCheckInOut: false,
  showCleaningFee: false,
  // labels
  rentalTermsHeading: "Rental Terms",
  minRentalLabel: "Minimum Rental Period",
  maxRentalLabel: "Maximum Rental Period",
  rulesHeading: "Rental Guidelines",
  featuresLabel: "Features",
  pricePeriodLabel: "per day",
  pricePeriodUnit: "day",
  depositReturnText: "Security deposit will be refunded after the rental period",
  securityDepositLabel: "Security Deposit",
  messagePlaceholder: "Tell the owner about your needs…",
  ownerLabel: "Owner",
  distanceUnit: "km",
  itemNoun: "item",
};

const FAMILY_CONTEXT: Record<CategoryFamily, Partial<CategoryContext>> = {
  vehicle: {
    supportsDelivery: true,
    showCondition: true,
    showCheckInOut: false,
    showCleaningFee: false,
    startDateLabel: "Pickup Date",
    endDateLabel: "Return Date",
    rentalTermsHeading: "Rental Terms",
    minRentalLabel: "Minimum Rental Period",
    maxRentalLabel: "Maximum Rental Period",
    rulesHeading: "Vehicle Policy",
    featuresLabel: "Features",
    pricePeriodLabel: "per day",
    pricePeriodUnit: "day",
    depositReturnText:
      "Security deposit will be refunded after the vehicle is returned in good condition",
    securityDepositLabel: "Security Deposit",
    messagePlaceholder:
      "Let the owner know about your trip plans, driving experience, or any questions\u2026",
    ownerLabel: "Owner",
    itemNoun: "vehicle",
  },
  property: {
    showGuestCount: true,
    guestLabel: "Guests",
    supportsDelivery: false,
    showCondition: false,
    showCheckInOut: true,
    showCleaningFee: true,
    startDateLabel: "Check-in Date",
    endDateLabel: "Check-out Date",
    rentalTermsHeading: "Stay Details",
    minRentalLabel: "Minimum Stay",
    maxRentalLabel: "Maximum Stay",
    rulesHeading: "House Rules",
    featuresLabel: "Amenities",
    pricePeriodLabel: "per night",
    pricePeriodUnit: "night",
    depositReturnText:
      "Security deposit will be refunded after checkout, subject to inspection",
    securityDepositLabel: "Security Deposit",
    messagePlaceholder:
      "Tell the host about your stay \u2014 purpose of visit, arrival time, any special requirements\u2026",
    ownerLabel: "Host",
    itemNoun: "property",
  },
  equipment: {
    showQuantity: true,
    quantityLabel: "Number of Units Needed",
    supportsDelivery: true,
    showCondition: true,
    startDateLabel: "Start Date",
    endDateLabel: "End Date",
    rentalTermsHeading: "Rental Terms",
    minRentalLabel: "Minimum Rental Period",
    maxRentalLabel: "Maximum Rental Period",
    rulesHeading: "Usage Terms",
    featuresLabel: "Features",
    depositReturnText:
      "Security deposit will be refunded once the equipment is returned in working condition",
    messagePlaceholder:
      "Describe your project or event, how many units you need, and any accessories you may require\u2026",
    itemNoun: "equipment",
  },
  electronics: {
    showQuantity: true,
    quantityLabel: "Number of Units",
    supportsDelivery: true,
    showCondition: true,
    startDateLabel: "Start Date",
    endDateLabel: "End Date",
    rentalTermsHeading: "Rental Terms",
    minRentalLabel: "Minimum Rental Period",
    maxRentalLabel: "Maximum Rental Period",
    rulesHeading: "Usage Terms",
    featuresLabel: "Features",
    depositReturnText:
      "Security deposit will be refunded once the device is returned in working condition",
    messagePlaceholder:
      "Let the owner know what you'll be using the equipment for and how many units you need\u2026",
    itemNoun: "device",
  },
  clothing: {
    supportsDelivery: true,
    showCondition: true,
    startDateLabel: "From Date",
    endDateLabel: "To Date",
    rentalTermsHeading: "Rental Terms",
    minRentalLabel: "Minimum Rental Period",
    maxRentalLabel: "Maximum Rental Period",
    rulesHeading: "Care & Return Policy",
    featuresLabel: "Details",
    pricePeriodLabel: "per day",
    pricePeriodUnit: "day",
    depositReturnText:
      "Security deposit will be refunded once the item is returned in clean condition",
    messagePlaceholder:
      "Let the owner know the occasion and any sizing questions\u2026",
    itemNoun: "item",
  },
  instrument: {
    supportsDelivery: true,
    showCondition: true,
    startDateLabel: "Start Date",
    endDateLabel: "End Date",
    rentalTermsHeading: "Rental Terms",
    minRentalLabel: "Minimum Rental Period",
    maxRentalLabel: "Maximum Rental Period",
    rulesHeading: "Usage Terms",
    featuresLabel: "Features",
    depositReturnText:
      "Security deposit will be refunded once the instrument is returned in good condition",
    messagePlaceholder:
      "Tell the owner about your skill level and how you plan to use the instrument\u2026",
    itemNoun: "instrument",
  },
  "event-space": {
    showGuestCount: true,
    guestLabel: "Expected Attendees",
    supportsDelivery: false,
    showCondition: false,
    showCheckInOut: true,
    showCleaningFee: false,
    startDateLabel: "Event Date",
    endDateLabel: "End Date",
    rentalTermsHeading: "Booking Details",
    minRentalLabel: "Minimum Booking",
    maxRentalLabel: "Maximum Booking",
    rulesHeading: "Venue Rules",
    featuresLabel: "Amenities",
    pricePeriodLabel: "per day",
    pricePeriodUnit: "day",
    depositReturnText:
      "Security deposit will be refunded after the event, subject to venue inspection",
    messagePlaceholder:
      "Describe your event type, estimated attendance, and any special setup needs\u2026",
    ownerLabel: "Host",
    itemNoun: "venue",
  },
  bike: {
    supportsDelivery: true,
    showCondition: true,
    startDateLabel: "Pickup Date",
    endDateLabel: "Return Date",
    rentalTermsHeading: "Rental Terms",
    minRentalLabel: "Minimum Rental Period",
    maxRentalLabel: "Maximum Rental Period",
    rulesHeading: "Ride Guidelines",
    featuresLabel: "Features",
    depositReturnText:
      "Security deposit will be refunded once the bike is returned in good condition",
    messagePlaceholder:
      "Let the owner know about your riding plans and experience level\u2026",
    itemNoun: "bike",
  },
  sports: {
    showQuantity: true,
    quantityLabel: "Number of Units",
    supportsDelivery: true,
    showCondition: true,
    startDateLabel: "Start Date",
    endDateLabel: "End Date",
    rentalTermsHeading: "Rental Terms",
    minRentalLabel: "Minimum Rental Period",
    maxRentalLabel: "Maximum Rental Period",
    rulesHeading: "Usage Terms",
    featuresLabel: "Features",
    depositReturnText:
      "Security deposit will be refunded once the equipment is returned in good condition",
    messagePlaceholder:
      "Tell the owner about your skill level and planned activity\u2026",
    itemNoun: "equipment",
  },
  parking: {
    supportsDelivery: false,
    showCondition: false,
    showCheckInOut: false,
    startDateLabel: "From Date",
    endDateLabel: "To Date",
    rentalTermsHeading: "Parking Details",
    minRentalLabel: "Minimum Period",
    maxRentalLabel: "Maximum Period",
    rulesHeading: "Parking Rules",
    featuresLabel: "Features",
    pricePeriodLabel: "per day",
    pricePeriodUnit: "day",
    depositReturnText:
      "Security deposit will be refunded at the end of your parking period",
    messagePlaceholder:
      "Let the owner know your vehicle type and expected parking duration\u2026",
    itemNoun: "parking space",
  },
  storage: {
    supportsDelivery: false,
    showCondition: false,
    showCheckInOut: false,
    startDateLabel: "Move-in Date",
    endDateLabel: "Move-out Date",
    rentalTermsHeading: "Storage Details",
    minRentalLabel: "Minimum Storage Period",
    maxRentalLabel: "Maximum Storage Period",
    rulesHeading: "Storage Rules",
    featuresLabel: "Features",
    pricePeriodLabel: "per month",
    pricePeriodUnit: "month",
    depositReturnText:
      "Security deposit will be refunded when you vacate the storage unit",
    messagePlaceholder:
      "Let the owner know what you plan to store and how long you need the space\u2026",
    itemNoun: "storage unit",
  },
  general: {},
};

/**
 * Get the full context config for a given category slug/name.
 */
export function getCategoryContext(
  categorySlug: string | undefined | null,
  categoryName?: string | null
): CategoryContext {
  const family = getCategoryFamily(categorySlug, categoryName);
  return { ...DEFAULTS, ...FAMILY_CONTEXT[family] };
}
