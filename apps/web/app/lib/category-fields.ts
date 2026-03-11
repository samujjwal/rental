/**
 * Category-specific field definitions.
 *
 * Each category slug maps to an array of extra fields that should be
 * collected during listing creation and displayed on the listing detail page.
 *
 * Field types:
 *   text      – free-form string input
 *   number    – numeric input
 *   select    – dropdown with predefined options
 *   boolean   – checkbox
 *   multiselect – multiple-choice checkboxes
 */

export interface CategoryFieldOption {
  value: string;
  label: string;
}

export interface CategoryField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean" | "multiselect";
  required?: boolean;
  placeholder?: string;
  options?: CategoryFieldOption[];
  unit?: string; // e.g. "sq ft", "miles", "lbs"
  min?: number;
  max?: number;
  group?: string; // visual grouping label
}

export interface CategoryFieldGroup {
  label: string;
  fields: CategoryField[];
}

// ---------------------------------------------------------------------------
// Category field definitions keyed by category slug (lowercase, hyphenated)
// ---------------------------------------------------------------------------

const vehicleFeatures: CategoryFieldOption[] = [
  { value: "gps", label: "GPS Navigation" },
  { value: "bluetooth", label: "Bluetooth" },
  { value: "backup_camera", label: "Backup Camera" },
  { value: "sunroof", label: "Sunroof" },
  { value: "leather_seats", label: "Leather Seats" },
  { value: "heated_seats", label: "Heated Seats" },
  { value: "apple_carplay", label: "Apple CarPlay" },
  { value: "android_auto", label: "Android Auto" },
  { value: "cruise_control", label: "Cruise Control" },
  { value: "parking_sensors", label: "Parking Sensors" },
];

const spaceAmenities: CategoryFieldOption[] = [
  { value: "wifi", label: "WiFi" },
  { value: "parking", label: "Parking" },
  { value: "kitchen", label: "Kitchen" },
  { value: "air_conditioning", label: "Air Conditioning" },
  { value: "heating", label: "Heating" },
  { value: "washer", label: "Washer" },
  { value: "dryer", label: "Dryer" },
  { value: "tv", label: "TV" },
  { value: "gym", label: "Gym" },
  { value: "pool", label: "Pool" },
  { value: "elevator", label: "Elevator" },
  { value: "wheelchair_accessible", label: "Wheelchair Accessible" },
];

const VEHICLE_FIELDS: CategoryField[] = [
  {
    key: "make",
    label: "Make",
    type: "text",
    required: true,
    placeholder: "e.g., Toyota, Honda, Ford",
    group: "Vehicle Details",
  },
  {
    key: "model",
    label: "Model",
    type: "text",
    required: true,
    placeholder: "e.g., Camry, Civic, F-150",
    group: "Vehicle Details",
  },
  {
    key: "year",
    label: "Year",
    type: "number",
    required: true,
    min: 1990,
    max: new Date().getFullYear() + 1,
    placeholder: "e.g., 2022",
    group: "Vehicle Details",
  },
  {
    key: "vehicleType",
    label: "Vehicle Type",
    type: "select",
    required: true,
    options: [
      { value: "car", label: "Car" },
      { value: "truck", label: "Truck" },
      { value: "suv", label: "SUV" },
      { value: "van", label: "Van" },
      { value: "motorcycle", label: "Motorcycle" },
      { value: "rv", label: "RV" },
    ],
    group: "Vehicle Details",
  },
  {
    key: "transmission",
    label: "Transmission",
    type: "select",
    required: true,
    options: [
      { value: "automatic", label: "Automatic" },
      { value: "manual", label: "Manual" },
    ],
    group: "Vehicle Details",
  },
  {
    key: "fuelType",
    label: "Fuel Type",
    type: "select",
    required: true,
    options: [
      { value: "gasoline", label: "Gasoline" },
      { value: "diesel", label: "Diesel" },
      { value: "electric", label: "Electric" },
      { value: "hybrid", label: "Hybrid" },
    ],
    group: "Vehicle Details",
  },
  {
    key: "seatingCapacity",
    label: "Seating Capacity",
    type: "number",
    required: true,
    min: 1,
    max: 50,
    placeholder: "e.g., 5",
    group: "Vehicle Details",
  },
  {
    key: "mileage",
    label: "Mileage",
    type: "number",
    min: 0,
    unit: "km",
    placeholder: "e.g., 35000",
    group: "Vehicle Details",
  },
  {
    key: "color",
    label: "Color",
    type: "text",
    placeholder: "e.g., Silver",
    group: "Vehicle Details",
  },
  {
    key: "vehicleFeatures",
    label: "Vehicle Features",
    type: "multiselect",
    options: vehicleFeatures,
    group: "Vehicle Features",
  },
];

