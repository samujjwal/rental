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
      const isSupported = await versioningService.isVersionSupported('1.0');
      expect(isSupported).toBe(true);

      const config = await versioningService.getVersionConfig('1.0');
      expect(config).toBeDefined();
      expect(config.features).toContain('basic_listings');
      expect(config.deprecated).toBe(false);
    });

    test('should support API version 2.0', async () => {
      const isSupported = await versioningService.isVersionSupported('2.0');
      expect(isSupported).toBe(true);

      const config = await versioningService.getVersionConfig('2.0');
      expect(config).toBeDefined();
      expect(config.features).toContain('advanced_listings');
      expect(config.features).toContain('analytics');
      expect(config.deprecated).toBe(false);
    });

    test('should handle version negotiation', async () => {
      const supportedVersions = await versioningService.getSupportedVersions();
      expect(supportedVersions).toEqual(['1.0', '2.0']);

      const currentVersion = await versioningService.getCurrentVersion();
      expect(currentVersion).toBe('1.0');
    });

    test('should default to latest version when no version specified', async () => {
      const latestVersion = await versioningService.getLatestVersion();
      expect(latestVersion).toBe('2.0');
    });

    test('should reject unsupported versions', async () => {
      const is3Supported = await versioningService.isVersionSupported('3.0');
      expect(is3Supported).toBe(false);

      const isInvalidSupported = await versioningService.isVersionSupported('invalid');
      expect(isInvalidSupported).toBe(false);
    });

    test('should validate version compatibility', async () => {
      const validation = await compatibilityValidator.validateCompatibility('1.0', '1.0');
      expect(validation.isValid).toBe(true);
      expect(validation.isCompatible).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should handle version-specific features', async () => {
      const v1Config = await versioningService.getVersionConfig('1.0');
      expect(v1Config.features).toContain('basic_listings');
      expect(v1Config.features).not.toContain('analytics');

      const v2Config = await versioningService.getVersionConfig('2.0');
      expect(v2Config.features).toContain('advanced_listings');
      expect(v2Config.features).toContain('analytics');
      expect(v2Config.features).toContain('messaging');
    });
  });

  describe('Deprecated Endpoints', () => {
    test('should handle deprecated endpoints with warnings', async () => {
      const isDeprecated = await deprecationManager.isDeprecated('/api/v1/legacy-users');
      expect(isDeprecated).toBe(true);

      const deprecationInfo = await deprecationManager.getDeprecationInfo('/api/v1/legacy-users');
      expect(deprecationInfo).toBeDefined();
      expect(deprecationInfo.deprecatedSince).toBe('2023-01-01');
      expect(deprecationInfo.removalDate).toBe('2024-01-01');
      expect(deprecationInfo.replacement).toBe('/api/v2/users');
    });

    test('should reject requests to removed endpoints', async () => {
      const isNotDeprecated = await deprecationManager.isDeprecated('/api/v2/users');
      expect(isNotDeprecated).toBe(false);
    });

    test('should provide migration guidance for deprecated endpoints', async () => {
      const deprecationInfo = await deprecationManager.getDeprecationInfo('/api/v1/legacy-users');
      expect(deprecationInfo.warning).toContain('deprecated');
      expect(deprecationInfo.replacement).toBe('/api/v2/users');
    });

    test('should track deprecation usage', async () => {
      const metrics = await deprecationManager.getUsageMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.deprecatedEndpointUsage).toBeGreaterThan(0);
      expect(metrics.migrationProgress).toBeGreaterThan(0);
    });
  });

  describe('Breaking Changes', () => {
    test('should detect breaking changes between versions', async () => {
      const changes = await compatibilityValidator.detectBreakingChanges('1.0', '2.0');
      expect(Array.isArray(changes)).toBe(true);
      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0].type).toBe('breaking');
      expect(changes[0].field).toBe('username');
      expect(changes[0].action).toBe('removed');
    });

    test('should prevent breaking changes without proper versioning', async () => {
      const validation = await compatibilityValidator.validateCompatibility('1.0', '2.0');
      expect(validation.isValid).toBe(true);
      expect(validation.isCompatible).toBe(true);
      expect(validation.warnings).toContain('Version mismatch: client 1.0, server 2.0');
    });

    test('should handle field deprecation gracefully', async () => {
      const changes = await compatibilityValidator.detectBreakingChanges('1.0', '2.0');
      const removedField = changes.find(c => c.action === 'removed');
      expect(removedField).toBeDefined();
      expect(removedField.field).toBe('username');
    });

    test('should validate response format changes', async () => {
      const migratedData = await versioningService.migrateResponse({ id: 1, name: 'test' }, '1.0', '2.0');
      expect(migratedData._version).toBe('2.0');
      expect(migratedData._migrated).toBe(true);
    });
  });

  describe('Version Negotiation', () => {
    test('should handle multiple version negotiation methods', async () => {
      const supportedVersions = await versioningService.getSupportedVersions();
      expect(supportedVersions).toEqual(['1.0', '2.0']);
      
      const check = await compatibilityValidator.checkCompatibility('1.0', '1.0');
      expect(check.compatible).toBe(true);
    });

    test('should prioritize version negotiation methods correctly', async () => {
      const latestVersion = await versioningService.getLatestVersion();
      expect(latestVersion).toBe('2.0');
      
      const currentVersion = await versioningService.getCurrentVersion();
      expect(currentVersion).toBe('1.0');
    });

    test('should handle version conflicts gracefully', async () => {
      const validation = await compatibilityValidator.validateCompatibility('1.0', '2.0');
      expect(validation.isValid).toBe(true);
      expect(validation.isCompatible).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    test('should support version ranges in Accept-Version', async () => {
      const isV1Supported = await versioningService.isVersionSupported('1.0');
      const isV2Supported = await versioningService.isVersionSupported('2.0');
      expect(isV1Supported).toBe(true);
      expect(isV2Supported).toBe(true);
    });
  });

  describe('Version Lifecycle Management', () => {
    test('should track version lifecycle stages', async () => {
      const lifecycle = await versioningService.getVersionLifecycle();
      expect(lifecycle).toBeDefined();
      expect(lifecycle.versions).toHaveLength(2);
      expect(lifecycle.versions[0].version).toBe('1.0');
      expect(lifecycle.versions[0].status).toBe('stable');
      expect(lifecycle.versions[1].version).toBe('2.0');
      expect(lifecycle.versions[1].status).toBe('beta');
    });

    test('should prevent use of unsupported versions', async () => {
      const is3Supported = await versioningService.isVersionSupported('3.0');
      expect(is3Supported).toBe(false);

      const isInvalidSupported = await versioningService.isVersionSupported('invalid');
      expect(isInvalidSupported).toBe(false);
    });

    test('should provide version upgrade recommendations', async () => {
      const latestVersion = await versioningService.getLatestVersion();
      expect(latestVersion).toBe('2.0');
    });

    test('should handle version sunset properly', async () => {
      const v1Config = await versioningService.getVersionConfig('1.0');
      expect(v1Config.deprecated).toBe(false);
      expect(v1Config.sunsetDate).toBeNull();
    });

    test('should handle version transition periods', async () => {
      const lifecycle = await versioningService.getVersionLifecycle();
      expect(lifecycle.versions[0].status).toBe('stable');
      expect(lifecycle.versions[1].status).toBe('beta');
    });
  });

  describe('Version Documentation', () => {
    test('should provide comprehensive version documentation', async () => {
      const docs = await versioningService.getVersionDocumentation();
      expect(docs).toBeDefined();
      expect(docs.versions).toHaveLength(2);
      expect(docs.versions[0].number).toBe('1.0');
      expect(docs.versions[1].number).toBe('2.0');
      expect(docs.changelog).toBeDefined();
      expect(docs.migrationGuides).toBeDefined();
    });

    test('should include migration guides in documentation', async () => {
      const docs = await versioningService.getVersionDocumentation();
      expect(docs.migrationGuides).toBeDefined();
      expect(Array.isArray(docs.migrationGuides)).toBe(true);
    });

    test('should document breaking changes clearly', async () => {
      const docs = await versioningService.getVersionDocumentation();
      expect(docs.versions[1].breakingChanges).toBeDefined();
      expect(Array.isArray(docs.versions[1].breakingChanges)).toBe(true);
    });

    test('should provide changelog between versions', async () => {
      const changelog = await versioningService.getChangelog('1.0', '2.0');
      expect(changelog).toBeDefined();
      expect(changelog.fromVersion).toBe('1.0');
      expect(changelog.toVersion).toBe('2.0');
      expect(changelog.changes).toBeDefined();
      expect(Array.isArray(changelog.changes)).toBe(true);
      expect(changelog.changes.length).toBeGreaterThan(0);
    });
  });

  describe('Version Testing Integration', () => {
    test('should run comprehensive version compatibility tests', async () => {
      const results = await framework.runVersionCompatibilityTests();
      expect(results).toBeDefined();
      expect(results.overallStatus).toBe('PASSED');
      expect(results.summary.totalTests).toBeGreaterThan(0);
      expect(results.summary.testsFailed).toBe(0);
    });

    test('should generate version compliance report', async () => {
      const report = await framework.generateVersionComplianceReport();
      expect(report).toBeDefined();
      expect(report.testSuite).toBe('API Versioning Tests');
      expect(report.summary.totalTests).toBeGreaterThan(0);
      expect(report.summary.coveragePercentage).toBeGreaterThan(0);
      expect(report.compatibility).toBeDefined();
    });

    test('should test version-specific endpoint behavior', async () => {
      const v1Response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/v1/users',
        headers: { 'Authorization': 'Bearer test-token' }
      });
      expect(v1Response.status).toBe(200);
      expect(v1Response.body).toBeDefined();
    });

    test('should validate version headers in responses', async () => {
      const response = await framework.testEndpoint({
        method: 'GET',
        path: '/api/users',
        headers: { 'Authorization': 'Bearer test-token', 'API-Version': '1.0' }
      });
      expect(response.status).toBe(200);
      expect(response.headers).toBeDefined();
    });
  });

  afterAll(async () => {
    await framework.cleanup();
  });
});
