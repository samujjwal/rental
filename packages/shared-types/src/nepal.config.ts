/**
 * Nepal-specific configuration — DEPRECATED.
 *
 * All Nepal-specific seed data has been migrated to:
 *   `packages/database/prisma/seed/nepal-seed.ts`
 *
 * This file only re-exports the global platform.config.ts helpers for
 * backward compatibility. New code should import from `platform.config.ts`
 * or directly from the database.
 *
 * @deprecated Import from `platform.config.ts` or use DB-driven CountryConfig.
 */

// ─── Supported Languages ─────────────────────────────────────────────────────

/** @deprecated Use `getSupportedLocales()` from platform.config.ts */
export const SUPPORTED_LOCALES = ['en', 'ne'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const FALLBACK_LOCALE: SupportedLocale = 'en';

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  ne: 'नेपाली',
};

/** Native script display names */
export const LOCALE_NATIVE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  ne: 'नेपाली',
};

// ─── Currency ────────────────────────────────────────────────────────────────

export const SUPPORTED_CURRENCIES = ['NPR', 'USD', 'INR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: SupportedCurrency = 'NPR';

export const CURRENCY_CONFIG: Record<
  SupportedCurrency,
  {
    code: string;
    symbol: string;
    /** Nepali script symbol (optional) */
    symbolNe?: string;
    name: string;
    nameNe: string;
    decimals: number;
    symbolPosition: 'before' | 'after';
  }
> = {
  NPR: {
    code: 'NPR',
    symbol: 'Rs.',
    /** Nepali script symbol (for ne locale): रु */
    symbolNe: 'रु',
    name: 'Nepalese Rupee',
    nameNe: 'नेपाली रुपैयाँ',
    decimals: 2,
    symbolPosition: 'before',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    nameNe: 'अमेरिकी डलर',
    decimals: 2,
    symbolPosition: 'before',
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    nameNe: 'भारतीय रुपैयाँ',
    decimals: 2,
    symbolPosition: 'before',
  },
};

// ─── Currency Helpers ────────────────────────────────────────────────────────

/**
 * Intl locale to use when formatting each currency via `Intl.NumberFormat`.
 * This controls grouping separators and symbol placement.
 */
export const CURRENCY_INTL_LOCALE: Record<SupportedCurrency, string> = {
  NPR: 'en-IN', // Indian-style grouping 1,50,000 — closest match for Nepal
  USD: 'en-US',
  INR: 'en-IN',
};

/**
 * Format an amount as a currency string using `Intl.NumberFormat`.
 * Works in Node, browsers, and React Native.
 *
 * @param amount  - numeric value
 * @param currency - ISO 4217 code (default: platform default currency)
 * @returns formatted string, e.g. "NPR 1,500" or "$25.00"
 */
export function formatCurrency(
  amount: number | undefined | null,
  currency?: string,
): string {
  if (amount == null || Number.isNaN(amount)) return '';
  const code = (currency ?? DEFAULT_CURRENCY) as SupportedCurrency;
  const locale = CURRENCY_INTL_LOCALE[code] ?? CURRENCY_INTL_LOCALE[DEFAULT_CURRENCY];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: CURRENCY_CONFIG[code]?.decimals ?? 2,
  }).format(amount);
}

/**
 * Return just the symbol for a given currency code.
 */
export function getCurrencySymbol(currency?: string): string {
  const code = (currency ?? DEFAULT_CURRENCY) as SupportedCurrency;
  return CURRENCY_CONFIG[code]?.symbol ?? CURRENCY_CONFIG[DEFAULT_CURRENCY].symbol;
}

// ─── Timezone ────────────────────────────────────────────────────────────────

export const DEFAULT_TIMEZONE = 'Asia/Kathmandu';

// ─── Country ─────────────────────────────────────────────────────────────────

export const PLATFORM_COUNTRY = 'Nepal';
export const PLATFORM_COUNTRY_CODE = 'NP';
export const PHONE_COUNTRY_CODE = '+977';
export const PHONE_PLACEHOLDER = '+977 9812345678';

// ─── Map Defaults ────────────────────────────────────────────────────────────

/** Default map center: Kathmandu */
export const DEFAULT_MAP_CENTER: [number, number] = [27.7172, 85.324];

// ─── Nepal Locations ─────────────────────────────────────────────────────────

