import { Injectable } from '@nestjs/common';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class ResponseSchemaValidator {
  private schemas: Record<string, any> = {
    UserResponse: {
      required: ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt'],
      types: {
        id: 'string',
        email: 'string',
        firstName: 'string',
        lastName: 'string',
        role: 'string',
        createdAt: 'string',
        phoneNumber: 'string',
        bio: 'string',
        avatar: 'string'
      }
    },
    UserProfile: {
      required: ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt'],
      types: {
        id: 'string',
        email: 'string',
        firstName: 'string',
        lastName: 'string',
        role: 'string',
        createdAt: 'string'
      }
    },
    Listing: {
      required: ['id', 'title', 'description', 'price', 'categoryId', 'owner', 'location', 'createdAt'],
      types: {
        id: 'string',
        title: 'string',
        description: 'string',
        price: 'number',
        categoryId: 'number',
        owner: 'object',
        location: 'object',
        createdAt: 'string'
      }
    },
    Booking: {
      required: ['id', 'listingId', 'renterId', 'ownerId', 'status', 'startDate', 'endDate', 'totalPrice', 'createdAt'],
      types: {
        id: 'string',
        listingId: 'string',
        renterId: 'string',
        ownerId: 'string',
        status: 'string',
        startDate: 'string',
        endDate: 'string',
        totalPrice: 'number',
        createdAt: 'string'
      },
      enums: {
        status: ['pending', 'confirmed', 'cancelled', 'completed'],
        paymentMethod: ['cash', 'card', 'bank_transfer', 'digital_wallet']
      }
    },
    BookingResponse: {
      required: ['id', 'listingId', 'renterId', 'ownerId', 'status', 'startDate', 'endDate', 'totalPrice'],
      types: {
        id: 'string',
        listingId: 'string',
        renterId: 'string',
        ownerId: 'string',
        status: 'string',
        startDate: 'string',
        endDate: 'string',
        totalPrice: 'number',
        paymentMethod: 'string'
      },
      enums: {
        status: ['pending', 'confirmed', 'cancelled', 'completed'],
        paymentMethod: ['cash', 'card', 'bank_transfer', 'digital_wallet']
      }
    },
    PaymentResponse: {
      required: ['id', 'bookingId', 'amount', 'currency', 'status', 'paymentMethod', 'createdAt'],
      types: {
        id: 'string',
        bookingId: 'string',
        amount: 'number',
        currency: 'string',
        status: 'string',
        paymentMethod: 'string',
        createdAt: 'string'
      }
    },
    MessageResponse: {
      required: ['id', 'senderId', 'recipientId', 'content', 'timestamp', 'read'],
      types: {
        id: 'string',
        senderId: 'string',
        recipientId: 'string',
        content: 'string',
        timestamp: 'string',
        read: 'boolean'
      }
    }
  };

  async getConfig(): Promise<any> {
    return {
      strictMode: true,
      stripUnknown: true,
      abortEarly: false,
      coerceTypes: true,
      removeAdditional: true
    };
  }

  async validate(schemaName: string, data: any): Promise<ValidationResult> {
    const schema = this.schemas[schemaName];

    if (!schema) {
      return {
        isValid: false,
        errors: [`Schema '${schemaName}' not found`]
      };
    }

    const errors: string[] = [];

    // Check required fields
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Check types
    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (data[field] !== undefined && data[field] !== null) {
        const actualType = Array.isArray(data[field]) ? 'array' : typeof data[field];
        if (actualType !== expectedType && expectedType !== 'array') {
          errors.push(`Field '${field}' should be of type ${expectedType}, got ${actualType}`);
        }
      }
    }

    // Check enums
    if (schema.enums) {
      for (const [field, allowedValues] of Object.entries(schema.enums)) {
        if (data[field] !== undefined && Array.isArray(allowedValues)) {
          if (!(allowedValues as string[]).includes(data[field])) {
            errors.push(`Field '${field}' has invalid value '${data[field]}'. Allowed values: ${(allowedValues as string[]).join(', ')}`);
          }
        }
      }
    }

    // Additional validations for UserResponse schema
    if (schemaName === 'UserResponse') {
      // Email format validation
      if (data.email !== undefined && data.email !== null) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
          errors.push(`Invalid email format: ${data.email}`);
        }
      }

      // Role validation
      if (data.role !== undefined && data.role !== null) {
        const validRoles = ['user', 'admin', 'owner', 'renter'];
        if (!validRoles.includes(data.role)) {
          errors.push(`Invalid role value: ${data.role}. Role must be one of: ${validRoles.join(', ')}`);
        }
      }

      // Date format validation for createdAt
      if (data.createdAt !== undefined && data.createdAt !== null) {
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
        if (!isoDateRegex.test(data.createdAt)) {
          errors.push(`Invalid createdAt date format: ${data.createdAt}. Expected ISO 8601 format.`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