const PROPERTY_FIELDS: CategoryField[] = [
  {
    key: "bedrooms",
    label: "Bedrooms",
    type: "number",
    required: true,
    min: 0,
    max: 20,
    placeholder: "e.g., 2",
    group: "Property Details",
  },
  {
    key: "bathrooms",
    label: "Bathrooms",
    type: "number",
    required: true,
    min: 0,
    max: 20,
    placeholder: "e.g., 1",
    group: "Property Details",
  },
  {
    key: "maxOccupancy",
    label: "Max Occupancy",
    type: "number",
    required: true,
    min: 1,
    max: 100,
    placeholder: "e.g., 4",
    group: "Property Details",
  },
  {
    key: "squareFootage",
    label: "Size",
    type: "number",
    min: 0,
    unit: "sq ft",
    placeholder: "e.g., 850",
    group: "Property Details",
  },
  {
    key: "furnished",
    label: "Furnished",
    type: "boolean",
    group: "Property Details",
  },
  {
    key: "petsAllowed",
    label: "Pets Allowed",
    type: "boolean",
    group: "Property Details",
  },
  {
    key: "smokingAllowed",
    label: "Smoking Allowed",
    type: "boolean",
    group: "Property Details",
  },
  {
    key: "spaceAmenities",
    label: "Amenities",
    type: "multiselect",
    options: spaceAmenities,
    group: "Amenities",
  },
];

const EQUIPMENT_FIELDS: CategoryField[] = [
  {
    key: "equipmentType",
    label: "Equipment Type",
    type: "text",
    required: true,
    placeholder: "e.g., Power Drill, Circular Saw",
    group: "Equipment Details",
  },
  {
    key: "brand",
    label: "Brand",
    type: "text",
    placeholder: "e.g., DeWalt, Makita",
    group: "Equipment Details",
  },
  {
    key: "modelNumber",
    label: "Model Number",
    type: "text",
    placeholder: "e.g., DCD791D2",
    group: "Equipment Details",
  },
  {
    key: "powerSource",
    label: "Power Source",
    type: "select",
    options: [
      { value: "electric", label: "Electric (Corded)" },
      { value: "battery", label: "Battery" },
      { value: "gas", label: "Gas" },
      { value: "manual", label: "Manual" },
    ],
    group: "Equipment Details",
  },
  {
    key: "weight",
    label: "Weight",
    type: "number",
    min: 0,
    unit: "kg",
    placeholder: "e.g., 15",
    group: "Equipment Details",
  },
  {
    key: "includesAccessories",
    label: "Includes Accessories",
    type: "boolean",
    group: "Equipment Details",
  },
  {
    key: "accessoriesDescription",
    label: "Accessories Included",
    type: "text",
    placeholder: "e.g., 2 batteries, charger, carrying case",
    group: "Equipment Details",
  },
];

const ELECTRONICS_FIELDS: CategoryField[] = [
  {
    key: "brand",
    label: "Brand",
    type: "text",
    required: true,
    placeholder: "e.g., Sony, Canon, DJI",
    group: "Product Details",
  },
  {
    key: "model",
    label: "Model",
    type: "text",
    required: true,
    placeholder: "e.g., A7 IV, EOS R5",
    group: "Product Details",
  },
  {
    key: "electronicsType",
    label: "Type",
    type: "select",
    required: true,
    options: [
      { value: "camera", label: "Camera" },
      { value: "lens", label: "Lens" },
      { value: "drone", label: "Drone" },
      { value: "laptop", label: "Laptop" },
      { value: "audio", label: "Audio Equipment" },
      { value: "lighting", label: "Lighting" },
      { value: "projector", label: "Projector" },
      { value: "other", label: "Other" },
    ],
    group: "Product Details",
  },
  {
    key: "serialNumber",
    label: "Serial Number",
    type: "text",
    placeholder: "For identification",
    group: "Product Details",
  },
  {
    key: "includesAccessories",
    label: "Includes Accessories",
    type: "boolean",
    group: "Product Details",
  },
  {
    key: "accessoriesDescription",
    label: "Accessories Included",
    type: "text",
    placeholder: "e.g., Extra battery, memory card, bag",
    group: "Product Details",
  },
];