export interface NepalLocation {
  city: string;
  cityNe: string;
  state: string; // Province
  stateNe: string;
  latitude: number;
  longitude: number;
  /** Typical zip/postal code format */
  zipCode: string;
}

/**
 * Major cities and towns in Nepal grouped by province.
 * Coordinates are city-center approximations.
 */
export const NEPAL_LOCATIONS: NepalLocation[] = [
  // ─── Bagmati Province (Province 3) ──────────
  {
    city: 'Kathmandu',
    cityNe: 'काठमाडौँ',
    state: 'Bagmati Province',
    stateNe: 'बागमती प्रदेश',
    latitude: 27.7172,
    longitude: 85.324,
    zipCode: '44600',
  },
  {
    city: 'Lalitpur',
    cityNe: 'ललितपुर',
    state: 'Bagmati Province',
    stateNe: 'बागमती प्रदेश',
    latitude: 27.6588,
    longitude: 85.3247,
    zipCode: '44700',
  },
  {
    city: 'Bhaktapur',
    cityNe: 'भक्तपुर',
    state: 'Bagmati Province',
    stateNe: 'बागमती प्रदेश',
    latitude: 27.672,
    longitude: 85.4298,
    zipCode: '44800',
  },
  {
    city: 'Kirtipur',
    cityNe: 'कीर्तिपुर',
    state: 'Bagmati Province',
    stateNe: 'बागमती प्रदेश',
    latitude: 27.6783,
    longitude: 85.2775,
    zipCode: '44618',
  },
  {
    city: 'Hetauda',
    cityNe: 'हेटौँडा',
    state: 'Bagmati Province',
    stateNe: 'बागमती प्रदेश',
    latitude: 27.4288,
    longitude: 85.032,
    zipCode: '44107',
  },
  // ─── Gandaki Province (Province 4) ──────────
  {
    city: 'Pokhara',
    cityNe: 'पोखरा',
    state: 'Gandaki Province',
    stateNe: 'गण्डकी प्रदेश',
    latitude: 28.2096,
    longitude: 83.9856,
    zipCode: '33700',
  },
  {
    city: 'Gorkha',
    cityNe: 'गोरखा',
    state: 'Gandaki Province',
    stateNe: 'गण्डकी प्रदेश',
    latitude: 28.003,
    longitude: 84.6287,
    zipCode: '36400',
  },
  // ─── Lumbini Province (Province 5) ──────────
  {
    city: 'Butwal',
    cityNe: 'बुटवल',
    state: 'Lumbini Province',
    stateNe: 'लुम्बिनी प्रदेश',
    latitude: 27.7006,
    longitude: 83.4483,
    zipCode: '32907',
  },
  {
    city: 'Siddharthanagar',
    cityNe: 'सिद्धार्थनगर',
    state: 'Lumbini Province',
    stateNe: 'लुम्बिनी प्रदेश',
    latitude: 27.5044,
    longitude: 83.4498,
    zipCode: '32900',
  },
  {
    city: 'Nepalgunj',
    cityNe: 'नेपालगञ्ज',
    state: 'Lumbini Province',
    stateNe: 'लुम्बिनी प्रदेश',
    latitude: 28.05,
    longitude: 81.6167,
    zipCode: '21900',
  },
  // ─── Province 1 (Koshi) ─────────────────────
  {
    city: 'Biratnagar',
    cityNe: 'विराटनगर',
    state: 'Koshi Province',
    stateNe: 'कोशी प्रदेश',
    latitude: 26.4525,
    longitude: 87.2718,
    zipCode: '56613',
  },
  {
    city: 'Dharan',
    cityNe: 'धरान',
    state: 'Koshi Province',
    stateNe: 'कोशी प्रदेश',
    latitude: 26.8125,
    longitude: 87.2836,
    zipCode: '56700',
  },
  {
    city: 'Itahari',
    cityNe: 'इटहरी',
    state: 'Koshi Province',
    stateNe: 'कोशी प्रदेश',
    latitude: 26.6667,
    longitude: 87.2833,
    zipCode: '56705',
  },
  // ─── Province 2 (Madhesh) ───────────────────
  {
    city: 'Janakpur',
    cityNe: 'जनकपुर',
    state: 'Madhesh Province',
    stateNe: 'मधेश प्रदेश',
    latitude: 26.7271,
    longitude: 85.9407,
    zipCode: '45600',
  },
  {
    city: 'Birgunj',
    cityNe: 'वीरगञ्ज',
    state: 'Madhesh Province',
    stateNe: 'मधेश प्रदेश',
    latitude: 27.0104,
    longitude: 84.8778,
    zipCode: '44300',
  },
  // ─── Karnali Province (Province 6) ──────────
  {
    city: 'Surkhet',
    cityNe: 'सुर्खेत',
    state: 'Karnali Province',
    stateNe: 'कर्णाली प्रदेश',
    latitude: 28.6047,
    longitude: 81.636,
    zipCode: '21700',
  },
  // ─── Sudurpashchim Province (Province 7) ────
  {
    city: 'Dhangadhi',
    cityNe: 'धनगढी',
    state: 'Sudurpashchim Province',
    stateNe: 'सुदूरपश्चिम प्रदेश',
    latitude: 28.6833,
    longitude: 80.6,
    zipCode: '10900',
  },
  {
    city: 'Mahendranagar',
    cityNe: 'महेन्द्रनगर',
    state: 'Sudurpashchim Province',
    stateNe: 'सुदूरपश्चिम प्रदेश',
    latitude: 28.9667,
    longitude: 80.35,
    zipCode: '10400',
  },
];

