import { Test, TestingModule } from '@nestjs/testing';
import { ContractTestFramework } from './contract-test-framework';
import { OpenApiValidator } from './openapi-validator';
import { ResponseSchemaValidator } from './response-schema-validator';
import { ContractDriftDetector } from './contract-drift-detector';

describe('Contract Test Framework', () => {
  let framework: ContractTestFramework;
  let openApiValidator: OpenApiValidator;
  let responseValidator: ResponseSchemaValidator;
  let driftDetector: ContractDriftDetector;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractTestFramework,
        OpenApiValidator,
        ResponseSchemaValidator,
        ContractDriftDetector,
      ],
    }).compile();

    framework = module.get<ContractTestFramework>(ContractTestFramework);
    openApiValidator = module.get<OpenApiValidator>(OpenApiValidator);
    responseValidator = module.get<ResponseSchemaValidator>(ResponseSchemaValidator);
    driftDetector = module.get<ContractDriftDetector>(ContractDriftDetector);
  });

  describe('Contract Testing Infrastructure', () => {
    test('should set up contract testing infrastructure', async () => {
      const infrastructure = await framework.getInfrastructure();
      
      expect(infrastructure.openapiSpec).toBeDefined();
      expect(infrastructure.schemaRegistry).toBeDefined();
      expect(infrastructure.responseValidator).toBeDefined();
      expect(infrastructure.driftDetector).toBeDefined();
      expect(infrastructure.testRunner).toBeDefined();
      expect(infrastructure.reportGenerator).toBeDefined();
    });

    test('should configure OpenAPI schema validation', async () => {
      const config = await openApiValidator.getConfig();
      
      expect(config.openapi).toBe('3.0.0');
      expect(config.info).toBeDefined();
      expect(config.info.title).toBe('GharBatai Rental Portal API');
      expect(config.info.version).toBe('1.0.0');
      expect(config.paths).toBeDefined();
      expect(config.components).toBeDefined();
      expect(config.components.schemas).toBeDefined();
    });

    test('should set up response schema validation', async () => {
      const validatorConfig = await responseValidator.getConfig();
      
      expect(validatorConfig.strictMode).toBe(true);
      expect(validatorConfig.stripUnknown).toBe(true);
      expect(validatorConfig.abortEarly).toBe(false);
      expect(validatorConfig.coerceTypes).toBe(true);
      expect(validatorConfig.removeAdditional).toBe(true);
    });

    test('should create contract drift detection', async () => {
      const driftConfig = await driftDetector.getConfig();
      
      expect(driftConfig.compareSchemas).toBe(true);
      expect(driftConfig.compareResponses).toBe(true);
      expect(driftConfig.compareRequestBodies).toBe(true);
      expect(driftConfig.compareHeaders).toBe(true);
      expect(driftConfig.compareStatusCodes).toBe(true);
    });
  });

  describe('OpenAPI Schema Validation', () => {
    test('should validate GET /api/users endpoint schema', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      
      const validation = await openApiValidator.validateResponse(
        '/api/users',
        'GET',
        response.status,
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should validate POST /api/auth/login endpoint schema', async () => {
      const requestBody = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/login',
        body: requestBody
      });

      expect(response.status).toBe(200);
      
      // Validate request body schema
      const requestValidation = await openApiValidator.validateRequest(
        '/api/auth/login',
        'POST',
        requestBody
      );

      expect(requestValidation.isValid).toBe(true);
      expect(requestValidation.errors).toHaveLength(0);

      // Validate response body schema
      const responseValidation = await openApiValidator.validateResponse(
        '/api/auth/login',
        'POST',
        response.status,
        response.body
      );

      expect(responseValidation.isValid).toBe(true);
      expect(responseValidation.errors).toHaveLength(0);
    });

    test('should validate POST /api/listings endpoint schema', async () => {
      const requestBody = {
        title: 'Test Listing',
        description: 'Test Description',
        price: 100,
        categoryId: 1,
        location: {
          address: 'Test Address',
          city: 'Test City',
          country: 'Test Country',
          coordinates: {
            lat: 27.7172,
            lng: 85.3240
          }
        },
        amenities: ['wifi', 'parking'],
        images: ['image1.jpg', 'image2.jpg']
      };

      const response = await framework.testEndpoint({
        method: 'POST',
        path: '/api/listings',
        body: requestBody,
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(201);
      
      const validation = await openApiValidator.validateResponse(
        '/api/listings',
        'POST',
        response.status,
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should validate error response schemas', async () => {
      const invalidRequest = {
        email: 'invalid-email',
        password: '123' // Too short
      };

      const response = await framework.testEndpoint({
        method: 'POST',
        path: '/api/auth/login',
        body: invalidRequest
      });

      expect(response.status).toBe(400);
      
      const validation = await openApiValidator.validateResponse(
        '/api/auth/login',
        'POST',
        response.status,
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Should have proper error structure
      expect(response.body.error).toBeDefined();
      expect(response.body.message).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('should validate pagination response schemas', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings?page=1&limit=10',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      
      const validation = await openApiValidator.validateResponse(
        '/api/listings',
        'GET',
        response.status,
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Should have pagination structure
      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBeDefined();
      expect(response.body.pagination.limit).toBeDefined();
      expect(response.body.pagination.total).toBeDefined();
      expect(response.body.pagination.totalPages).toBeDefined();
    });

    test('should validate nested object schemas', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/listings/listing-123',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      
      const validation = await openApiValidator.validateResponse(
        '/api/listings/{id}',
        'GET',
        response.status,
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Should validate nested location object
      expect(response.body.location).toBeDefined();
      expect(response.body.location.address).toBeDefined();
      expect(response.body.location.city).toBeDefined();
      expect(response.body.location.coordinates).toBeDefined();
      expect(response.body.location.coordinates.lat).toBeDefined();
      expect(response.body.location.coordinates.lng).toBeDefined();
    });

    test('should validate array response schemas', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/categories',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      
      const validation = await openApiValidator.validateResponse(
        '/api/categories',
        'GET',
        response.status,
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Should validate array structure
      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        expect(response.body[0].id).toBeDefined();
        expect(response.body[0].name).toBeDefined();
        expect(response.body[0].description).toBeDefined();
      }
    });
  });

  describe('Response Schema Validation', () => {
    test('should validate user response schema', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      
      const validation = await responseValidator.validate(
        'UserResponse',
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Should have required fields
      expect(response.body.id).toBeDefined();
      expect(response.body.email).toBeDefined();
      expect(response.body.firstName).toBeDefined();
      expect(response.body.lastName).toBeDefined();
      expect(response.body.role).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    test('should validate booking response schema', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/bookings/booking-123',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      
      const validation = await responseValidator.validate(
        'BookingResponse',
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Should have required fields
      expect(response.body.id).toBeDefined();
      expect(response.body.listingId).toBeDefined();
      expect(response.body.renterId).toBeDefined();
      expect(response.body.ownerId).toBeDefined();
      expect(response.body.status).toBeDefined();
      expect(response.body.startDate).toBeDefined();
      expect(response.body.endDate).toBeDefined();
      expect(response.body.totalPrice).toBeDefined();
    });

    test('should validate payment response schema', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/payments/payment-123',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      
      const validation = await responseValidator.validate(
        'PaymentResponse',
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Should have required fields
      expect(response.body.id).toBeDefined();
      expect(response.body.bookingId).toBeDefined();
      expect(response.body.amount).toBeDefined();
      expect(response.body.currency).toBeDefined();
      expect(response.body.status).toBeDefined();
      expect(response.body.paymentMethod).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    test('should validate message response schema', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/messages/message-123',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      
      const validation = await responseValidator.validate(
        'MessageResponse',
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Should have required fields
      expect(response.body.id).toBeDefined();
      expect(response.body.senderId).toBeDefined();
      expect(response.body.recipientId).toBeDefined();
      expect(response.body.content).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.read).toBeDefined();
    });

    test('should reject invalid response schemas', async () => {
      const invalidResponse = {
        id: 'invalid-id',
        email: 'not-an-email',
        role: 'invalid-role',
        createdAt: 'not-a-date'
      };

      const validation = await responseValidator.validate(
        'UserResponse',
        invalidResponse
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      
      // Should specify validation errors
      expect(validation.errors.some(e => e.includes('email'))).toBe(true);
      expect(validation.errors.some(e => e.includes('role'))).toBe(true);
      expect(validation.errors.some(e => e.includes('createdAt'))).toBe(true);
    });

    test('should handle optional fields in response schemas', async () => {
      const responseWithOptionals = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        createdAt: '2023-01-01T00:00:00Z',
        phoneNumber: '+1234567890', // Optional
        bio: 'Test bio', // Optional
        avatar: 'avatar.jpg' // Optional
      };

      const validation = await responseValidator.validate(
        'UserResponse',
        responseWithOptionals
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should validate enum fields in response schemas', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/bookings/booking-123',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      
      const validation = await responseValidator.validate(
        'BookingResponse',
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      // Should validate enum values
      expect(['pending', 'confirmed', 'cancelled', 'completed']).toContain(response.body.status);
      expect(['cash', 'card', 'bank_transfer', 'digital_wallet']).toContain(response.body.paymentMethod);
    });
  });

  describe('Contract Drift Detection', () => {
    test('should detect schema drift in user endpoints', async () => {
      const currentSchema = await driftDetector.getCurrentSchema('/api/users');
      const expectedSchema = await driftDetector.getExpectedSchema('/api/users');

      const drift = await driftDetector.compareSchemas(currentSchema, expectedSchema);

      expect(drift.hasDrift).toBe(false);
      expect(drift.differences).toHaveLength(0);
    });

    test('should detect response format drift', async () => {
      const currentResponse = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users/profile',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      const expectedResponse = await driftDetector.getExpectedResponse('/api/users/profile', 'GET');

      const drift = await driftDetector.compareResponses(
        currentResponse.body,
        expectedResponse
      );

      expect(drift.hasDrift).toBe(false);
      expect(drift.differences).toHaveLength(0);
    });

    test('should detect missing required fields', async () => {
      const incompleteResponse = {
        id: 'user-123',
        email: 'test@example.com'
        // Missing firstName, lastName, role, createdAt
      };

      const expectedSchema = await driftDetector.getExpectedSchema('/api/users/profile');

      const drift = await driftDetector.validateAgainstSchema(
        incompleteResponse,
        expectedSchema
      );

      expect(drift.hasDrift).toBe(true);
      expect(drift.differences.length).toBeGreaterThan(0);
      expect(drift.differences.some(d => d.includes('missing'))).toBe(true);
    });

    test('should detect extra fields in responses', async () => {
      const responseWithExtras = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        createdAt: '2023-01-01T00:00:00Z',
        extraField: 'should not be here',
        anotherExtra: { nested: 'object' }
      };

      const expectedSchema = await driftDetector.getExpectedSchema('/api/users/profile');

      const drift = await driftDetector.validateAgainstSchema(
        responseWithExtras,
        expectedSchema
      );

      expect(drift.hasDrift).toBe(true);
      expect(drift.differences.some(d => d.includes('additional'))).toBe(true);
    });

    test('should detect data type mismatches', async () => {
      const wrongTypesResponse = {
        id: 123, // Should be string
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        createdAt: '2023-01-01' // Should be ISO date
      };

      const expectedSchema = await driftDetector.getExpectedSchema('/api/users/profile');

      const drift = await driftDetector.validateAgainstSchema(
        wrongTypesResponse,
        expectedSchema
      );

      expect(drift.hasDrift).toBe(true);
      expect(drift.differences.some(d => d.includes('type'))).toBe(true);
    });

    test('should detect status code drift', async () => {
      const endpoints = [
        { path: '/api/users', method: 'GET', expectedStatus: 200 },
        { path: '/api/auth/login', method: 'POST', expectedStatus: 200 },
        { path: '/api/listings', method: 'POST', expectedStatus: 201 }
      ];

      for (const endpoint of endpoints) {
        const response = await framework.testEndpoint({
          method: endpoint.method,
          path: endpoint.path,
          body: endpoint.method === 'POST' ? { test: 'data' } : undefined,
          headers: endpoint.path.includes('auth') ? undefined : { 'Authorization': 'Bearer test-token' }
        });

        const drift = await driftDetector.compareStatusCodes(
          response.status,
          endpoint.expectedStatus
        );

        expect(drift.hasDrift).toBe(false);
        expect(drift.differences).toHaveLength(0);
      }
    });

    test('should generate comprehensive drift report', async () => {
      const report = await driftDetector.generateDriftReport();

      expect(report.timestamp).toBeDefined();
      expect(report.endpoints).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.driftDetected).toBeDefined();

      expect(report.summary.totalEndpoints).toBeGreaterThan(0);
      expect(report.summary.compliantEndpoints).toBeGreaterThan(0);
      expect(report.summary.driftedEndpoints).toBe(0);

      expect(report.endpoints['/api/users']).toBeDefined();
      expect(report.endpoints['/api/auth/login']).toBeDefined();
      expect(report.endpoints['/api/listings']).toBeDefined();
    });
  });

  describe('Contract Test Execution', () => {
    test('should run complete contract test suite', async () => {
      const results = await framework.runCompleteContractSuite();

      expect(results.overallStatus).toBe('PASSED');
      expect(results.testResults).toBeDefined();
      expect(results.testResults.openapiValidation).toBeDefined();
      expect(results.testResults.responseValidation).toBeDefined();
      expect(results.testResults.driftDetection).toBeDefined();

      expect(results.summary.totalTests).toBeGreaterThan(0);
      expect(results.summary.testsPassed).toBe(results.summary.totalTests);
      expect(results.summary.testsFailed).toBe(0);
    });

    test.skip('should handle contract test failures gracefully', async () => {
      // Mock a failing test by spying on and modifying framework behavior
      const mockValidateResponse = jest.fn().mockResolvedValue({
        isValid: false,
        errors: ['Missing required field: id']
      });
      
      // Replace the method temporarily
      const originalMethod = openApiValidator.validateResponse;
      openApiValidator.validateResponse = mockValidateResponse;
      
      const results = await framework.runCompleteContractSuite();
      
      // Restore original method
      openApiValidator.validateResponse = originalMethod;

      expect(results.overallStatus).toBe('FAILED');
      expect(results.summary.testsFailed).toBeGreaterThan(0);
      expect(results.failures.length).toBeGreaterThan(0);
    });

    test('should provide detailed contract test reports', async () => {
      const report = await framework.generateContractTestReport();

      expect(report.timestamp).toBeDefined();
      expect(report.testSuite).toBe('Contract Testing Framework');
      expect(report.results).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.compliance).toBeDefined();

      expect(report.summary.totalTests).toBeGreaterThan(0);
      expect(report.summary.testsPassed).toBeGreaterThan(0);
      expect(report.summary.coveragePercentage).toBeGreaterThan(0);

      // Should include OpenAPI compliance
      expect(report.compliance.openapi).toBeDefined();
      expect(report.compliance.openapi.status).toBe('COMPLIANT');

      // Should include schema validation compliance
      expect(report.compliance.schemaValidation).toBeDefined();
      expect(report.compliance.schemaValidation.status).toBe('COMPLIANT');

      // Should include contract drift compliance
      expect(report.compliance.contractDrift).toBeDefined();
      expect(report.compliance.contractDrift.status).toBe('COMPLIANT');
    });

    test('should validate contract test coverage', async () => {
      const coverage = await framework.getContractTestCoverage();

      expect(coverage.totalEndpoints).toBeGreaterThan(0);
      expect(coverage.testedEndpoints).toBeGreaterThan(0);
      expect(coverage.coveragePercentage).toBeGreaterThan(0);

      expect(coverage.coverageByMethod).toBeDefined();
      expect(coverage.coverageByMethod.GET).toBeDefined();
      expect(coverage.coverageByMethod.POST).toBeDefined();
      expect(coverage.coverageByMethod.PUT).toBeDefined();
      expect(coverage.coverageByMethod.DELETE).toBeDefined();

      expect(coverage.coverageByStatus).toBeDefined();
      expect(coverage.coverageByStatus['200']).toBeDefined();
      expect(coverage.coverageByStatus['201']).toBeDefined();
      expect(coverage.coverageByStatus['400']).toBeDefined();
      expect(coverage.coverageByStatus['401']).toBeDefined();
      expect(coverage.coverageByStatus['404']).toBeDefined();
    });
  });

  afterAll(async () => {
    await framework.cleanup();
  });
});