const CLOTHING_FIELDS: CategoryField[] = [
  {
    key: "clothingType",
    label: "Type",
    type: "select",
    required: true,
    options: [
      { value: "suit", label: "Suit" },
      { value: "dress", label: "Dress" },
      { value: "tuxedo", label: "Tuxedo" },
      { value: "costume", label: "Costume" },
      { value: "shoes", label: "Shoes" },
      { value: "jewelry", label: "Jewelry" },
      { value: "handbag", label: "Handbag" },
      { value: "watch", label: "Watch" },
      { value: "accessories", label: "Accessories" },
    ],
    group: "Clothing Details",
  },
  {
    key: "size",
    label: "Size",
    type: "text",
    required: true,
    placeholder: "e.g., M, 10, 38R",
    group: "Clothing Details",
  },
  {
    key: "brand",
    label: "Brand / Designer",
    type: "text",
    placeholder: "e.g., Hugo Boss, Vera Wang",
    group: "Clothing Details",
  },
  {
    key: "color",
    label: "Color",
    type: "text",
    required: true,
    placeholder: "e.g., Navy Blue",
    group: "Clothing Details",
  },
  {
    key: "material",
    label: "Material",
    type: "text",
    placeholder: "e.g., Silk, Cotton, Polyester",
    group: "Clothing Details",
  },
  {
    key: "occasion",
    label: "Occasion",
    type: "multiselect",
    options: [
      { value: "wedding", label: "Wedding" },
      { value: "formal", label: "Formal Event" },
      { value: "casual", label: "Casual" },
      { value: "business", label: "Business" },
      { value: "party", label: "Party" },
      { value: "costume", label: "Costume/Theme" },
    ],
    group: "Clothing Details",
  },
  {
    key: "cleaningIncluded",
    label: "Professional Cleaning Included",
    type: "boolean",
    group: "Clothing Details",
  },
];

const INSTRUMENT_FIELDS: CategoryField[] = [
  {
    key: "instrumentType",
    label: "Instrument Type",
    type: "select",
    required: true,
    options: [
      { value: "guitar", label: "Guitar" },
      { value: "piano", label: "Piano / Keyboard" },
      { value: "drums", label: "Drums" },
      { value: "violin", label: "Violin" },
      { value: "saxophone", label: "Saxophone" },
      { value: "trumpet", label: "Trumpet" },
      { value: "other", label: "Other" },
    ],
    group: "Instrument Details",
  },
  {
    key: "brand",
    label: "Brand",
    type: "text",
    required: true,
    placeholder: "e.g., Fender, Yamaha, Gibson",
    group: "Instrument Details",
  },
  {
    key: "model",
    label: "Model",
    type: "text",
    placeholder: "e.g., Stratocaster, P-125",
    group: "Instrument Details",
  },
  {
    key: "electricOrAcoustic",
    label: "Electric / Acoustic",
    type: "select",
    options: [
      { value: "electric", label: "Electric" },
      { value: "acoustic", label: "Acoustic" },
      { value: "both", label: "Both" },
      { value: "na", label: "N/A" },
    ],
    group: "Instrument Details",
  },
  {
    key: "includesCase",
    label: "Includes Case",
    type: "boolean",
    group: "Instrument Details",
  },
  {
    key: "includesAccessories",
    label: "Includes Accessories",
    type: "boolean",
    group: "Instrument Details",
  },
  {
    key: "accessoriesDescription",
    label: "Accessories Included",
    type: "text",
    placeholder: "e.g., Amp, cables, picks, stand",
    group: "Instrument Details",
  },
];