// ─── Nepali Address Helpers ──────────────────────────────────────────────────

/** Common ward / tole patterns for realistic Nepali addresses */
export const NEPAL_TOLES = [
  'Thamel',
  'Lazimpat',
  'Durbar Marg',
  'New Baneshwor',
  'Baluwatar',
  'Maharajgunj',
  'Bouddha',
  'Chabahil',
  'Jawalakhel',
  'Kupondole',
  'Pulchowk',
  'Mangalbazar',
  'Sukedhara',
  'Basundhara',
  'Budhanilkantha',
  'Gairidhara',
  'Naxal',
  'Kalanki',
  'Swayambhu',
  'Patan Dhoka',
  'Lakeside',
  'Bagar',
  'Nadipur',
  'Chipledhunga',
  'Prithvi Chowk',
  'Mahendrapul',
  'Siddha Pokhari',
  'Taumadhi',
  'Dattatreya',
  'Byasi',
];

/** Common Nepali first names (male and female) */
export const NEPALI_FIRST_NAMES = [
  'Aarav',
  'Aayush',
  'Bibek',
  'Bishal',
  'Deepak',
  'Dipesh',
  'Ganesh',
  'Hari',
  'Kiran',
  'Krishna',
  'Manish',
  'Nabin',
  'Prakash',
  'Pramod',
  'Rajesh',
  'Roshan',
  'Sagar',
  'Sandip',
  'Santosh',
  'Sunil',
  'Anita',
  'Asha',
  'Binita',
  'Gita',
  'Kamala',
  'Laxmi',
  'Maya',
  'Nirmala',
  'Puja',
  'Radha',
  'Rashmi',
  'Rita',
  'Sabina',
  'Sita',
  'Sunita',
  'Sushma',
  'Sarita',
  'Usha',
  'Yamuna',
  'Samjhana',
];

/** Common Nepali last names */
export const NEPALI_LAST_NAMES = [
  'Adhikari',
  'Acharya',
  'Basnet',
  'Bhandari',
  'Bhattarai',
  'Chaudhary',
  'Dahal',
  'Devkota',
  'Ghimire',
  'Gurung',
  'Joshi',
  'Karki',
  'Koirala',
  'Lama',
  'Maharjan',
  'Magar',
  'Neupane',
  'Pandey',
  'Poudel',
  'Rai',
  'Regmi',
  'Sapkota',
  'Shah',
  'Sharma',
  'Shrestha',
  'Subedi',
  'Tamang',
  'Thapa',
  'Tiwari',
  'Upreti',
];

// ─── Nepali Listing Templates ────────────────────────────────────────────────

