import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_LABELS,
  LOCALE_NATIVE_LABELS,
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  CURRENCY_CONFIG,
  DEFAULT_TIMEZONE,
  PLATFORM_COUNTRY,
  PLATFORM_COUNTRY_CODE,
  PHONE_COUNTRY_CODE,
  NEPAL_LOCATIONS,
  NEPAL_TOLES,
  NEPALI_FIRST_NAMES,
  NEPALI_LAST_NAMES,
  LISTING_TITLES,
  LISTING_DESCRIPTIONS,
  LISTING_RULES,
  AMENITIES_BILINGUAL,
  VEHICLE_TYPES,
  EQUIPMENT_TYPES,
} from './nepal.config';

describe('Nepal Config', () => {
  describe('Locale', () => {
    it('supports English and Nepali', () => {
      expect(SUPPORTED_LOCALES).toContain('en');
      expect(SUPPORTED_LOCALES).toContain('ne');
      expect(SUPPORTED_LOCALES.length).toBe(2);
    });

    it('defaults to English', () => {
      expect(DEFAULT_LOCALE).toBe('en');
      expect(FALLBACK_LOCALE).toBe('en');
    });

    it('has labels for all supported locales', () => {
      for (const locale of SUPPORTED_LOCALES) {
        expect(LOCALE_LABELS[locale]).toBeDefined();
        expect(typeof LOCALE_LABELS[locale]).toBe('string');
      }
    });

    it('has native labels for all supported locales', () => {
      for (const locale of SUPPORTED_LOCALES) {
        expect(LOCALE_NATIVE_LABELS[locale]).toBeDefined();
      }
    });

    it('Nepali label is in Devanagari', () => {
      expect(LOCALE_LABELS.ne).toBe('नेपाली');
    });
  });

  describe('Currency', () => {
    it('supports NPR, USD, INR', () => {
      expect(SUPPORTED_CURRENCIES).toContain('NPR');
      expect(SUPPORTED_CURRENCIES).toContain('USD');
      expect(SUPPORTED_CURRENCIES).toContain('INR');
      expect(SUPPORTED_CURRENCIES.length).toBe(3);
    });

    it('defaults to NPR', () => {
      expect(DEFAULT_CURRENCY).toBe('NPR');
    });

    it('has config for all supported currencies', () => {
      for (const currency of SUPPORTED_CURRENCIES) {
        const config = CURRENCY_CONFIG[currency];
        expect(config).toBeDefined();
        expect(config.code).toBe(currency);
        expect(config.symbol).toBeDefined();
        expect(config.name).toBeDefined();
        expect(config.nameNe).toBeDefined();
        expect(config.decimals).toBe(2);
        expect(['before', 'after']).toContain(config.symbolPosition);
      }
    });

    it('NPR uses Rs. symbol', () => {
      expect(CURRENCY_CONFIG.NPR.symbol).toBe('Rs.');
    });

    it('USD uses $ symbol', () => {
      expect(CURRENCY_CONFIG.USD.symbol).toBe('$');
    });

    it('INR uses ₹ symbol', () => {
      expect(CURRENCY_CONFIG.INR.symbol).toBe('₹');
    });
  });

  describe('Geography', () => {
    it('timezone is Asia/Kathmandu', () => {
      expect(DEFAULT_TIMEZONE).toBe('Asia/Kathmandu');
    });

    it('country is Nepal', () => {
      expect(PLATFORM_COUNTRY).toBe('Nepal');
      expect(PLATFORM_COUNTRY_CODE).toBe('NP');
    });

    it('phone code is +977', () => {
      expect(PHONE_COUNTRY_CODE).toBe('+977');
    });
  });

  describe('Nepal Locations', () => {
    it('has at least 10 locations', () => {
      expect(NEPAL_LOCATIONS.length).toBeGreaterThanOrEqual(10);
    });

    it('includes Kathmandu', () => {
      const ktm = NEPAL_LOCATIONS.find((l) => l.city === 'Kathmandu');
      expect(ktm).toBeDefined();
      expect(ktm!.state).toBe('Bagmati Province');
      expect(ktm!.latitude).toBeCloseTo(27.7172, 1);
      expect(ktm!.longitude).toBeCloseTo(85.324, 1);
    });

    it('includes Pokhara', () => {
      const pkr = NEPAL_LOCATIONS.find((l) => l.city === 'Pokhara');
      expect(pkr).toBeDefined();
      expect(pkr!.state).toBe('Gandaki Province');
    });

    it('all locations have required fields', () => {
      for (const loc of NEPAL_LOCATIONS) {
        expect(loc.city).toBeDefined();
        expect(loc.cityNe).toBeDefined();
        expect(loc.state).toBeDefined();
        expect(loc.stateNe).toBeDefined();
        expect(typeof loc.latitude).toBe('number');
        expect(typeof loc.longitude).toBe('number');
        expect(loc.zipCode).toBeDefined();
      }
    });

    it('latitude/longitude in valid ranges for Nepal', () => {
      for (const loc of NEPAL_LOCATIONS) {
        // Nepal: lat ~26-30, lon ~80-88
        expect(loc.latitude).toBeGreaterThan(25);
        expect(loc.latitude).toBeLessThan(31);
        expect(loc.longitude).toBeGreaterThan(79);
        expect(loc.longitude).toBeLessThan(89);
      }
    });

    it('covers all 7 provinces', () => {
      const provinces = new Set(NEPAL_LOCATIONS.map((l) => l.state));
      expect(provinces.size).toBe(7);
    });
  });

  describe('Nepal Toles', () => {
    it('has at least 20 entries', () => {
      expect(NEPAL_TOLES.length).toBeGreaterThanOrEqual(20);
    });

    it('includes well-known areas', () => {
      expect(NEPAL_TOLES).toContain('Thamel');
      expect(NEPAL_TOLES).toContain('Lazimpat');
      expect(NEPAL_TOLES).toContain('Lakeside');
    });
  });

  describe('Nepali Names', () => {
    it('has first names', () => {
      expect(NEPALI_FIRST_NAMES.length).toBeGreaterThan(20);
    });

    it('has last names', () => {
      expect(NEPALI_LAST_NAMES.length).toBeGreaterThan(20);
    });

    it('all names are strings', () => {
      for (const name of [...NEPALI_FIRST_NAMES, ...NEPALI_LAST_NAMES]) {
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Listing Templates', () => {
    it('has bilingual titles for apartment, house, car, equipment', () => {
      for (const key of ['apartment', 'house', 'car', 'equipment'] as const) {
        expect(LISTING_TITLES[key].en.length).toBeGreaterThan(0);
        expect(LISTING_TITLES[key].ne.length).toBeGreaterThan(0);
      }
    });

    it('has bilingual descriptions', () => {
      for (const key of ['apartment', 'house', 'car', 'equipment'] as const) {
        expect(LISTING_DESCRIPTIONS[key].en.length).toBeGreaterThan(0);
        expect(LISTING_DESCRIPTIONS[key].ne.length).toBeGreaterThan(0);
      }
    });

    it('apartment titles contain {{area}} placeholder', () => {
      for (const title of LISTING_TITLES.apartment.en) {
        expect(title).toContain('{{area}}');
      }
    });
  });

  describe('Listing Rules', () => {
    it('has bilingual rules', () => {
      expect(LISTING_RULES.en.length).toBeGreaterThan(0);
      expect(LISTING_RULES.ne.length).toBeGreaterThan(0);
    });

    it('has same count for en and ne', () => {
      expect(LISTING_RULES.en.length).toBe(LISTING_RULES.ne.length);
    });
  });

  describe('Amenities', () => {
    it('has bilingual amenities', () => {
      expect(AMENITIES_BILINGUAL.length).toBeGreaterThan(10);
    });

    it('all amenities have en and ne', () => {
      for (const amenity of AMENITIES_BILINGUAL) {
        expect(amenity.en).toBeDefined();
        expect(amenity.ne).toBeDefined();
      }
    });

    it('includes WiFi', () => {
      expect(AMENITIES_BILINGUAL.some((a) => a.en === 'WiFi')).toBe(true);
    });
  });

  describe('Vehicle Types', () => {
    it('has at least 15 vehicles', () => {
      expect(VEHICLE_TYPES.length).toBeGreaterThanOrEqual(15);
    });

    it('all are strings', () => {
      for (const v of VEHICLE_TYPES) {
        expect(typeof v).toBe('string');
      }
    });
  });

  describe('Equipment Types', () => {
    it('has at least 10 items', () => {
      expect(EQUIPMENT_TYPES.length).toBeGreaterThanOrEqual(10);
    });

    it('all are strings', () => {
      for (const e of EQUIPMENT_TYPES) {
        expect(typeof e).toBe('string');
      }
    });
  });
});