const EVENT_SPACE_FIELDS: CategoryField[] = [
  {
    key: "venueType",
    label: "Venue Type",
    type: "select",
    required: true,
    options: [
      { value: "banquet_hall", label: "Banquet Hall" },
      { value: "conference_room", label: "Conference Room" },
      { value: "outdoor_space", label: "Outdoor Space" },
      { value: "theater", label: "Theater" },
      { value: "gallery", label: "Gallery" },
      { value: "studio", label: "Studio" },
    ],
    group: "Venue Details",
  },
  {
    key: "capacity",
    label: "Capacity",
    type: "number",
    required: true,
    min: 1,
    max: 10000,
    placeholder: "e.g., 200",
    unit: "people",
    group: "Venue Details",
  },
  {
    key: "squareFootage",
    label: "Size",
    type: "number",
    min: 0,
    unit: "sq ft",
    placeholder: "e.g., 3000",
    group: "Venue Details",
  },
  {
    key: "indoorOutdoor",
    label: "Setting",
    type: "select",
    required: true,
    options: [
      { value: "indoor", label: "Indoor" },
      { value: "outdoor", label: "Outdoor" },
      { value: "both", label: "Indoor & Outdoor" },
    ],
    group: "Venue Details",
  },
  {
    key: "avEquipment",
    label: "AV Equipment Available",
    type: "boolean",
    group: "Venue Details",
  },
  {
    key: "cateringAllowed",
    label: "Catering",
    type: "select",
    options: [
      { value: "in_house", label: "In-House Catering" },
      { value: "external_allowed", label: "External Catering Allowed" },
      { value: "none", label: "No Catering" },
    ],
    group: "Venue Details",
  },
  {
    key: "parkingSpaces",
    label: "Parking Spaces",
    type: "number",
    min: 0,
    placeholder: "e.g., 50",
    group: "Venue Details",
  },
];

const SPORTS_FIELDS: CategoryField[] = [
  {
    key: "sport",
    label: "Sport / Activity",
    type: "text",
    required: true,
    placeholder: "e.g., Skiing, Surfing, Golf",
    group: "Sports Details",
  },
  {
    key: "equipmentType",
    label: "Equipment Type",
    type: "text",
    required: true,
    placeholder: "e.g., Snowboard, Surfboard, Golf Clubs",
    group: "Sports Details",
  },
  {
    key: "brand",
    label: "Brand",
    type: "text",
    placeholder: "e.g., Burton, Channel Islands, Callaway",
    group: "Sports Details",
  },
  {
    key: "size",
    label: "Size",
    type: "text",
    placeholder: "e.g., 160cm, 6'2\", Standard",
    group: "Sports Details",
  },
  {
    key: "skillLevel",
    label: "Skill Level",
    type: "select",
    options: [
      { value: "beginner", label: "Beginner" },
      { value: "intermediate", label: "Intermediate" },
      { value: "advanced", label: "Advanced" },
      { value: "all", label: "All Levels" },
    ],
    group: "Sports Details",
  },
  {
    key: "includesAccessories",
    label: "Includes Accessories",
    type: "boolean",
    group: "Sports Details",
  },
  {
    key: "accessoriesDescription",
    label: "Accessories Included",
    type: "text",
    placeholder: "e.g., Bindings, boots, helmet",
    group: "Sports Details",
  },
];

const BIKE_FIELDS: CategoryField[] = [
  {
    key: "bikeType",
    label: "Bike Type",
    type: "select",
    required: true,
    options: [
      { value: "road", label: "Road Bike" },
      { value: "mountain", label: "Mountain Bike" },
      { value: "electric", label: "Electric Bike" },
      { value: "hybrid", label: "Hybrid" },
      { value: "cruiser", label: "Cruiser" },
      { value: "motorcycle", label: "Motorcycle" },
      { value: "scooter", label: "Scooter" },
    ],
    group: "Bike Details",
  },
  {
    key: "brand",
    label: "Brand",
    type: "text",
    placeholder: "e.g., Trek, Specialized, Giant",
    group: "Bike Details",
  },
  {
    key: "frameSize",
    label: "Frame Size",
    type: "text",
    placeholder: "e.g., Medium, 54cm",
    group: "Bike Details",
  },
  {
    key: "gears",
    label: "Number of Gears",
    type: "number",
    min: 1,
    max: 30,
    placeholder: "e.g., 21",
    group: "Bike Details",
  },
  {
    key: "includesHelmet",
    label: "Helmet Included",
    type: "boolean",
    group: "Bike Details",
  },
  {
    key: "includesLock",
    label: "Lock Included",
    type: "boolean",
    group: "Bike Details",
  },
];

// ---------------------------------------------------------------------------
// Slug → fields mapping
// ---------------------------------------------------------------------------

/**
 * Map category slugs to their specific fields.
 * When a category has no specific fields, an empty array is returned.
 */