/** Bilingual listing title templates.  `{{area}}` is replaced with tole/area name */
export const LISTING_TITLES = {
  apartment: {
    en: [
      'Modern Apartment in {{area}}',
      'Spacious Flat near {{area}}',
      'Cozy Apartment at {{area}}',
      'Furnished Apartment in {{area}}',
      'Premium 2BHK in {{area}}',
      'Sunny Apartment with Balcony – {{area}}',
    ],
    ne: [
      '{{area}}मा आधुनिक अपार्टमेन्ट',
      '{{area}} नजिकको फराकिलो फ्ल्याट',
      '{{area}}मा सुविधा सम्पन्न अपार्टमेन्ट',
      '{{area}}को फर्निस्ड अपार्टमेन्ट',
      '{{area}}मा प्रिमियम २बीएचके',
      'बालकनी सहितको अपार्टमेन्ट – {{area}}',
    ],
  },
  house: {
    en: [
      'Entire House in {{area}}',
      'Family Home near {{area}}',
      'Traditional Nepali House – {{area}}',
      'New House with Garden – {{area}}',
      'Quiet House in {{area}}',
    ],
    ne: [
      '{{area}}मा पूरा घर',
      '{{area}} नजिकको पारिवारिक घर',
      'परम्परागत नेपाली घर – {{area}}',
      'बगैँचा सहितको नयाँ घर – {{area}}',
      '{{area}}मा शान्त घर',
    ],
  },
  car: {
    en: [
      'Reliable {{descriptor}} for Rent',
      '{{descriptor}} Available – Daily / Weekly',
      'Well-Maintained {{descriptor}}',
      'Self-Drive {{descriptor}} Rental',
    ],
    ne: [
      'भाडामा {{descriptor}}',
      '{{descriptor}} उपलब्ध – दैनिक / साप्ताहिक',
      'राम्रोसँग मर्मत गरिएको {{descriptor}}',
      'सेल्फ-ड्राइभ {{descriptor}} भाडामा',
    ],
  },
  equipment: {
    en: [
      'Professional {{descriptor}} for Rent',
      '{{descriptor}} – Available Now',
      'High-Quality {{descriptor}}',
    ],
    ne: [
      'भाडामा प्रोफेशनल {{descriptor}}',
      '{{descriptor}} – अहिले उपलब्ध',
      'उच्च गुणस्तरको {{descriptor}}',
    ],
  },
};

/** Bilingual listing descriptions */
export const LISTING_DESCRIPTIONS = {
  apartment: {
    en: 'This well-maintained apartment is ideally located for both short and long stays. It features a fully equipped kitchen, clean bathrooms, reliable WiFi, and 24-hour water supply. The building offers parking and is close to shops, restaurants, and public transport.',
    ne: 'यो राम्रोसँग मर्मत गरिएको अपार्टमेन्ट छोटो र लामो दुवै बसाइका लागि उपयुक्त छ। यसमा पूर्ण सुसज्जित भान्सा, सफा बाथरुम, भरपर्दो वाइफाइ, र २४ घण्टा पानीको सुविधा छ। भवनमा पार्किङ छ र पसल, रेस्टुरेन्ट र सार्वजनिक यातायातको नजिक छ।',
  },
  house: {
    en: 'Beautiful house with traditional Nepali architecture and modern comforts. Enjoy a peaceful garden, rooftop terrace with mountain views, spacious rooms, and a warm family atmosphere. Perfect for families or groups visiting Nepal.',
    ne: 'परम्परागत नेपाली वास्तुकला र आधुनिक सुविधाहरू भएको सुन्दर घर। शान्त बगैँचा, हिमालको दृश्य सहितको छतमा छत, फराकिलो कोठाहरू, र न्यानो पारिवारिक वातावरणको आनन्द लिनुहोस्। नेपाल भ्रमणमा आउने परिवार वा समूहहरूका लागि उपयुक्त।',
  },
  car: {
    en: 'Well-maintained vehicle available for self-drive or with driver. Ideal for city commuting, valley tours, or highway trips. Clean interior, regularly serviced, with full insurance coverage.',
    ne: 'सेल्फ-ड्राइभ वा चालक सहित उपलब्ध राम्रोसँग मर्मत गरिएको सवारी साधन। शहर यातायात, उपत्यका भ्रमण, वा राजमार्ग यात्राका लागि आदर्श। सफा भित्री भाग, नियमित सर्भिस, पूर्ण बिमा सहित।',
  },
  equipment: {
    en: 'Professional-grade equipment available for daily or weekly rental. Kept in excellent condition with all accessories included. Pickup from our location or delivery available within Kathmandu Valley.',
    ne: 'दैनिक वा साप्ताहिक भाडामा उपलब्ध प्रोफेशनल-ग्रेड उपकरण। सबै सामानहरू सहित उत्कृष्ट अवस्थामा राखिएको। काठमाडौँ उपत्यकाभित्र हाम्रो स्थानबाट पिकअप वा डेलिभरी उपलब्ध।',
  },
};

