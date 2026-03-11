import { CategoryTemplateService, CATEGORY_TEMPLATES } from './category-template.service';

describe('CategoryTemplateService', () => {
  let service: CategoryTemplateService;

  beforeEach(() => {
    service = new CategoryTemplateService();
  });

  describe('getTemplate', () => {
    it('should return a template for a valid category slug', () => {
      const template = service.getTemplate('vehicles');

      expect(template).toBeDefined();
      expect(template!.type).toBe('object');
      expect(template!.properties.make).toBeDefined();
    });

    it('should return null for an unknown category slug', () => {
      const template = service.getTemplate('non_existent');

      expect(template).toBeNull();
    });

    it('should have a template for all expected categories', () => {
      const expected = ['spaces', 'vehicles', 'instruments', 'event_venues', 'event_items', 'wearables'];
      expected.forEach((slug) => {
        expect(service.getTemplate(slug)).not.toBeNull();
      });
    });
  });

  describe('validateData', () => {
    it('should validate correct vehicle data', () => {
      const result = service.validateData('vehicles', {
        vehicleType: 'car',
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        transmission: 'automatic',
        fuelType: 'gasoline',
        seatingCapacity: 5,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', () => {
      const result = service.validateData('vehicles', {
        vehicleType: 'car',
        // missing make, model, year, etc.
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('make'))).toBe(true);
    });

    it('should validate enum values', () => {
      const result = service.validateData('vehicles', {
        vehicleType: 'spaceship', // not in enum
        make: 'SpaceX',
        model: 'Starship',
        year: 2025,
        transmission: 'warp_drive', // not in enum
        fuelType: 'gasoline',
        seatingCapacity: 5,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('vehicleType'))).toBe(true);
      expect(result.errors.some((e) => e.includes('transmission'))).toBe(true);
    });

    it('should validate number type constraints', () => {
      const result = service.validateData('vehicles', {
        vehicleType: 'car',
        make: 'Toyota',
        model: 'Corolla',
        year: 'not_a_number', // wrong type
        transmission: 'automatic',
        fuelType: 'gasoline',
        seatingCapacity: 5,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('year') && e.includes('number'))).toBe(true);
    });

    it('should validate min/max for numbers', () => {
      const result = service.validateData('vehicles', {
        vehicleType: 'car',
        make: 'Toyota',
        model: 'Corolla',
        year: 1800, // below minimum of 1900
        transmission: 'automatic',
        fuelType: 'gasoline',
        seatingCapacity: 5,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('year') && e.includes('1900'))).toBe(true);
    });

    it('should return error for unknown category', () => {
      const result = service.validateData('unknown_category', { foo: 'bar' });

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('No template found');
    });
  });

  describe('getSearchableFields', () => {
    it('should return string/enum fields for a valid category', () => {
      const fields = service.getSearchableFields('vehicles');

      expect(fields).toContain('vehicleType');
      expect(fields).toContain('make');
      expect(fields).toContain('model');
      expect(fields).toContain('transmission');
      expect(fields).toContain('fuelType');
    });

    it('should not include number-only fields', () => {
      const fields = service.getSearchableFields('vehicles');

      // year is type:number without enum → should not be included
      expect(fields).not.toContain('mileage');
    });

    it('should return empty array for unknown category', () => {
      const fields = service.getSearchableFields('nonexistent');

      expect(fields).toEqual([]);
    });
  });

  describe('getDefaultValues', () => {
    it('should return empty object when no defaults defined', () => {
      const defaults = service.getDefaultValues('vehicles');

      // The vehicle template has no default values
      expect(defaults).toEqual({});
    });

    it('should return empty object for unknown category', () => {
      const defaults = service.getDefaultValues('nonexistent');

      expect(defaults).toEqual({});
    });
  });

  describe('getAllCategoryTemplates', () => {
    it('should return all templates', () => {
      const all = service.getAllCategoryTemplates();

      expect(Object.keys(all)).toContain('spaces');
      expect(Object.keys(all)).toContain('vehicles');
      expect(Object.keys(all)).toContain('instruments');
      expect(Object.keys(all)).toContain('event_venues');
      expect(Object.keys(all)).toContain('event_items');
      expect(Object.keys(all)).toContain('wearables');
    });

    it('should return the same reference as CATEGORY_TEMPLATES', () => {
      const all = service.getAllCategoryTemplates();
      expect(all).toBe(CATEGORY_TEMPLATES);
    });
  });
});
