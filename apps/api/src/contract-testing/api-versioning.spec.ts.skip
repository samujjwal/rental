import { Test, TestingModule } from '@nestjs/testing';
import { ContractTestFramework } from './contract-test-framework';
import { ApiVersioningService } from './api-versioning.service';
import { VersionCompatibilityValidator } from './version-compatibility-validator';
import { DeprecationManager } from './deprecation-manager';

describe('API Versioning Tests', () => {
  let framework: ContractTestFramework;
  let versioningService: ApiVersioningService;
  let compatibilityValidator: VersionCompatibilityValidator;
  let deprecationManager: DeprecationManager;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractTestFramework,
        ApiVersioningService,
        VersionCompatibilityValidator,
        DeprecationManager,
      ],
    }).compile();

    framework = module.get<ContractTestFramework>(ContractTestFramework);
    versioningService = module.get<ApiVersioningService>(ApiVersioningService);
    compatibilityValidator = module.get<VersionCompatibilityValidator>(VersionCompatibilityValidator);
    deprecationManager = module.get<DeprecationManager>(DeprecationManager);
  });

  describe('Version Compatibility', () => {
    test('should support API version 1.0', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/v1/users',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '1.0'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers['api-version']).toBe('1.0');
      
      // Should validate v1 response schema
      const validation = await compatibilityValidator.validateResponse(
        '1.0',
        '/api/users',
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should support API version 2.0', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/v2/users',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '2.0'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers['api-version']).toBe('2.0');
      
      // Should validate v2 response schema
      const validation = await compatibilityValidator.validateResponse(
        '2.0',
        '/api/users',
        response.body
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should handle version negotiation', async () => {
      // Test with Accept-Version header
      const response1 = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users',
        headers: { 
          'Authorization': 'Bearer test-token',
          'Accept-Version': '1.0'
        }
      });

      expect(response1.status).toBe(200);
      expect(response1.headers['api-version']).toBe('1.0');

      // Test with API-Version header
      const response2 = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '2.0'
        }
      });

      expect(response2.status).toBe(200);
      expect(response2.headers['api-version']).toBe('2.0');

      // Test with query parameter
      const response3 = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users?version=1.0',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response3.status).toBe(200);
      expect(response3.headers['api-version']).toBe('1.0');
    });

    test('should default to latest version when no version specified', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users',
        headers: { 'Authorization': 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      expect(response.headers['api-version']).toBeDefined();
      
      // Should default to latest stable version
      const latestVersion = await versioningService.getLatestVersion();
      expect(response.headers['api-version']).toBe(latestVersion);
    });

    test('should reject unsupported versions', async () => {
      const unsupportedVersions = ['0.9', '3.0', 'invalid', ''];

      for (const version of unsupportedVersions) {
        const response = await framework.testEndpoint({
          method: 'GET',
          path: '/api/users',
          headers: { 
            'Authorization': 'Bearer test-token',
            'API-Version': version
          }
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Unsupported API version');
      }
    });

    test('should validate version compatibility', async () => {
      const compatibilityMatrix = [
        { requestVersion: '1.0', responseVersion: '1.0', compatible: true },
        { requestVersion: '1.0', responseVersion: '2.0', compatible: false },
        { requestVersion: '2.0', responseVersion: '2.0', compatible: true },
        { requestVersion: '2.0', responseVersion: '1.0', compatible: false }
      ];

      for (const { requestVersion, responseVersion, compatible } of compatibilityMatrix) {
        const validation = await compatibilityValidator.validateCompatibility(
          requestVersion,
          responseVersion
        );

        expect(validation.isCompatible).toBe(compatible);
        
        if (!compatible) {
          expect(validation.errors.length).toBeGreaterThan(0);
          expect(validation.errors[0]).toContain('incompatible');
        }
      }
    });

    test('should handle version-specific features', async () => {
      // Test v1 specific features
      const v1Response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/v1/users/profile',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '1.0'
        }
      });

      expect(v1Response.status).toBe(200);
      expect(v1Response.body).not.toHaveProperty('preferences'); // v1 doesn't have preferences

      // Test v2 specific features
      const v2Response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/v2/users/profile',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '2.0'
        }
      });

      expect(v2Response.status).toBe(200);
      expect(v2Response.body).toHaveProperty('preferences'); // v2 has preferences
      expect(v2Response.body).toHaveProperty('notifications'); // v2 has notifications
    });
  });

  describe('Deprecated Endpoints', () => {
    test('should handle deprecated endpoints with warnings', async () => {
      const deprecatedEndpoints = [
        { path: '/api/v1/legacy/users', deprecatedVersion: '2.0', removalVersion: '3.0' },
        { path: '/api/v1/legacy/listings', deprecatedVersion: '2.0', removalVersion: '3.0' },
        { path: '/api/v1/legacy/bookings', deprecatedVersion: '2.0', removalVersion: '3.0' }
      ];

      for (const endpoint of deprecatedEndpoints) {
        const response = await framework.testEndpoint({
          method: 'GET',
          path: endpoint.path,
          headers: { 
            'Authorization': 'Bearer test-token',
            'API-Version': '1.0'
          }
        });

        expect(response.status).toBe(200);
        
        // Should include deprecation warnings
        expect(response.headers['deprecation']).toBe('true');
        expect(response.headers['sunset']).toBeDefined();
        expect(response.headers['link']).toContain('rel="deprecated-version"');
        
        // Should include deprecation warning in response body
        expect(response.body.deprecationWarning).toBeDefined();
        expect(response.body.deprecationWarning.deprecatedVersion).toBe(endpoint.deprecatedVersion);
        expect(response.body.deprecationWarning.removalVersion).toBe(endpoint.removalVersion);
        expect(response.body.deprecationWarning.migrationGuide).toBeDefined();
      }
    });

    test('should reject requests to removed endpoints', async () => {
      const removedEndpoints = [
        '/api/v1/removed/old-endpoint',
        '/api/v1/removed/another-endpoint'
      ];

      for (const endpoint of removedEndpoints) {
        const response = await framework.testEndpoint({
          method: 'GET',
          path: endpoint,
          headers: { 
            'Authorization': 'Bearer test-token',
            'API-Version': '1.0'
          }
        });

        expect(response.status).toBe(410);
        expect(response.body.error).toContain('Endpoint has been removed');
        expect(response.body.removalVersion).toBeDefined();
        expect(response.body.alternativeEndpoint).toBeDefined();
      }
    });

    test('should provide migration guidance for deprecated endpoints', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/v1/legacy/users',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '1.0'
        }
      });

      expect(response.status).toBe(200);
      
      const deprecation = response.body.deprecationWarning;
      expect(deprecation.migrationGuide).toBeDefined();
      expect(deprecation.alternativeEndpoint).toBe('/api/v2/users');
      expect(deprecation.migrationSteps).toBeDefined();
      expect(Array.isArray(deprecation.migrationSteps)).toBe(true);
      
      // Should include specific migration steps
      deprecation.migrationSteps.forEach((step: any) => {
        expect(step.description).toBeDefined();
        expect(step.action).toBeDefined();
        expect(step.codeExample).toBeDefined();
      });
    });

    test('should track deprecation usage', async () => {
      // Make requests to deprecated endpoints
      await framework.testEndpoint({
        method: 'GET',
        path: '/api/v1/legacy/users',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '1.0'
        }
      });

      await framework.testEndpoint({
        method: 'GET',
        path: '/api/v1/legacy/listings',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '1.0'
        }
      });

      // Check deprecation metrics
      const metrics = await deprecationManager.getUsageMetrics();
      
      expect(metrics.totalDeprecatedCalls).toBeGreaterThan(0);
      expect(metrics.endpoints['/api/v1/legacy/users']).toBeDefined();
      expect(metrics.endpoints['/api/v1/legacy/listings']).toBeDefined();
      expect(metrics.endpoints['/api/v1/legacy/users'].callCount).toBeGreaterThan(0);
      expect(metrics.endpoints['/api/v1/legacy/listings'].callCount).toBeGreaterThan(0);
    });
  });

  describe('Breaking Changes', () => {
    test('should detect breaking changes between versions', async () => {
      const breakingChanges = await compatibilityValidator.detectBreakingChanges('1.0', '2.0');
      
      expect(Array.isArray(breakingChanges)).toBe(true);
      
      // Should identify specific breaking changes
      breakingChanges.forEach(change => {
        expect(change.type).toBeDefined();
        expect(change.description).toBeDefined();
        expect(change.severity).toBeDefined();
        expect(change.affectedEndpoints).toBeDefined();
        expect(change.migrationRequired).toBeDefined();
      });
    });

    test('should prevent breaking changes without proper versioning', async () => {
      // Try to make a breaking change request without proper version
      const response = await framework.testEndpoint({
        method: 'POST',
        path: '/api/users',
        body: {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          newField: 'should not exist in v1'
        },
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '1.0'
        }
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid field for API version');
      expect(response.body.invalidFields).toContain('newField');
    });

    test('should handle field deprecation gracefully', async () => {
      // Test with deprecated field in v2
      const response = await framework.testEndpoint({
        method: 'POST',
        path: '/api/v2/users',
        body: {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          deprecatedField: 'old value'
        },
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '2.0'
        }
      });

      expect(response.status).toBe(200);
      
      // Should include deprecation warning for the field
      expect(response.body.deprecationWarnings).toBeDefined();
      expect(Array.isArray(response.body.deprecationWarnings)).toBe(true);
      
      const fieldDeprecation = response.body.deprecationWarnings.find(
        (w: any) => w.field === 'deprecatedField'
      );
      expect(fieldDeprecation).toBeDefined();
      expect(fieldDeprecation.alternativeField).toBeDefined();
      expect(fieldDeprecation.removalVersion).toBeDefined();
    });

    test('should validate response format changes', async () => {
      // v1 response format
      const v1Response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/v1/users/profile',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '1.0'
        }
      });

      expect(v1Response.status).toBe(200);
      expect(v1Response.body).toHaveProperty('firstName');
      expect(v1Response.body).toHaveProperty('lastName');
      expect(v1Response.body).not.toHaveProperty('fullName'); // v1 doesn't have fullName

      // v2 response format
      const v2Response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/v2/users/profile',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '2.0'
        }
      });

      expect(v2Response.status).toBe(200);
      expect(v2Response.body).toHaveProperty('firstName');
      expect(v2Response.body).toHaveProperty('lastName');
      expect(v2Response.body).toHaveProperty('fullName'); // v2 has fullName
      expect(v2Response.body.fullName).toBe(`${v2Response.body.firstName} ${v2Response.body.lastName}`);
    });
  });

  describe('Version Negotiation', () => {
    test('should handle multiple version negotiation methods', async () => {
      const negotiationMethods = [
        { header: 'API-Version', value: '1.0' },
        { header: 'Accept-Version', value: '1.0' },
        { header: 'Content-Type', value: 'application/vnd.api+json;version=1.0' },
        { query: 'version=1.0' }
      ];

      for (const method of negotiationMethods) {
        let headers = { 'Authorization': 'Bearer test-token' };
        let path = '/api/users';

        if (method.header) {
          headers[method.header] = method.value;
        }

        if (method.query) {
          path += `?${method.query}`;
        }

        const response = await framework.testEndpoint({
          method: 'GET',
          path,
          headers
        });

        expect(response.status).toBe(200);
        expect(response.headers['api-version']).toBe('1.0');
      }
    });

    test('should prioritize version negotiation methods correctly', async () => {
      // Test priority: API-Version > Accept-Version > Content-Type > Query
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users?version=1.0',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '2.0',
          'Accept-Version': '1.0',
          'Content-Type': 'application/vnd.api+json;version=3.0'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers['api-version']).toBe('2.0'); // API-Version takes priority
    });

    test('should handle version conflicts gracefully', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '1.0',
          'Accept-Version': '2.0'
        }
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Conflicting version specifications');
      expect(response.body.conflictingVersions).toContain('API-Version: 1.0');
      expect(response.body.conflictingVersions).toContain('Accept-Version: 2.0');
    });

    test('should support version ranges in Accept-Version', async () => {
      const versionRanges = [
        '1.x',
        '2.x',
        '>=1.0',
        '<3.0',
        '>=1.0,<2.0'
      ];

      for (const versionRange of versionRanges) {
        const response = await framework.testEndpoint({
          method: 'GET',
          path: '/api/users',
          headers: { 
            'Authorization': 'Bearer test-token',
            'Accept-Version': versionRange
          }
        });

        expect(response.status).toBe(200);
        expect(response.headers['api-version']).toBeDefined();
        expect(response.headers['negotiated-version']).toBeDefined();
      }
    });
  });

  describe('Version Lifecycle Management', () => {
    test('should track version lifecycle stages', async () => {
      const lifecycle = await versioningService.getVersionLifecycle();

      expect(lifecycle).toBeDefined();
      expect(lifecycle.versions).toBeDefined();
      
      lifecycle.versions.forEach((version: any) => {
        expect(version.number).toBeDefined();
        expect(version.status).toBeDefined();
        expect(version.releasedAt).toBeDefined();
        expect(version.deprecatedAt).toBeDefined();
        expect(version.supportUntil).toBeDefined();
        
        // Should have valid status
        expect(['development', 'stable', 'deprecated', 'unsupported']).toContain(version.status);
      });
    });

    test('should prevent use of unsupported versions', async () => {
      const unsupportedVersion = '0.9';

      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': unsupportedVersion
        }
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Version is no longer supported');
      expect(response.body.supportedVersions).toBeDefined();
      expect(response.body.recommendedVersion).toBeDefined();
    });

    test('should provide version upgrade recommendations', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '1.0'
        }
      });

      expect(response.status).toBe(200);
      
      // Should include upgrade recommendations for deprecated versions
      if (response.headers['api-version'] === '1.0') {
        expect(response.body.upgradeRecommendation).toBeDefined();
        expect(response.body.upgradeRecommendation.targetVersion).toBeDefined();
        expect(response.body.upgradeRecommendation.upgradeSteps).toBeDefined();
        expect(response.body.upgradeRecommendation.breakingChanges).toBeDefined();
      }
    });

    test('should handle version transition periods', async () => {
      // Test during transition period when v1 is deprecated but still supported
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users',
        headers: { 
          'Authorization': 'Bearer test-token',
          'API-Version': '1.0'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers['api-version']).toBe('1.0');
      
      // Should include transition warnings
      expect(response.headers['transition-warning']).toBeDefined();
      expect(response.body.transitionNotice).toBeDefined();
      expect(response.body.transitionNotice.currentVersion).toBe('1.0');
      expect(response.body.transitionNotice.targetVersion).toBe('2.0');
      expect(response.body.transitionNotice.transitionEndDate).toBeDefined();
    });
  });

  describe('Version Documentation', () => {
    test('should provide comprehensive version documentation', async () => {
      const documentation = await versioningService.getVersionDocumentation();

      expect(documentation).toBeDefined();
      expect(documentation.versions).toBeDefined();
      expect(documentation.changelog).toBeDefined();
      expect(documentation.migrationGuides).toBeDefined();

      documentation.versions.forEach((version: any) => {
        expect(version.number).toBeDefined();
        expect(version.description).toBeDefined();
        expect(version.features).toBeDefined();
        expect(version.breakingChanges).toBeDefined();
        expect(version.deprecations).toBeDefined();
        expect(version.endpoints).toBeDefined();
      });
    });

    test('should generate version-specific API documentation', async () => {
      const v1Docs = await versioningService.generateDocumentation('1.0');
      const v2Docs = await versioningService.generateDocumentation('2.0');

      expect(v1Docs).toBeDefined();
      expect(v2Docs).toBeDefined();
      
      expect(v1Docs.version).toBe('1.0');
      expect(v2Docs.version).toBe('2.0');
      
      // Should have different endpoint sets
      expect(v1Docs.endpoints).not.toEqual(v2Docs.endpoints);
      
      // Should include version-specific schemas
      expect(v1Docs.schemas).toBeDefined();
      expect(v2Docs.schemas).toBeDefined();
    });

    test('should provide changelog between versions', async () => {
      const changelog = await versioningService.getChangelog('1.0', '2.0');

      expect(changelog).toBeDefined();
      expect(changelog.fromVersion).toBe('1.0');
      expect(changelog.toVersion).toBe('2.0');
      expect(changelog.changes).toBeDefined();
      expect(Array.isArray(changelog.changes)).toBe(true);

      changelog.changes.forEach((change: any) => {
        expect(change.type).toBeDefined();
        expect(change.description).toBeDefined();
        expect(change.impact).toBeDefined();
        expect(change.category).toBeDefined();
        
        // Should have valid change types
        expect(['added', 'changed', 'deprecated', 'removed', 'fixed', 'security']).toContain(change.type);
      });
    });
  });

  describe('Version Testing Integration', () => {
    test('should run comprehensive version compatibility tests', async () => {
      const results = await framework.runVersionCompatibilityTests();

      expect(results.overallStatus).toBe('PASSED');
      expect(results.testResults).toBeDefined();
      expect(results.testResults.versionCompatibility).toBeDefined();
      expect(results.testResults.deprecationHandling).toBeDefined();
      expect(results.testResults.breakingChangeDetection).toBeDefined();
      expect(results.testResults.versionNegotiation).toBeDefined();

      expect(results.summary.totalTests).toBeGreaterThan(0);
      expect(results.summary.testsPassed).toBe(results.summary.totalTests);
      expect(results.summary.testsFailed).toBe(0);
    });

    test('should generate version compliance report', async () => {
      const report = await framework.generateVersionComplianceReport();

      expect(report.timestamp).toBeDefined();
      expect(report.testSuite).toBe('API Versioning Tests');
      expect(report.results).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.compliance).toBeDefined();

      expect(report.summary.totalTests).toBeGreaterThan(0);
      expect(report.summary.testsPassed).toBeGreaterThan(0);
      expect(report.summary.coveragePercentage).toBeGreaterThan(90);

      // Should include version compatibility compliance
      expect(report.compatibility.versionCompatibility).toBeDefined();
      expect(report.compatibility.versionCompatibility.status).toBe('COMPLIANT');

      // Should include deprecation compliance
      expect(report.compatibility.deprecationHandling).toBeDefined();
      expect(report.compatibility.deprecationHandling.status).toBe('COMPLIANT');

      // Should include breaking change compliance
      expect(report.compatibility.breakingChangeManagement).toBeDefined();
      expect(report.compatibility.breakingChangeManagement.status).toBe('COMPLIANT');
    });

    test('should validate version testing coverage', async () => {
      const coverage = await framework.getVersionTestCoverage();

      expect(coverage.totalVersions).toBeGreaterThan(0);
      expect(coverage.testedVersions).toBeGreaterThan(0);
      expect(coverage.coveragePercentage).toBeGreaterThan(90);

      expect(coverage.coverageByVersion).toBeDefined();
      expect(coverage.coverageByVersion['1.0']).toBeDefined();
      expect(coverage.coverageByVersion['2.0']).toBeDefined();

      expect(coverage.coverageByFeature).toBeDefined();
      expect(coverage.coverageByFeature.compatibility).toBeDefined();
      expect(coverage.coverageByFeature.deprecation).toBeDefined();
      expect(coverage.coverageByFeature.breakingChanges).toBeDefined();
      expect(coverage.coverageByFeature.negotiation).toBeDefined();
    });
  });

  afterAll(async () => {
    await framework.cleanup();
  });
});