export const CATEGORY_FIELD_MAP: Record<string, CategoryField[]> = {
  // Vehicles
  car: VEHICLE_FIELDS,
  truck: VEHICLE_FIELDS,
  suv: VEHICLE_FIELDS,
  van: VEHICLE_FIELDS,
  vehicle: VEHICLE_FIELDS,
  vehicles: VEHICLE_FIELDS,

  // Properties / Spaces
  apartment: PROPERTY_FIELDS,
  house: PROPERTY_FIELDS,
  villa: PROPERTY_FIELDS,
  studio: PROPERTY_FIELDS,
  "office-space": PROPERTY_FIELDS,
  condo: PROPERTY_FIELDS,
  room: PROPERTY_FIELDS,

  // Equipment
  equipment: EQUIPMENT_FIELDS,
  tools: EQUIPMENT_FIELDS,

  // Electronics
  "camera-electronics": ELECTRONICS_FIELDS,
  electronics: ELECTRONICS_FIELDS,
  camera: ELECTRONICS_FIELDS,

  // Clothing
  "clothing-costumes": CLOTHING_FIELDS,
  clothing: CLOTHING_FIELDS,
  fashion: CLOTHING_FIELDS,
  wearables: CLOTHING_FIELDS,

  // Instruments
  "musical-instrument": INSTRUMENT_FIELDS,
  instruments: INSTRUMENT_FIELDS,

  // Event Spaces
  "event-space": EVENT_SPACE_FIELDS,
  "event-venue": EVENT_SPACE_FIELDS,

  // Bikes
  bike: BIKE_FIELDS,
  bicycle: BIKE_FIELDS,

  // Sports
  "sports-equipment": SPORTS_FIELDS,
  sports: SPORTS_FIELDS,

  // Parking (only a couple of simple fields)
  "parking-space": [
    {
      key: "parkingType",
      label: "Parking Type",
      type: "select",
      required: true,
      options: [
        { value: "covered", label: "Covered" },
        { value: "open", label: "Open / Uncovered" },
        { value: "garage", label: "Garage" },
        { value: "street", label: "Street" },
      ],
      group: "Parking Details",
    },
    {
      key: "vehicleSize",
      label: "Max Vehicle Size",
      type: "select",
      options: [
        { value: "compact", label: "Compact" },
        { value: "standard", label: "Standard" },
        { value: "large", label: "Large / SUV / Truck" },
      ],
      group: "Parking Details",
    },
    {
      key: "evCharging",
      label: "EV Charging Available",
      type: "boolean",
      group: "Parking Details",
    },
  ],
};

/**
 * Look up category fields by slug. Falls back to empty array for unknown slugs.
 * Also tries partial matching (e.g. slug "camera-electronics" matches "camera").
 */
export function getCategoryFields(categorySlug: string | undefined | null): CategoryField[] {
  if (!categorySlug) return [];
  const slug = categorySlug.toLowerCase().trim();

  // Direct match
  if (CATEGORY_FIELD_MAP[slug]) return CATEGORY_FIELD_MAP[slug];

  // Prefix/partial match
  for (const key of Object.keys(CATEGORY_FIELD_MAP)) {
    if (slug.includes(key) || key.includes(slug)) {
      return CATEGORY_FIELD_MAP[key];
    }
  }

  return [];
}

/**
 * Group fields by their `group` property for rendering in sections.
 */
export function groupCategoryFields(fields: CategoryField[]): CategoryFieldGroup[] {
  const groups: Map<string, CategoryField[]> = new Map();
  for (const field of fields) {
    const group = field.group || "Details";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(field);
  }
  return Array.from(groups.entries()).map(([label, fieldList]) => ({
    label,
    fields: fieldList,
  }));
}

/**
 * Format a category-specific field value for display.
 */
export function formatFieldValue(field: CategoryField, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";

  if (field.type === "boolean") {
    return value ? "Yes" : "No";
  }

  if (field.type === "select" && field.options) {
    const option = field.options.find((o) => o.value === value);
    return option?.label || String(value);
  }

  if (field.type === "multiselect" && Array.isArray(value) && field.options) {
    return value
      .map((v) => {
        const option = field.options!.find((o) => o.value === v);
        return option?.label || String(v);
      })
      .join(", ");
  }

  if (field.type === "number" && field.unit) {
    return `${value} ${field.unit}`;
  }

  return String(value);
}
