import { Injectable } from '@nestjs/common';

// Define template schemas for each category
export const CATEGORY_TEMPLATES = {
  spaces: {
    type: 'object',
    properties: {
      spaceType: {
        type: 'string',
        enum: ['house', 'apartment', 'room', 'office', 'warehouse', 'event_space', 'parking'],
        required: true,
      },
      size: {
        type: 'number',
        description: 'Size in square feet',
        required: true,
      },
      bedrooms: { type: 'number', minimum: 0 },
      bathrooms: { type: 'number', minimum: 0 },
      maxOccupancy: { type: 'number', minimum: 1, required: true },
      furnished: { type: 'boolean' },
      amenities: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'wifi',
            'parking',
            'kitchen',
            'air_conditioning',
            'heating',
            'washer',
            'dryer',
            'tv',
            'gym',
            'pool',
            'elevator',
            'wheelchair_accessible',
          ],
        },
      },
      flooring: {
        type: 'string',
        enum: ['hardwood', 'carpet', 'tile', 'concrete', 'vinyl'],
      },
      petsAllowed: { type: 'boolean' },
      smokingAllowed: { type: 'boolean' },
    },
  },

  vehicles: {
    type: 'object',
    properties: {
      vehicleType: {
        type: 'string',
        enum: ['car', 'truck', 'suv', 'van', 'motorcycle', 'rv', 'boat', 'bicycle', 'scooter'],
        required: true,
      },
      make: { type: 'string', required: true },
      model: { type: 'string', required: true },
      year: { type: 'number', minimum: 1900, maximum: 2030, required: true },
      color: { type: 'string' },
      licensePlate: { type: 'string' },
      vin: { type: 'string' },
      mileage: { type: 'number', minimum: 0 },
      transmission: {
        type: 'string',
        enum: ['automatic', 'manual'],
        required: true,
      },
      fuelType: {
        type: 'string',
        enum: ['gasoline', 'diesel', 'electric', 'hybrid', 'other'],
        required: true,
      },
      seatingCapacity: { type: 'number', minimum: 1, required: true },
      features: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'gps',
            'bluetooth',
            'backup_camera',
            'sunroof',
            'leather_seats',
            'heated_seats',
            'apple_carplay',
            'android_auto',
            'cruise_control',
            'parking_sensors',
          ],
        },
      },
      insuranceCoverage: { type: 'string' },
      registrationExpiry: { type: 'string', format: 'date' },
    },
  },

  instruments: {
    type: 'object',
    properties: {
      instrumentType: {
        type: 'string',
        enum: ['guitar', 'piano', 'drums', 'violin', 'saxophone', 'trumpet', 'keyboard', 'other'],
        required: true,
      },
      brand: { type: 'string', required: true },
      model: { type: 'string' },
      serialNumber: { type: 'string' },
      condition: {
        type: 'string',
        enum: ['new', 'excellent', 'good', 'fair'],
        required: true,
      },
      yearManufactured: { type: 'number', minimum: 1800, maximum: 2030 },
      includesCase: { type: 'boolean' },
      includesAccessories: { type: 'boolean' },
      accessoriesDescription: { type: 'string' },
      tuningRequired: { type: 'boolean' },
      electricOrAcoustic: {
        type: 'string',
        enum: ['electric', 'acoustic', 'both', 'na'],
      },
    },
  },

  event_venues: {
    type: 'object',
    properties: {
      venueType: {
        type: 'string',
        enum: ['banquet_hall', 'conference_room', 'outdoor_space', 'theater', 'gallery', 'studio'],
        required: true,
      },
      capacity: { type: 'number', minimum: 1, required: true },
      indoorOutdoor: {
        type: 'string',
        enum: ['indoor', 'outdoor', 'both'],
        required: true,
      },
      squareFootage: { type: 'number', minimum: 0, required: true },
      ceilingHeight: { type: 'number', minimum: 0 },
      stageAvailable: { type: 'boolean' },
      avEquipment: { type: 'boolean' },
      catering: {
        type: 'string',
        enum: ['in_house', 'external_allowed', 'none'],
      },
      alcohol: {
        type: 'string',
        enum: ['allowed', 'not_allowed', 'license_required'],
      },
      parking: {
        type: 'object',
        properties: {
          available: { type: 'boolean' },
          spaces: { type: 'number' },
          type: { type: 'string', enum: ['free', 'paid', 'street'] },
        },
      },
      setupTime: { type: 'number', description: 'Hours before event' },
      cleanupTime: { type: 'number', description: 'Hours after event' },
    },
  },

  event_items: {
    type: 'object',
    properties: {
      itemType: {
        type: 'string',
        enum: [
          'tent',
          'tables',
          'chairs',
          'linens',
          'decorations',
          'lighting',
          'sound_system',
          'projector',
          'catering_equipment',
          'inflatables',
          'other',
        ],
        required: true,
      },
      brand: { type: 'string' },
      model: { type: 'string' },
      quantity: { type: 'number', minimum: 1, required: true },
      dimensions: {
        type: 'object',
        properties: {
          length: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          unit: { type: 'string', enum: ['inches', 'feet', 'meters'] },
        },
      },
      weight: { type: 'number', description: 'Weight per unit' },
      color: { type: 'string' },
      material: { type: 'string' },
      powerRequired: { type: 'boolean' },
      setupRequired: { type: 'boolean' },
      setupTimeMinutes: { type: 'number' },
      deliveryAvailable: { type: 'boolean' },
      deliveryFee: { type: 'number' },
    },
  },

  wearables: {
    type: 'object',
    properties: {
      wearableType: {
        type: 'string',
        enum: [
          'suit',
          'dress',
          'tuxedo',
          'costume',
          'jewelry',
          'watch',
          'handbag',
          'shoes',
          'accessories',
        ],
        required: true,
      },
      brand: { type: 'string' },
      designer: { type: 'string' },
      size: {
        type: 'object',
        properties: {
          numerical: { type: 'string' },
          standard: { type: 'string', enum: ['xs', 's', 'm', 'l', 'xl', 'xxl'] },
          measurements: {
            type: 'object',
            properties: {
              chest: { type: 'number' },
              waist: { type: 'number' },
              hips: { type: 'number' },
              inseam: { type: 'number' },
              unit: { type: 'string', enum: ['inches', 'cm'] },
            },
          },
        },
        required: true,
      },
      color: { type: 'string', required: true },
      material: { type: 'string' },
      condition: {
        type: 'string',
        enum: ['new_with_tags', 'new_without_tags', 'excellent', 'good'],
        required: true,
      },
      season: {
        type: 'string',
        enum: ['spring', 'summer', 'fall', 'winter', 'all_season'],
      },
      occasion: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['wedding', 'formal', 'casual', 'business', 'party', 'costume', 'other'],
        },
      },
      alterationsAllowed: { type: 'boolean' },
      cleaningIncluded: { type: 'boolean' },
      insuranceValue: { type: 'number' },
    },
  },
};