/** Common house rules in both languages */
export const LISTING_RULES = {
  en: [
    'No smoking inside the premises',
    'No parties or events without prior approval',
    'Quiet hours from 10 PM to 7 AM',
    'Shoes off inside the house',
    'No illegal activities',
    'Respect the neighbors',
    'Do not waste water',
    'Return keys at checkout',
    'Pets allowed with prior approval only',
    'Garbage must be sorted (recyclable / organic)',
  ],
  ne: [
    'भवन भित्र धुम्रपान निषेध',
    'पूर्व अनुमति बिना पार्टी वा कार्यक्रम निषेध',
    'राति १० बजेदेखि बिहान ७ बजेसम्म शान्त समय',
    'घर भित्र जुत्ता खोल्नुहोस्',
    'गैरकानुनी गतिविधि निषेध',
    'छिमेकीहरूलाई सम्मान गर्नुहोस्',
    'पानी बर्बाद नगर्नुहोस्',
    'चेकआउटमा चाबी फिर्ता गर्नुहोस्',
    'पूर्व अनुमतिमा मात्र पाल्तु जनावर',
    'फोहोर छुट्ट्याउनुहोस् (पुन: प्रयोग योग्य / जैविक)',
  ],
};

/** Common amenities in both languages */
export const AMENITIES_BILINGUAL: Array<{ en: string; ne: string }> = [
  { en: 'WiFi', ne: 'वाइफाइ' },
  { en: 'Hot Water', ne: 'तातो पानी' },
  { en: 'Kitchen', ne: 'भान्सा' },
  { en: 'Parking', ne: 'पार्किङ' },
  { en: 'AC', ne: 'एसी' },
  { en: 'Washing Machine', ne: 'धुने मेसिन' },
  { en: 'TV', ne: 'टिभी' },
  { en: 'Elevator', ne: 'लिफ्ट' },
  { en: 'Rooftop Terrace', ne: 'छतको छत' },
  { en: 'Garden', ne: 'बगैँचा' },
  { en: 'CCTV Security', ne: 'सीसीटीभी सुरक्षा' },
  { en: '24-Hour Water Supply', ne: '२४ घण्टा पानी' },
  { en: 'Backup Power / Inverter', ne: 'ब्याकअप पावर / इन्भर्टर' },
  { en: 'Solar Water Heater', ne: 'सोलार वाटर हिटर' },
  { en: 'Mountain View', ne: 'हिमालको दृश्य' },
  { en: 'Balcony', ne: 'बालकनी' },
  { en: 'Furnished', ne: 'फर्निस्ड' },
  { en: 'Pet Friendly', ne: 'पाल्तु जनावर मैत्री' },
];

/** Nepal-specific vehicle types for car rental category */
export const VEHICLE_TYPES = [
  'Suzuki Alto',
  'Hyundai i10',
  'Hyundai i20',
  'Toyota Aqua',
  'Suzuki Swift',
  'Kia Seltos',
  'Hyundai Creta',
  'Toyota Hilux',
  'Mahindra Scorpio',
  'Tata Nexon',
  'Honda CRV',
  'Toyota Land Cruiser',
  'Suzuki Dzire',
  'Tata Tiago',
  'Royal Enfield Classic 350',
  'Honda Shine',
  'Yamaha FZ',
  'Hero Splendor',
  'TVS Apache',
  'Bajaj Pulsar',
];

/** Equipment types commonly rented in Nepal */
export const EQUIPMENT_TYPES = [
  'DSLR Camera',
  'Drone (DJI)',
  'Projector',
  'Sound System / Speaker',
  'Generator',
  'Trekking Gear Set',
  'Camping Tent (4-person)',
  'Mountain Bike',
  'Construction Power Tools',
  'Portable WiFi Device',
  'Wedding Decoration Set',
  'Mandap / Stage Setup',
  'LED Screen',
  'Photo Booth',
  'DJ Equipment',
];
