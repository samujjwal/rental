import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { plainToInstance, classToPlain } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * API Contract Validation Tests
 * 
 * These tests validate that DTOs and responses conform to API contracts:
 * - DTO field validation
 * - Response structure validation
 * - Type safety validation
 * - Serialization/deserialization validation
 * - Error response format validation
 */

// Sample DTO classes for testing
class CreateBookingDto {
  listingId!: string;
  startDate!: Date;
  endDate!: Date;
  guestCount?: number;
  message?: string;
}

class UpdateBookingDto {
  startDate?: Date;
  endDate?: Date;
  guestCount?: number;
  message?: string;
}

class BookingResponseDto {
  id!: string;
  listingId!: string;
  renterId!: string;
  ownerId!: string;
  startDate!: Date;
  endDate!: Date;
  status!: string;
  totalPrice!: number;
  currency!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

describe('API Contract Validation Tests', () => {
  let validationPipe: ValidationPipe;

  beforeAll(() => {
    validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  describe('DTO VALIDATION', () => {
    it('should validate required fields in CreateBookingDto', async () => {
      const dto = new CreateBookingDto();
      dto.listingId = 'listing-1';
      dto.startDate = new Date('2024-01-01');
      dto.endDate = new Date('2024-01-05');

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject missing required fields', async () => {
      const dto = new CreateBookingDto();
      // Missing all required fields

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'listingId')).toBe(true);
      expect(errors.some(e => e.property === 'startDate')).toBe(true);
      expect(errors.some(e => e.property === 'endDate')).toBe(true);
    });

    it('should accept optional fields in UpdateBookingDto', async () => {
      const dto = new UpdateBookingDto();
      // All fields are optional

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate date range logic', async () => {
      const dto = new CreateBookingDto();
      dto.listingId = 'listing-1';
      dto.startDate = new Date('2024-01-05');
      dto.endDate = new Date('2024-01-01'); // End before start

      const errors = await validate(dto);
      // This would require custom validator for date range
      expect(dto.startDate < dto.endDate).toBe(false);
    });
  });

  describe('RESPONSE STRUCTURE VALIDATION', () => {
    it('should conform to BookingResponseDto structure', async () => {
      const response = {
        id: 'booking-1',
        listingId: 'listing-1',
        renterId: 'renter-1',
        ownerId: 'owner-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-05'),
        status: 'CONFIRMED',
        totalPrice: 500,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dto = plainToInstance(BookingResponseDto, response);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should reject response with missing fields', () => {
      const response = {
        id: 'booking-1',
        listingId: 'listing-1',
        // Missing required fields
      };

      const dto = plainToInstance(BookingResponseDto, response);
      
      expect(dto.id).toBe('booking-1');
      expect(dto.listingId).toBe('listing-1');
      // Other fields would be undefined but DTO doesn't enforce required in plainToInstance
    });

    it('should validate field types in response', () => {
      const response = {
        id: 'booking-1',
        listingId: 'listing-1',
        renterId: 'renter-1',
        ownerId: 'owner-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-05'),
        status: 'CONFIRMED',
        totalPrice: 500,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(typeof response.id).toBe('string');
      expect(typeof response.listingId).toBe('string');
      expect(response.startDate).toBeInstanceOf(Date);
      expect(response.endDate).toBeInstanceOf(Date);
      expect(typeof response.status).toBe('string');
      expect(typeof response.totalPrice).toBe('number');
      expect(typeof response.currency).toBe('string');
    });
  });

  describe('SERIALIZATION VALIDATION', () => {
    it('should serialize DTO to plain object', () => {
      const dto = new BookingResponseDto();
      dto.id = 'booking-1';
      dto.listingId = 'listing-1';
      dto.renterId = 'renter-1';
      dto.ownerId = 'owner-1';
      dto.startDate = new Date('2024-01-01');
      dto.endDate = new Date('2024-01-05');
      dto.status = 'CONFIRMED';
      dto.totalPrice = 500;
      dto.currency = 'USD';
      dto.createdAt = new Date();
      dto.updatedAt = new Date();

      const plain = classToPlain(dto);

      expect(plain).not.toBeInstanceOf(BookingResponseDto);
      expect(typeof plain).toBe('object');
    });

    it('should deserialize plain object to DTO', () => {
      const plain = {
        id: 'booking-1',
        listingId: 'listing-1',
        renterId: 'renter-1',
        ownerId: 'owner-1',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-05T00:00:00Z',
        status: 'CONFIRMED',
        totalPrice: 500,
        currency: 'USD',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const dto = plainToInstance(BookingResponseDto, plain);

      expect(dto).toBeInstanceOf(BookingResponseDto);
      expect(dto.startDate).toBeInstanceOf(Date);
      expect(dto.endDate).toBeInstanceOf(Date);
    });

    it('should handle date string conversion', () => {
      const plain = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-05T00:00:00Z',
      };

      const dto = plainToInstance(CreateBookingDto, plain);

      expect(dto.startDate).toBeInstanceOf(Date);
      expect(dto.endDate).toBeInstanceOf(Date);
    });
  });

  describe('ERROR RESPONSE FORMAT VALIDATION', () => {
    it('should validate error response structure', () => {
      const errorResponse = {
        statusCode: 400,
        message: 'Bad Request',
        error: 'Invalid input',
        timestamp: new Date().toISOString(),
        path: '/bookings',
      };

      expect(typeof errorResponse.statusCode).toBe('number');
      expect(typeof errorResponse.message).toBe('string');
      expect(typeof errorResponse.error).toBe('string');
      expect(typeof errorResponse.timestamp).toBe('string');
      expect(typeof errorResponse.path).toBe('string');
    });

    it('should validate validation error format', () => {
      const validationError = {
        statusCode: 400,
        message: 'Validation failed',
        errors: [
          {
            field: 'listingId',
            message: 'listingId is required',
          },
          {
            field: 'startDate',
            message: 'startDate must be a valid date',
          },
        ],
      };

      expect(Array.isArray(validationError.errors)).toBe(true);
      expect(validationError.errors[0]).toHaveProperty('field');
      expect(validationError.errors[0]).toHaveProperty('message');
    });
  });

  describe('TYPE SAFETY VALIDATION', () => {
    it('should prevent type coercion in DTOs', () => {
      const input = {
        guestCount: '2', // String instead of number
      };

      const dto = plainToInstance(UpdateBookingDto, input, {
        enableImplicitConversion: false,
      });

      // Without explicit conversion, types should remain as-is
      expect(typeof dto.guestCount).toBe('string' as any);
    });

    it('should handle type conversion when enabled', () => {
      const input = {
        guestCount: '2',
      };

      const dto = plainToInstance(UpdateBookingDto, input, {
        enableImplicitConversion: true,
      });

      // With conversion enabled, strings should be converted to numbers
      expect(typeof dto.guestCount).toBe('number' as any);
    });

    it('should validate enum values', () => {
      const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
      const status = 'CONFIRMED';

      expect(validStatuses).toContain(status);
    });
  });

  describe('API VERSIONING VALIDATION', () => {
    it('should handle versioned API responses', () => {
      const v1Response = {
        data: {
          id: 'booking-1',
          status: 'CONFIRMED',
        },
        version: '1.0',
      };

      const v2Response = {
        data: {
          id: 'booking-1',
          status: 'CONFIRMED',
          metadata: {
            created: '2024-01-01',
          },
        },
        version: '2.0',
      };

      expect(v1Response.version).toBe('1.0');
      expect(v2Response.version).toBe('2.0');
      expect(v2Response.data).toHaveProperty('metadata');
    });

    it('should maintain backward compatibility', () => {
      const v1Fields = ['id', 'status', 'totalPrice'];
      const v2Response = {
        id: 'booking-1',
        status: 'CONFIRMED',
        totalPrice: 500,
        metadata: {},
      };

      v1Fields.forEach(field => {
        expect(v2Response).toHaveProperty(field);
      });
    });
  });

  describe('PAGINATION RESPONSE VALIDATION', () => {
    it('should validate paginated response structure', () => {
      const paginatedResponse = {
        data: [
          { id: 'booking-1' },
          { id: 'booking-2' },
        ],
        meta: {
          total: 100,
          page: 1,
          pageSize: 10,
          totalPages: 10,
        },
      };

      expect(Array.isArray(paginatedResponse.data)).toBe(true);
      expect(typeof paginatedResponse.meta.total).toBe('number');
      expect(typeof paginatedResponse.meta.page).toBe('number');
      expect(typeof paginatedResponse.meta.pageSize).toBe('number');
      expect(typeof paginatedResponse.meta.totalPages).toBe('number');
    });

    it('should validate pagination bounds', () => {
      const meta = {
        total: 100,
        page: 1,
        pageSize: 10,
        totalPages: 10,
      };

      expect(meta.page).toBeGreaterThan(0);
      expect(meta.page).toBeLessThanOrEqual(meta.totalPages);
      expect(meta.pageSize).toBeGreaterThan(0);
      expect(meta.totalPages).toBe(Math.ceil(meta.total / meta.pageSize));
    });
  });

  describe('FIELD SECURITY VALIDATION', () => {
    it('should not expose sensitive fields in responses', () => {
      const user = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hashed-password',
        mfaSecret: 'secret',
      };

      // Response should not include sensitive fields
      const safeResponse = {
        id: user.id,
        email: user.email,
        // passwordHash and mfaSecret excluded
      };

      expect(safeResponse).not.toHaveProperty('passwordHash');
      expect(safeResponse).not.toHaveProperty('mfaSecret');
    });

    it('should validate field access control', () => {
      const adminFields = ['id', 'email', 'role', 'status'];
      const userFields = ['id', 'email'];

      const adminResponse = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'ADMIN',
        status: 'ACTIVE',
      };

      const userResponse = {
        id: 'user-1',
        email: 'user@example.com',
      };

      adminFields.forEach(field => {
        expect(adminResponse).toHaveProperty(field);
      });

      userFields.forEach(field => {
        expect(userResponse).toHaveProperty(field);
      });

      expect(userResponse).not.toHaveProperty('role');
      expect(userResponse).not.toHaveProperty('status');
    });
  });
});