@Injectable()
export class CategoryTemplateService {
  getTemplate(categorySlug: string): Record<string, any> | null {
    return CATEGORY_TEMPLATES[categorySlug as keyof typeof CATEGORY_TEMPLATES] || null;
  }

  validateData(
    categorySlug: string,
    data: Record<string, any>,
  ): {
    isValid: boolean;
    errors: string[];
  } {
    const template = this.getTemplate(categorySlug);

    if (!template) {
      return {
        isValid: false,
        errors: [`No template found for category: ${categorySlug}`],
      };
    }

    const errors: string[] = [];

    // Check required fields
    if (template.properties) {
      for (const [fieldName, fieldSchema] of Object.entries(template.properties)) {
        const schema = fieldSchema as any;

        if (schema.required && !data[fieldName]) {
          errors.push(`Field '${fieldName}' is required`);
        }

        // Type validation
        if (data[fieldName] !== undefined) {
          if (schema.type === 'number' && typeof data[fieldName] !== 'number') {
            errors.push(`Field '${fieldName}' must be a number`);
          }

          if (schema.type === 'string' && typeof data[fieldName] !== 'string') {
            errors.push(`Field '${fieldName}' must be a string`);
          }

          if (schema.type === 'boolean' && typeof data[fieldName] !== 'boolean') {
            errors.push(`Field '${fieldName}' must be a boolean`);
          }

          // Enum validation
          if (schema.enum && !schema.enum.includes(data[fieldName])) {
            errors.push(`Field '${fieldName}' must be one of: ${schema.enum.join(', ')}`);
          }

          // Min/max validation for numbers
          if (schema.type === 'number') {
            if (schema.minimum !== undefined && data[fieldName] < schema.minimum) {
              errors.push(`Field '${fieldName}' must be at least ${schema.minimum}`);
            }

            if (schema.maximum !== undefined && data[fieldName] > schema.maximum) {
              errors.push(`Field '${fieldName}' must be at most ${schema.maximum}`);
            }
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  getSearchableFields(categorySlug: string): string[] {
    const template = this.getTemplate(categorySlug);
    if (!template || !template.properties) return [];

    // Return fields that are strings or enums (good for searching)
    const searchableFields: string[] = [];

    for (const [fieldName, fieldSchema] of Object.entries(template.properties)) {
      const schema = fieldSchema as any;
      if (schema.type === 'string' || schema.enum) {
        searchableFields.push(fieldName);
      }
    }

    return searchableFields;
  }

  getDefaultValues(categorySlug: string): Record<string, any> {
    const template = this.getTemplate(categorySlug);
    if (!template || !template.properties) return {};

    const defaults: Record<string, any> = {};

    for (const [fieldName, fieldSchema] of Object.entries(template.properties)) {
      const schema = fieldSchema as any;
      if (schema.default !== undefined) {
        defaults[fieldName] = schema.default;
      }
    }

    return defaults;
  }

  getAllCategoryTemplates(): Record<string, Record<string, any>> {
    return CATEGORY_TEMPLATES;
  }
}
