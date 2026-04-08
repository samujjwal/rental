import { Test, TestingModule } from '@nestjs/testing';
import { ContractTestFramework } from './contract-test-framework';
import { ApiSchemaValidator } from './api-schema-validator';
import { RequestSchemaValidator } from './request-schema-validator';
import { ResponseSchemaValidator } from './response-schema-validator';

describe('API Schema Tests', () => {
  let framework: ContractTestFramework;
  let apiValidator: ApiSchemaValidator;
  let requestValidator: RequestSchemaValidator;
  let responseValidator: ResponseSchemaValidator;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractTestFramework,
        ApiSchemaValidator,
        RequestSchemaValidator,
        ResponseSchemaValidator,
      ],
    }).compile();

    framework = module.get<ContractTestFramework>(ContractTestFramework);
    apiValidator = module.get<ApiSchemaValidator>(ApiSchemaValidator);
    requestValidator = module.get<RequestSchemaValidator>(RequestSchemaValidator);
    responseValidator = module.get<ResponseSchemaValidator>(ResponseSchemaValidator);
  });

  describe('Request Schema Validation', () => {
    test('should validate user registration request schema', async () => {
      const validRequest = {
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890'
      };

      const validation = await requestValidator.validate(
        '/api/auth/register',
        'POST',
        validRequest
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid user registration request', async () => {
      const invalidRequests = [
        { email: 'invalid-email', password: 'password123', firstName: 'John', lastName: 'Doe' },
        { email: 'test@example.com', password: '123', firstName: 'John', lastName: 'Doe' },
        { email: 'test@example.com', password: 'password123', firstName: '', lastName: 'Doe' },
        { email: 'test@example.com', password: 'password123', firstName: 'John', lastName: '' },
        { email: 'test@example.com', password: 'password123', firstName: 'John' }, // Missing lastName
        { email: 'test@example.com', password: 'password123', lastName: 'Doe' } // Missing firstName
      ];

      for (const request of invalidRequests) {
        const validation = await requestValidator.validate(
          '/api/auth/register',
          'POST',
          request
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate login request schema', async () => {
      const validRequest = {
        email: 'test@example.com',
        password: 'password123'
      };

      const validation = await requestValidator.validate(
        '/api/auth/login',
        'POST',
        validRequest
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid login request', async () => {
      const invalidRequests = [
        { email: 'invalid-email', password: 'password123' },
        { email: 'test@example.com', password: '' },
        { email: '', password: 'password123' },
        { email: 'test@example.com' }, // Missing password
        { password: 'password123' } // Missing email
      ];

      for (const request of invalidRequests) {
        const validation = await requestValidator.validate(
          '/api/auth/login',
          'POST',
          request
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate listing creation request schema', async () => {
      const validRequest = {
        title: 'Beautiful Apartment in Kathmandu',
        description: 'A lovely apartment with great views',
        price: 100,
        categoryId: 1,
        location: {
          address: 'Thamel, Kathmandu',
          city: 'Kathmandu',
          country: 'Nepal',
          coordinates: {
            lat: 27.7172,
            lng: 85.3240
          }
        },
        amenities: ['wifi', 'parking', 'kitchen'],
        images: ['image1.jpg', 'image2.jpg'],
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4
      };

      const validation = await requestValidator.validate(
        '/api/listings',
        'POST',
        validRequest
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid listing creation request', async () => {
      const invalidRequests = [
        { title: '', description: 'Test', price: 100, categoryId: 1 }, // Empty title
        { title: 'Test', description: '', price: 100, categoryId: 1 }, // Empty description
        { title: 'Test', description: 'Test', price: -100, categoryId: 1 }, // Negative price
        { title: 'Test', description: 'Test', price: 100, categoryId: 0 }, // Invalid category
        { title: 'Test', description: 'Test', price: 100 }, // Missing categoryId
        { title: 'Test', description: 'Test', categoryId: 1 }, // Missing price
        { title: 'Test', price: 100, categoryId: 1, location: { address: '' } } // Invalid location
      ];

      for (const request of invalidRequests) {
        const validation = await requestValidator.validate(
          '/api/listings',
          'POST',
          request
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate booking creation request schema', async () => {
      const validRequest = {
        listingId: 'listing-123',
        startDate: '2023-12-01',
        endDate: '2023-12-05',
        guests: {
          adults: 2,
          children: 0,
          infants: 0
        },
        totalPrice: 400,
        specialRequests: 'Early check-in requested'
      };

      const validation = await requestValidator.validate(
        '/api/bookings',
        'POST',
        validRequest
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid booking creation request', async () => {
      const invalidRequests = [
        { listingId: '', startDate: '2023-12-01', endDate: '2023-12-05', guests: { adults: 2 } },
        { listingId: 'listing-123', startDate: 'invalid-date', endDate: '2023-12-05', guests: { adults: 2 } },
        { listingId: 'listing-123', startDate: '2023-12-01', endDate: '2023-11-30', guests: { adults: 2 } }, // End before start
        { listingId: 'listing-123', startDate: '2023-12-01', endDate: '2023-12-05', guests: { adults: 0 } }, // No adults
        { listingId: 'listing-123', startDate: '2023-12-01', endDate: '2023-12-05', guests: { adults: -1 } }, // Negative adults
        { listingId: 'listing-123', startDate: '2023-12-01', endDate: '2023-12-05', guests: { adults: 101 } }, // Too many adults
        { listingId: 'listing-123', startDate: '2023-12-01', endDate: '2023-12-05', guests: { adults: 2, children: -1 } } // Negative children
      ];

      for (const request of invalidRequests) {
        const validation = await requestValidator.validate(
          '/api/bookings',
          'POST',
          request
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate message sending request schema', async () => {
      const validRequest = {
        recipientId: 'user-123',
        content: 'Hello, I am interested in your listing',
        listingId: 'listing-123'
      };

      const validation = await requestValidator.validate(
        '/api/messages',
        'POST',
        validRequest
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid message sending request', async () => {
      const invalidRequests = [
        { recipientId: '', content: 'Hello', listingId: 'listing-123' },
        { recipientId: 'user-123', content: '', listingId: 'listing-123' },
        { recipientId: 'user-123', content: 'Hello' }, // Missing listingId
        { content: 'Hello', listingId: 'listing-123' }, // Missing recipientId
        { recipientId: 'user-123', listingId: 'listing-123' } // Missing content
      ];

      for (const request of invalidRequests) {
        const validation = await requestValidator.validate(
          '/api/messages',
          'POST',
          request
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate review creation request schema', async () => {
      const validRequest = {
        listingId: 'listing-123',
        rating: 5,
        comment: 'Great place to stay!',
        categories: {
          cleanliness: 5,
          communication: 5,
          checkIn: 4,
          accuracy: 5,
          location: 5,
          value: 4
        }
      };

      const validation = await requestValidator.validate(
        '/api/reviews',
        'POST',
        validRequest
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid review creation request', async () => {
      const invalidRequests = [
        { listingId: '', rating: 5, comment: 'Great!' },
        { listingId: 'listing-123', rating: 0, comment: 'Great!' }, // Rating too low
        { listingId: 'listing-123', rating: 6, comment: 'Great!' }, // Rating too high
        { listingId: 'listing-123', rating: 5, comment: '' }, // Empty comment
        { listingId: 'listing-123', rating: 5 }, // Missing comment
        { rating: 5, comment: 'Great!' }, // Missing listingId
        { listingId: 'listing-123', rating: 5, comment: 'Great!', categories: { cleanliness: 0 } } // Invalid category rating
      ];

      for (const request of invalidRequests) {
        const validation = await requestValidator.validate(
          '/api/reviews',
          'POST',
          request
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Response Schema Validation', () => {
    test('should validate user profile response schema', async () => {
      const validResponse = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
        phone: '+1234567890',
        bio: 'Software developer',
        avatar: 'avatar.jpg',
        isVerified: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      const validation = await responseValidator.validate(
        'UserProfile',
        validResponse
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid user profile response', async () => {
      const invalidResponses = [
        { id: '', email: 'test@example.com', firstName: 'John', lastName: 'Doe', role: 'user' },
        { id: 'user-123', email: 'invalid-email', firstName: 'John', lastName: 'Doe', role: 'user' },
        { id: 'user-123', email: 'test@example.com', firstName: '', lastName: 'Doe', role: 'user' },
        { id: 'user-123', email: 'test@example.com', firstName: 'John', lastName: 'Doe', role: 'invalid-role' },
        { id: 'user-123', email: 'test@example.com', firstName: 'John', lastName: 'Doe' }, // Missing role
        { email: 'test@example.com', firstName: 'John', lastName: 'Doe', role: 'user' } // Missing id
      ];

      for (const response of invalidResponses) {
        const validation = await responseValidator.validate(
          'UserProfile',
          response
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate listing response schema', async () => {
      const validResponse = {
        id: 'listing-123',
        title: 'Beautiful Apartment',
        description: 'A lovely apartment',
        price: 100,
        categoryId: 1,
        category: {
          id: 1,
          name: 'Apartment',
          description: 'Apartment category'
        },
        owner: {
          id: 'user-123',
          firstName: 'John',
          lastName: 'Doe',
          avatar: 'avatar.jpg'
        },
        location: {
          address: 'Thamel, Kathmandu',
          city: 'Kathmandu',
          country: 'Nepal',
          coordinates: {
            lat: 27.7172,
            lng: 85.3240
          }
        },
        amenities: ['wifi', 'parking'],
        images: ['image1.jpg', 'image2.jpg'],
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        rating: 4.5,
        reviewCount: 25,
        isAvailable: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      const validation = await responseValidator.validate(
        'Listing',
        validResponse
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid listing response', async () => {
      const invalidResponses = [
        { id: '', title: 'Test', price: 100, categoryId: 1 },
        { id: 'listing-123', title: '', price: 100, categoryId: 1 },
        { id: 'listing-123', title: 'Test', price: -100, categoryId: 1 },
        { id: 'listing-123', title: 'Test', price: 100, categoryId: 0 },
        { id: 'listing-123', title: 'Test', price: 100 }, // Missing categoryId
        { title: 'Test', price: 100, categoryId: 1 }, // Missing id
        { id: 'listing-123', title: 'Test', price: 100, categoryId: 1, location: { address: '' } } // Invalid location
      ];

      for (const response of invalidResponses) {
        const validation = await responseValidator.validate(
          'Listing',
          response
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate booking response schema', async () => {
      const validResponse = {
        id: 'booking-123',
        listingId: 'listing-123',
        listing: {
          id: 'listing-123',
          title: 'Beautiful Apartment',
          images: ['image1.jpg']
        },
        renterId: 'user-456',
        renter: {
          id: 'user-456',
          firstName: 'Jane',
          lastName: 'Smith',
          avatar: 'avatar2.jpg'
        },
        ownerId: 'user-123',
        owner: {
          id: 'user-123',
          firstName: 'John',
          lastName: 'Doe',
          avatar: 'avatar.jpg'
        },
        status: 'confirmed',
        startDate: '2023-12-01',
        endDate: '2023-12-05',
        guests: {
          adults: 2,
          children: 0,
          infants: 0
        },
        totalPrice: 400,
        currency: 'USD',
        paymentStatus: 'paid',
        specialRequests: 'Early check-in requested',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      const validation = await responseValidator.validate(
        'Booking',
        validResponse
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid booking response', async () => {
      const invalidResponses = [
        { id: '', listingId: 'listing-123', status: 'confirmed' },
        { id: 'booking-123', listingId: '', status: 'confirmed' },
        { id: 'booking-123', listingId: 'listing-123', status: 'invalid-status' },
        { id: 'booking-123', listingId: 'listing-123', startDate: 'invalid-date', endDate: '2023-12-05', status: 'confirmed' },
        { id: 'booking-123', listingId: 'listing-123', startDate: '2023-12-01', endDate: '2023-11-30', status: 'confirmed' },
        { id: 'booking-123', listingId: 'listing-123', status: 'confirmed', guests: { adults: 0 } }
      ];

      for (const response of invalidResponses) {
        const validation = await responseValidator.validate(
          'Booking',
          response
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate payment response schema', async () => {
      const validResponse = {
        id: 'payment-123',
        bookingId: 'booking-123',
        amount: 400,
        currency: 'USD',
        status: 'completed',
        paymentMethod: 'card',
        paymentDetails: {
          last4: '1234',
          brand: 'visa',
          expMonth: 12,
          expYear: 2024
        },
        transactionId: 'txn-123',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      const validation = await responseValidator.validate(
        'Payment',
        validResponse
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid payment response', async () => {
      const invalidResponses = [
        { id: '', bookingId: 'booking-123', amount: 400, status: 'completed' },
        { id: 'payment-123', bookingId: '', amount: 400, status: 'completed' },
        { id: 'payment-123', bookingId: 'booking-123', amount: -400, status: 'completed' },
        { id: 'payment-123', bookingId: 'booking-123', amount: 400, status: 'invalid-status' },
        { id: 'payment-123', bookingId: 'booking-123', amount: 400, status: 'completed', currency: 'INVALID' }
      ];

      for (const response of invalidResponses) {
        const validation = await responseValidator.validate(
          'Payment',
          response
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate message response schema', async () => {
      const validResponse = {
        id: 'message-123',
        senderId: 'user-456',
        sender: {
          id: 'user-456',
          firstName: 'Jane',
          lastName: 'Smith',
          avatar: 'avatar2.jpg'
        },
        recipientId: 'user-123',
        recipient: {
          id: 'user-123',
          firstName: 'John',
          lastName: 'Doe',
          avatar: 'avatar.jpg'
        },
        content: 'Hello, I am interested in your listing',
        listingId: 'listing-123',
        read: false,
        readAt: null,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };

      const validation = await responseValidator.validate(
        'Message',
        validResponse
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid message response', async () => {
      const invalidResponses = [
        { id: '', senderId: 'user-456', recipientId: 'user-123', content: 'Hello' },
        { id: 'message-123', senderId: '', recipientId: 'user-123', content: 'Hello' },
        { id: 'message-123', senderId: 'user-456', recipientId: '', content: 'Hello' },
        { id: 'message-123', senderId: 'user-456', recipientId: 'user-123', content: '' },
        { id: 'message-123', senderId: 'user-456', recipientId: 'user-123', content: 'Hello', read: 'invalid' }
      ];

      for (const response of invalidResponses) {
        const validation = await responseValidator.validate(
          'Message',
          response
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Schema Validation', () => {
    test('should validate standard error response schema', async () => {
      const validErrorResponses = [
        {
          error: 'Validation Error',
          message: 'Invalid input data',
          details: {
            field: 'email',
            value: 'invalid-email',
            issue: 'Invalid email format'
          },
          timestamp: '2023-01-01T00:00:00Z',
          path: '/api/auth/register'
        },
        {
          error: 'Authentication Error',
          message: 'Invalid credentials',
          timestamp: '2023-01-01T00:00:00Z',
          path: '/api/auth/login'
        },
        {
          error: 'Not Found',
          message: 'Resource not found',
          timestamp: '2023-01-01T00:00:00Z',
          path: '/api/listings/nonexistent'
        },
        {
          error: 'Unauthorized',
          message: 'Access denied',
          timestamp: '2023-01-01T00:00:00Z',
          path: '/api/admin/users'
        }
      ];

      for (const errorResponse of validErrorResponses) {
        const validation = await responseValidator.validate(
          'ErrorResponse',
          errorResponse
        );

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });

    test('should reject invalid error response schema', async () => {
      const invalidErrorResponses = [
        { message: 'Error occurred' }, // Missing error field
        { error: '', message: 'Error occurred' }, // Empty error field
        { error: 'Validation Error' }, // Missing message field
        { error: 'Validation Error', message: '' }, // Empty message field
        { error: 'Validation Error', message: 'Error', timestamp: 'invalid-date' }, // Invalid timestamp
        { error: 'Validation Error', message: 'Error', path: 123 } // Invalid path type
      ];

      for (const errorResponse of invalidErrorResponses) {
        const validation = await responseValidator.validate(
          'ErrorResponse',
          errorResponse
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    });

    test('should validate validation error details schema', async () => {
      const validValidationErrors = [
        {
          field: 'email',
          value: 'invalid-email',
          issue: 'Invalid email format',
          allowedValues: ['valid@email.com'],
          constraint: 'Must be a valid email address'
        },
        {
          field: 'password',
          value: '123',
          issue: 'Password too short',
          minLength: 8,
          maxLength: 128,
          pattern: '^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d@$!%*#?&]{8,}$'
        },
        {
          field: 'age',
          value: 15,
          issue: 'Age below minimum',
          minimum: 18,
          maximum: 120
        }
      ];

      for (const errorDetails of validValidationErrors) {
        const validation = await responseValidator.validate(
          'ValidationErrorDetails',
          errorDetails
        );

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });
  });

  describe('Data Type Validation', () => {
    test('should validate string data types', async () => {
      const validStringFields = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        bio: 'Software developer with 5 years of experience'
      };

      for (const [field, value] of Object.entries(validStringFields)) {
        const validation = await apiValidator.validateDataType(
          field,
          value,
          'string'
        );

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });

    test('should validate number data types', async () => {
      const validNumberFields = {
        price: 100,
        rating: 4.5,
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        adults: 2,
        children: 0,
        infants: 0
      };

      for (const [field, value] of Object.entries(validNumberFields)) {
        const validation = await apiValidator.validateDataType(
          field,
          value,
          'number'
        );

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });

    test('should validate boolean data types', async () => {
      const validBooleanFields = {
        isVerified: true,
        isAvailable: false,
        read: true,
        isActive: true,
        hasProfile: false
      };

      for (const [field, value] of Object.entries(validBooleanFields)) {
        const validation = await apiValidator.validateDataType(
          field,
          value,
          'boolean'
        );

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });

    test('should validate array data types', async () => {
      const validArrayFields = {
        amenities: ['wifi', 'parking', 'kitchen'],
        images: ['image1.jpg', 'image2.jpg', 'image3.jpg'],
        categories: ['apartment', 'furnished', 'city-center'],
        tags: ['pet-friendly', 'family-friendly', 'business-ready']
      };

      for (const [field, value] of Object.entries(validArrayFields)) {
        const validation = await apiValidator.validateDataType(
          field,
          value,
          'array'
        );

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });

    test('should validate object data types', async () => {
      const validObjectFields = {
        location: {
          address: 'Thamel, Kathmandu',
          city: 'Kathmandu',
          country: 'Nepal',
          coordinates: {
            lat: 27.7172,
            lng: 85.3240
          }
        },
        guests: {
          adults: 2,
          children: 0,
          infants: 0
        },
        paymentDetails: {
          last4: '1234',
          brand: 'visa',
          expMonth: 12,
          expYear: 2024
        }
      };

      for (const [field, value] of Object.entries(validObjectFields)) {
        const validation = await apiValidator.validateDataType(
          field,
          value,
          'object'
        );

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });

    test('should validate date data types', async () => {
      const validDateFields = {
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        startDate: '2023-12-01',
        endDate: '2023-12-05',
        birthDate: '1990-01-15'
      };

      for (const [field, value] of Object.entries(validDateFields)) {
        const validation = await apiValidator.validateDataType(
          field,
          value,
          'date'
        );

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });

    test('should reject invalid data types', async () => {
      const invalidTypePairs = [
        { field: 'email', value: 123, expectedType: 'string' },
        { field: 'price', value: '100', expectedType: 'number' },
        { field: 'isVerified', value: 'true', expectedType: 'boolean' },
        { field: 'amenities', value: 'wifi,parking', expectedType: 'array' },
        { field: 'location', value: 'Thamel, Kathmandu', expectedType: 'object' },
        { field: 'createdAt', value: '2023-01-01', expectedType: 'date' }
      ];

      for (const { field, value, expectedType } of invalidTypePairs) {
        const validation = await apiValidator.validateDataType(
          field,
          value,
          expectedType
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
        expect(validation.errors[0]).toContain(`Expected ${expectedType}`);
      }
    });
  });

  describe('Required Field Validation', () => {
    test('should validate required fields in user schema', async () => {
      const requiredFields = ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt'];
      
      for (const field of requiredFields) {
        const userWithoutField = {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'user',
          createdAt: '2023-01-01T00:00:00Z'
        };
        
        delete userWithoutField[field];
        
        const validation = await responseValidator.validate(
          'UserProfile',
          userWithoutField
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(e => e.includes(field))).toBe(true);
      }
    });

    test('should validate required fields in listing schema', async () => {
      const requiredFields = ['id', 'title', 'description', 'price', 'categoryId', 'owner', 'location', 'createdAt'];
      
      for (const field of requiredFields) {
        const listingWithoutField = {
          id: 'listing-123',
          title: 'Beautiful Apartment',
          description: 'A lovely apartment',
          price: 100,
          categoryId: 1,
          owner: { id: 'user-123', firstName: 'John', lastName: 'Doe' },
          location: { address: 'Thamel, Kathmandu', city: 'Kathmandu', country: 'Nepal' },
          createdAt: '2023-01-01T00:00:00Z'
        };
        
        delete listingWithoutField[field];
        
        const validation = await responseValidator.validate(
          'Listing',
          listingWithoutField
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(e => e.includes(field))).toBe(true);
      }
    });

    test('should validate required fields in booking schema', async () => {
      const requiredFields = ['id', 'listingId', 'renterId', 'ownerId', 'status', 'startDate', 'endDate', 'totalPrice', 'createdAt'];
      
      for (const field of requiredFields) {
        const bookingWithoutField = {
          id: 'booking-123',
          listingId: 'listing-123',
          renterId: 'user-456',
          ownerId: 'user-123',
          status: 'confirmed',
          startDate: '2023-12-01',
          endDate: '2023-12-05',
          totalPrice: 400,
          createdAt: '2023-01-01T00:00:00Z'
        };
        
        delete bookingWithoutField[field];
        
        const validation = await responseValidator.validate(
          'Booking',
          bookingWithoutField
        );

        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(e => e.includes(field))).toBe(true);
      }
    });
  });

  describe('Schema Compliance Report', () => {
    test('should generate comprehensive schema compliance report', async () => {
      const report = await apiValidator.generateComplianceReport();

      expect(report.timestamp).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.endpoints).toBeDefined();
      expect(report.schemas).toBeDefined();
      expect(report.issues).toBeDefined();

      expect(report.summary.totalSchemas).toBeGreaterThan(0);
      expect(report.summary.compliantSchemas).toBeGreaterThan(0);
      expect(report.summary.compliancePercentage).toBeGreaterThan(90);

      expect(report.endpoints['/api/auth/register']).toBeDefined();
      expect(report.endpoints['/api/auth/login']).toBeDefined();
      expect(report.endpoints['/api/listings']).toBeDefined();
      expect(report.endpoints['/api/bookings']).toBeDefined();
      expect(report.endpoints['/api/messages']).toBeDefined();
      expect(report.endpoints['/api/reviews']).toBeDefined();

      expect(report.schemas.UserProfile).toBeDefined();
      expect(report.schemas.Listing).toBeDefined();
      expect(report.schemas.Booking).toBeDefined();
      expect(report.schemas.Payment).toBeDefined();
      expect(report.schemas.Message).toBeDefined();
      expect(report.schemas.ErrorResponse).toBeDefined();
    });

    test('should identify schema validation issues', async () => {
      const issues = await apiValidator.identifyIssues();

      expect(Array.isArray(issues)).toBe(true);
      
      // Should categorize issues by severity
      const criticalIssues = issues.filter(issue => issue.severity === 'critical');
      const warningIssues = issues.filter(issue => issue.severity === 'warning');
      const infoIssues = issues.filter(issue => issue.severity === 'info');

      expect(criticalIssues.length).toBe(0); // Should have no critical issues
      expect(warningIssues.length).toBeGreaterThanOrEqual(0);
      expect(infoIssues.length).toBeGreaterThanOrEqual(0);
    });

    test('should provide schema validation recommendations', async () => {
      const recommendations = await apiValidator.getRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      recommendations.forEach(recommendation => {
        expect(recommendation.type).toBeDefined();
        expect(recommendation.description).toBeDefined();
        expect(recommendation.priority).toBeDefined();
        expect(recommendation.action).toBeDefined();
      });
    });
  });

  afterAll(async () => {
    await framework.cleanup();
  });
});
