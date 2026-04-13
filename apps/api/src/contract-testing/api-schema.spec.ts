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
      const validRegistration = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      };

      const result = await requestValidator.validate('/api/auth/register', 'POST', validRegistration);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid user registration request', async () => {
      const invalidRegistration = {
        email: 'invalid-email',
        password: 'short',
        firstName: '',
        lastName: ''
      };

      const result = await requestValidator.validate('/api/auth/register', 'POST', invalidRegistration);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate login request schema', async () => {
      const validLogin = {
        email: 'test@example.com',
        password: 'password123'
      };

      const result = await apiValidator.validate('/auth/login', 'POST', validLogin);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid login request', async () => {
      const invalidLogin = {
        email: '',
        password: ''
      };

      const result = await apiValidator.validate('/auth/login', 'POST', invalidLogin);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    test('should validate listing creation request schema', async () => {
      const validListing = {
        title: 'Test Listing',
        description: 'Test Description',
        price: 100
      };

      const result = await requestValidator.validate('/api/listings', 'POST', validListing);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid listing creation request', async () => {
      const invalidListing = {
        title: '',
        description: '',
        price: undefined
      };

      const result = await requestValidator.validate('/api/listings', 'POST', invalidListing);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate booking creation request schema', async () => {
      const validBooking = {
        listingId: 'listing-123',
        startDate: '2023-01-01',
        endDate: '2023-01-07'
      };

      const result = await requestValidator.validate('/api/bookings', 'POST', validBooking);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid booking creation request', async () => {
      const invalidBooking = {};

      const result = await requestValidator.validate('/api/bookings', 'POST', invalidBooking);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Request body is required');
    });

    test('should validate message sending request schema', async () => {
      const validMessage = {
        recipientId: 'user-123',
        content: 'Hello!'
      };

      const result = await requestValidator.validate('/api/messages', 'POST', validMessage);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid message sending request', async () => {
      const invalidMessage = {};

      const result = await requestValidator.validate('/api/messages', 'POST', invalidMessage);
      expect(result.isValid).toBe(false);
    });

    test('should validate review creation request schema', async () => {
      const validReview = {
        bookingId: 'booking-123',
        rating: 5,
        comment: 'Great experience!'
      };

      const result = await requestValidator.validate('/api/reviews', 'POST', validReview);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid review creation request', async () => {
      const invalidReview = {};

      const result = await requestValidator.validate('/api/reviews', 'POST', invalidReview);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Response Schema Validation', () => {
    test('should validate user profile response schema', async () => {
      const validUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
        createdAt: '2023-01-01T00:00:00Z'
      };

      const result = await responseValidator.validate('UserProfile', validUser);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid user profile response', async () => {
      const invalidUser = {
        id: 'user-123',
        email: 'test@example.com'
        // Missing required fields
      };

      const result = await responseValidator.validate('UserProfile', invalidUser);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate listing response schema', async () => {
      const validListing = {
        id: 'listing-123',
        title: 'Test Listing',
        description: 'Test Description',
        price: 100,
        categoryId: 1,
        owner: { id: 'user-123' },
        location: { address: 'Test Address' },
        createdAt: '2023-01-01T00:00:00Z'
      };

      const result = await responseValidator.validate('Listing', validListing);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid listing response', async () => {
      const invalidListing = {
        id: 'listing-123',
        title: 'Test Listing'
        // Missing required fields
      };

      const result = await responseValidator.validate('Listing', invalidListing);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate booking response schema', async () => {
      const validBooking = {
        id: 'booking-123',
        listingId: 'listing-123',
        renterId: 'user-123',
        ownerId: 'user-456',
        status: 'confirmed',
        startDate: '2023-01-01',
        endDate: '2023-01-07',
        totalPrice: 700
      };

      const result = await responseValidator.validate('BookingResponse', validBooking);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid booking response', async () => {
      const invalidBooking = {
        id: 'booking-123',
        listingId: 'listing-123'
        // Missing required fields
      };

      const result = await responseValidator.validate('BookingResponse', invalidBooking);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate payment response schema', async () => {
      const validPayment = {
        id: 'payment-123',
        bookingId: 'booking-123',
        amount: 700,
        currency: 'NPR',
        status: 'completed',
        paymentMethod: 'card',
        createdAt: '2023-01-01T00:00:00Z'
      };

      const result = await responseValidator.validate('PaymentResponse', validPayment);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid payment response', async () => {
      const invalidPayment = {
        id: 'payment-123',
        bookingId: 'booking-123'
        // Missing required fields
      };

      const result = await responseValidator.validate('PaymentResponse', invalidPayment);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate message response schema', async () => {
      const validMessage = {
        id: 'message-123',
        senderId: 'user-123',
        recipientId: 'user-456',
        content: 'Hello!',
        timestamp: '2023-01-01T00:00:00Z',
        read: false
      };

      const result = await responseValidator.validate('MessageResponse', validMessage);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid message response', async () => {
      const invalidMessage = {
        id: 'message-123',
        senderId: 'user-123'
        // Missing required fields
      };

      const result = await responseValidator.validate('MessageResponse', invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Schema Validation', () => {
    test('should validate standard error response schema', async () => {
      const validError = {
        error: 'Not Found',
        message: 'Resource not found',
        statusCode: 404
      };

      const result = await responseValidator.validate('ErrorResponse', validError);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid error response schema', async () => {
      const invalidError = {
        error: 'Error'
        // Missing required fields
      };

      const result = await responseValidator.validate('ErrorResponse', invalidError);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate validation error details schema', async () => {
      const validationError = {
        error: 'Validation Error',
        message: 'Invalid input',
        statusCode: 400,
        details: [
          { field: 'email', message: 'Invalid email format' }
        ]
      };

      const result = await responseValidator.validate('ErrorResponse', validationError);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Data Type Validation', () => {
    test('should validate string data types', async () => {
      const result = await apiValidator.validateDataType('name', 'test', 'string');
      expect(result.isValid).toBe(true);
    });

    test('should validate number data types', async () => {
      const result = await apiValidator.validateDataType('age', 25, 'number');
      expect(result.isValid).toBe(true);
    });

    test('should validate boolean data types', async () => {
      const result = await apiValidator.validateDataType('active', true, 'boolean');
      expect(result.isValid).toBe(true);
    });

    test('should validate array data types', async () => {
      const result = await apiValidator.validateDataType('items', [1, 2, 3], 'array');
      expect(result.isValid).toBe(true);
    });

    test('should validate object data types', async () => {
      const result = await apiValidator.validateDataType('user', { name: 'test' }, 'object');
      expect(result.isValid).toBe(true);
    });

    test('should validate date data types', async () => {
      const result = await apiValidator.validateDataType('createdAt', '2023-01-01', 'string');
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid data types', async () => {
      const result = await apiValidator.validateDataType('age', '25', 'number');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Expected number, got string');
    });
  });

  describe('Required Field Validation', () => {
    test('should validate required fields in user schema', async () => {
      const validUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
        createdAt: '2023-01-01T00:00:00Z'
      };

      const result = await responseValidator.validate('UserProfile', validUser);
      expect(result.isValid).toBe(true);
    });

    test('should validate required fields in listing schema', async () => {
      const validListing = {
        id: 'listing-123',
        title: 'Test Listing',
        description: 'Test Description',
        price: 100,
        categoryId: 1,
        owner: { id: 'user-123' },
        location: { address: 'Test Address' },
        createdAt: '2023-01-01T00:00:00Z'
      };

      const result = await responseValidator.validate('Listing', validListing);
      expect(result.isValid).toBe(true);
    });

    test('should validate required fields in booking schema', async () => {
      const validBooking = {
        id: 'booking-123',
        listingId: 'listing-123',
        renterId: 'user-123',
        ownerId: 'user-456',
        status: 'confirmed',
        startDate: '2023-01-01',
        endDate: '2023-01-07',
        totalPrice: 700
      };

      const result = await responseValidator.validate('BookingResponse', validBooking);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Schema Compliance Report', () => {
    test('should generate comprehensive schema compliance report', async () => {
      const report = await apiValidator.generateComplianceReport();
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.compliant).toBe(true);
      expect(report.summary.compliancePercentage).toBe(100);
      expect(report.endpoints).toBeDefined();
      expect(report.schemas).toBeDefined();
      expect(report.issues).toBeDefined();
    });

    test('should identify schema issues', async () => {
      const issues = await apiValidator.identifyIssues();
      expect(Array.isArray(issues)).toBe(true);
    });

    test('should provide recommendations for schema improvements', async () => {
      const recommendations = await apiValidator.getRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toHaveProperty('type');
      expect(recommendations[0]).toHaveProperty('description');
      expect(recommendations[0]).toHaveProperty('priority');
    });

    test('should get response validator config', async () => {
      const config = await responseValidator.getConfig();
      expect(config).toBeDefined();
      expect(config.strictMode).toBe(true);
      expect(config.stripUnknown).toBe(true);
    });
  });

  afterAll(async () => {
    await framework.cleanup();
  });
});
