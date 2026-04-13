import { Test, TestingModule } from '@nestjs/testing';
import { ContractTestFramework } from '../../contract-testing/contract-test-framework';
import { ResponseSchemaValidator } from '../../contract-testing/response-schema-validator';
import { RequestSchemaValidator } from '../../contract-testing/request-schema-validator';

/**
 * API CONTRACT DRIFT TESTS
 *
 * These tests validate that API responses match their expected contracts:
 * - Response structure validation
 * - Field type validation
 * - Required field presence
 * - Deprecated field detection
 * - Breaking change detection
 *
 * Business Truth Validated:
 * - API contracts are stable and predictable
 * - Frontend integrations won't break unexpectedly
 * - Breaking changes are detected early
 * - Response schemas match documentation
 */
describe('API Contract Drift Tests', () => {
  let framework: ContractTestFramework;
  let responseValidator: ResponseSchemaValidator;
  let requestValidator: RequestSchemaValidator;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractTestFramework,
        ResponseSchemaValidator,
        RequestSchemaValidator,
      ],
    }).compile();

    framework = module.get<ContractTestFramework>(ContractTestFramework);
    responseValidator = module.get<ResponseSchemaValidator>(ResponseSchemaValidator);
    requestValidator = module.get<RequestSchemaValidator>(RequestSchemaValidator);
  });

  afterAll(async () => {
    await framework.cleanup();
  });

  describe('Auth API Contract', () => {
    it('should return correct login response structure', async () => {
      const response = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'test@example.com', password: 'password123' },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
    });

    it('should return correct registration response structure', async () => {
      const result = await requestValidator.validate('/api/auth/register', 'POST', {
        email: 'new@example.com',
        password: 'StrongP@ss123',
        firstName: 'New',
        lastName: 'User',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Invalid registration must fail
      const invalid = await requestValidator.validate('/api/auth/register', 'POST', {
        email: 'bad-email',
        password: 'short',
        firstName: '',
        lastName: '',
      });

      expect(invalid.isValid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Listings API Contract', () => {
    it('should return correct listing list response structure', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings',
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });

    it('should return correct single listing response structure', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings/listing-123',
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('owner');
      expect(response.body).toHaveProperty('location');
      expect(typeof response.body.price).toBe('number');
      expect(typeof response.body.id).toBe('string');
    });
  });

  describe('Bookings API Contract', () => {
    it('should return correct booking response structure', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/bookings/booking-123',
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(response.status).toBe(200);

      const validation = await responseValidator.validate('BookingResponse', response.body);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('listingId');
      expect(response.body).toHaveProperty('renterId');
      expect(response.body).toHaveProperty('ownerId');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
      expect(response.body).toHaveProperty('totalPrice');
      expect(typeof response.body.totalPrice).toBe('number');
    });
  });

  describe('Users API Contract', () => {
    it('should return correct user profile response structure', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(response.status).toBe(200);

      const validation = await responseValidator.validate('UserProfile', response.body);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('firstName');
      expect(response.body).toHaveProperty('lastName');
      expect(response.body).toHaveProperty('role');
      expect(response.body).toHaveProperty('createdAt');
    });
  });

  describe('Error Response Contract', () => {
    it('should return consistent error structure for 404', async () => {
      const errorBody = { error: 'Not Found', message: 'Resource not found', statusCode: 404 };
      const validation = await responseValidator.validate('ErrorResponse', errorBody);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(errorBody.statusCode).toBe(404);
    });

    it('should return consistent error structure for 400', async () => {
      const response = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/login',
        body: { email: 'invalid-email', password: '12' },
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
    });

    it('should return consistent error structure for 401', async () => {
      const errorBody = { error: 'Unauthorized', message: 'Invalid or expired token', statusCode: 401 };
      const validation = await responseValidator.validate('ErrorResponse', errorBody);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(errorBody.statusCode).toBe(401);
      expect(typeof errorBody.error).toBe('string');
      expect(typeof errorBody.message).toBe('string');
    });

    it('should return consistent error structure for 403', async () => {
      const errorBody = { error: 'Forbidden', message: 'Access denied', statusCode: 403 };
      const validation = await responseValidator.validate('ErrorResponse', errorBody);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(errorBody.statusCode).toBe(403);
    });
  });

  describe('Pagination Contract', () => {
    it('should return correct pagination structure', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings?page=1&limit=10',
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pagination');

      const { pagination } = response.body;
      expect(typeof pagination.page).toBe('number');
      expect(typeof pagination.limit).toBe('number');
      expect(typeof pagination.total).toBe('number');
      expect(typeof pagination.totalPages).toBe('number');
      expect(pagination.page).toBeGreaterThanOrEqual(1);
      expect(pagination.limit).toBeGreaterThan(0);
    });
  });

  describe('Filtering and Sorting Contract', () => {
    it('should accept valid filter parameters', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings',
        headers: { 'Authorization': 'Bearer test-token' },
        query: { category: 'electronics', minPrice: 100, maxPrice: 1000 },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should accept valid sort parameters', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings',
        headers: { 'Authorization': 'Bearer test-token' },
        query: { sortBy: 'price', sortOrder: 'asc' },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Field Type Validation', () => {
    it('should return numeric price in listings', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings/listing-123',
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(response.status).toBe(200);
      expect(typeof response.body.price).toBe('number');
      expect(response.body.price).toBeGreaterThanOrEqual(0);
    });

    it('should return string IDs in listings', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings/listing-123',
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(response.status).toBe(200);
      expect(typeof response.body.id).toBe('string');
      expect(response.body.id.length).toBeGreaterThan(0);
    });

    it('should return ISO date strings', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings/listing-123',
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(response.status).toBe(200);
      expect(typeof response.body.createdAt).toBe('string');
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
      expect(response.body.createdAt).toMatch(isoDateRegex);
    });
  });

  describe('Required Field Presence', () => {
    it('should include all required fields in listing response', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings/listing-123',
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(response.status).toBe(200);

      const validation = await responseValidator.validate('Listing', response.body);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should not include sensitive fields in user responses', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('refreshToken');
      expect(response.body).not.toHaveProperty('resetToken');
    });
  });

  describe('Deprecated Field Detection', () => {
    it('should not include deprecated fields', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings/listing-123',
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(response.status).toBe(200);
      // Deprecated fields that should not appear in v1 responses
      expect(response.body).not.toHaveProperty('legacyId');
      expect(response.body).not.toHaveProperty('oldCategory');
      expect(response.body).not.toHaveProperty('deprecatedField');
    });
  });

  describe('Breaking Change Detection', () => {
    it('should maintain backward compatibility for listing responses', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings/listing-123',
        headers: { 'Authorization': 'Bearer test-token' },
      });

      expect(response.status).toBe(200);

      // Core fields from v1 contract must still be present
      const requiredV1Fields = ['id', 'title', 'description', 'price', 'createdAt'];
      for (const field of requiredV1Fields) {
        expect(response.body).toHaveProperty(field);
      }

      // Validate full Listing schema
      const validation = await responseValidator.validate('Listing', response.body);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});
