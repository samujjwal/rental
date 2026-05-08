#!/usr/bin/env node

/**
 * Test Strict Mode Runner
 * 
 * This script enforces strict test policies:
 * - Fails on .skip files in critical paths
 * - Fails on describe.skip in critical test suites
 * - Fails on it.skip in critical test suites
 * - Requires feature flag approval for skipping critical tests
 * 
 * Usage: node scripts/test/test-strict.mjs [unit|integration|e2e|all]
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = dirname(dirname(dirname(__dirname)));

// Critical paths where skips are not allowed
const CRITICAL_PATHS = [
  'apps/api/src/modules/bookings',
  'apps/api/src/modules/payments',
  'apps/api/src/modules/availability',
  'apps/api/src/modules/disputes',
  'apps/api/src/modules/messaging',
  'apps/api/src/modules/notifications',
];

// Allowed conditional skips (environment-based)
const ALLOWED_CONDITIONAL_SKIPS = [
  'describeIfStripe',
  'describeFirefox',
  'describeWebkit',
  'describeMobile',
  'hasStripeTestKey',
  'isFirefox',
  'isWebkit',
  'isMobile',
];

class TestStrictRunner {
  constructor() {
    this.violations = [];
    this.warnings = [];
    this.filesScanned = 0;
  }

  async run(testType = 'all') {
    console.log('🔍 Running Test Strict Mode...');
    console.log(`Test Type: ${testType}`);
    console.log('');

    // Scan for violations
    await this.scanForViolations(testType);

    // Report results
    this.reportResults();

    // Exit with error if violations found
    if (this.violations.length > 0) {
      process.exit(1);
    }

    // Run actual tests if no violations
    console.log('✅ No strict mode violations found. Running tests...');
    await this.runTests(testType);
  }

  async scanForViolations(testType) {
    const pathsToScan = this.getPathsToScan(testType);

    for (const path of pathsToScan) {
      await this.scanDirectory(path);
    }
  }

  getPathsToScan(testType) {
    const paths = [];

    if (testType === 'all' || testType === 'unit') {
      paths.push(join(ROOT, 'apps/api/src'));
    }

    if (testType === 'all' || testType === 'e2e') {
      paths.push(join(ROOT, 'apps/web/e2e'));
      paths.push(join(ROOT, 'apps/api/test'));
    }

    return paths;
  }

  async scanDirectory(dir) {
    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          await this.scanDirectory(fullPath);
        } else if (this.isTestFile(entry)) {
          await this.scanTestFile(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  isTestFile(filename) {
    return (
      filename.endsWith('.spec.ts') ||
      filename.endsWith('.spec.tsx') ||
      filename.endsWith('.test.ts') ||
      filename.endsWith('.test.tsx') ||
      filename.endsWith('.spec.ts.skip') ||
      filename.endsWith('.test.ts.skip')
    );
  }

  async scanTestFile(filePath) {
    this.filesScanned++;
    const relativePath = relative(ROOT, filePath);
    const content = readFileSync(filePath, 'utf-8');

    // Check for .skip extension
    if (filePath.endsWith('.skip')) {
      if (this.isCriticalPath(filePath)) {
        this.violations.push({
          type: 'SKIP_FILE',
          file: relativePath,
          message: 'Critical test file is skipped (.skip extension)',
        });
      } else {
        this.warnings.push({
          type: 'SKIP_FILE',
          file: relativePath,
          message: 'Non-critical test file is skipped',
        });
      }
      return;
    }

    // Check for describe.skip
    const describeSkipMatches = content.matchAll(/describe\.skip\s*\(/g);
    for (const match of describeSkipMatches) {
      if (this.isCriticalPath(filePath)) {
        this.violations.push({
          type: 'DESCRIBE_SKIP',
          file: relativePath,
          message: 'describe.skip() found in critical test file',
        });
      }
    }

    // Check for it.skip
    const itSkipMatches = content.matchAll(/it\.skip\s*\(/g);
    for (const match of itSkipMatches) {
      if (this.isCriticalPath(filePath)) {
        this.violations.push({
          type: 'IT_SKIP',
          file: relativePath,
          message: 'it.skip() found in critical test file',
        });
      }
    }

    // Check for test.skip (Playwright)
    const testSkipMatches = content.matchAll(/test\.skip\s*\(/g);
    for (const match of testSkipMatches) {
      if (this.isCriticalPath(filePath)) {
        this.violations.push({
          type: 'TEST_SKIP',
          file: relativePath,
          message: 'test.skip() found in critical test file',
        });
      }
    }
  }

  isCriticalPath(filePath) {
    const relativePath = relative(ROOT, filePath);
    return CRITICAL_PATHS.some(criticalPath => 
      relativePath.startsWith(criticalPath)
    );
  }

  reportResults() {
    console.log(`📊 Scanned ${this.filesScanned} test files`);
    console.log('');

    if (this.violations.length > 0) {
      console.log('❌ STRICT MODE VIOLATIONS FOUND:');
      console.log('');
      this.violations.forEach((violation, index) => {
        console.log(`  ${index + 1}. [${violation.type}] ${violation.file}`);
        console.log(`     ${violation.message}`);
        console.log('');
      });

      console.log('');
      console.log('🚨 Test strict mode failed. Please fix violations before proceeding.');
      console.log('');
      console.log('To fix:');
      console.log('  1. Remove .skip extensions from critical test files');
      console.log('  2. Remove describe.skip/it.skip/test.skip from critical test files');
      console.log('  3. Use conditional skips with feature flags if absolutely necessary');
      console.log('  4. Update FAILING_TEST_TRACKER.md with linked TODOs for any approved skips');
    } else if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS (non-critical):');
      console.log('');
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. [${warning.type}] ${warning.file}`);
        console.log(`     ${warning.message}`);
      });
      console.log('');
    } else {
      console.log('✅ No violations or warnings found.');
    }

    console.log('');
  }

  async runTests(testType) {
    try {
      let command;
      switch (testType) {
        case 'unit':
          command = 'pnpm run test:unit';
          break;
        case 'integration':
          command = 'pnpm run test:integration';
          break;
        case 'e2e':
          command = 'pnpm run test:e2e';
          break;
        case 'all':
        default:
          command = 'pnpm run test:all';
          break;
      }

      console.log(`Running: ${command}`);
      execSync(command, {
        cwd: ROOT,
        stdio: 'inherit',
      });

      console.log('');
      console.log('✅ All tests passed in strict mode.');
    } catch (error) {
      console.error('');
      console.error('❌ Tests failed.');
      process.exit(1);
    }
  }
}

// Run the strict mode checker
const testType = process.argv[2] || 'all';
const runner = new TestStrictRunner();
runner.run(testType);
