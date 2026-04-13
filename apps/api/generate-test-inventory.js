#!/usr/bin/env node
/**
 * Generate detailed test inventory from Jest output
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Run Jest with JSON output
console.log('Running Jest tests to collect data...');
let jsonOutput;
try {
  const result = execSync(
    'npx jest --testPathPatterns="modules" --no-coverage --json --silent 2>/dev/null',
    { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, cwd: __dirname }
  );
  jsonOutput = JSON.parse(result);
} catch (error) {
  // Try to parse even if there's an error
  try {
    jsonOutput = JSON.parse(error.stdout || error.message);
  } catch {
    console.error('Failed to parse Jest JSON output');
    process.exit(1);
  }
}

// Generate inventory
const inventory = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalTestSuites: jsonOutput.numTotalTestSuites,
    passedSuites: jsonOutput.numPassedTestSuites,
    failedSuites: jsonOutput.numFailedTestSuites,
    pendingSuites: jsonOutput.numPendingTestSuites,
    totalTests: jsonOutput.numTotalTests,
    passedTests: jsonOutput.numPassedTests,
    failedTests: jsonOutput.numFailedTests,
    pendingTests: jsonOutput.numPendingTests,
  },
  testSuites: []
};

// Process each test suite
if (jsonOutput.testResults) {
  for (const suite of jsonOutput.testResults) {
    const suiteData = {
      name: path.relative(__dirname, suite.name),
      status: suite.status,
      stats: {
        total: suite.assertionResults?.length || 0,
        passed: suite.assertionResults?.filter(r => r.status === 'passed').length || 0,
        failed: suite.assertionResults?.filter(r => r.status === 'failed').length || 0,
        skipped: suite.assertionResults?.filter(r => r.status === 'pending').length || 0,
      },
      duration: suite.perfStats?.runtime || 0,
      failingTests: []
    };

    // Collect failing test details
    if (suite.assertionResults) {
      for (const test of suite.assertionResults) {
        if (test.status === 'failed') {
          suiteData.failingTests.push({
            name: test.fullName || test.title,
            failureMessages: test.failureMessages || []
          });
        }
      }
    }

    inventory.testSuites.push(suiteData);
  }
}

// Sort by status (failed first, then skipped, then passed)
inventory.testSuites.sort((a, b) => {
  const statusOrder = { failed: 0, pending: 1, passed: 2 };
  return statusOrder[a.status] - statusOrder[b.status];
});

// Generate markdown report
let report = `# Test Inventory Report
Generated: ${inventory.generatedAt}

## Summary
| Metric | Count |
|--------|-------|
| Total Test Suites | ${inventory.summary.totalTestSuites} |
| ✅ Passed Suites | ${inventory.summary.passedSuites} |
| ❌ Failed Suites | ${inventory.summary.failedSuites} |
| ⏸️ Pending/Skipped Suites | ${inventory.summary.pendingSuites} |
| **Total Tests** | **${inventory.summary.totalTests}** |
| **Passed Tests** | ${inventory.summary.passedTests} |
| **Failed Tests** | ${inventory.summary.failedTests} |
| **Skipped Tests** | ${inventory.summary.pendingTests} |

## Test Suite Details

| File | Status | Total | Passed | Failed | Skipped | Duration (ms) |
|------|--------|-------|--------|--------|---------|---------------|
`;

for (const suite of inventory.testSuites) {
  const statusIcon = suite.status === 'passed' ? '✅' : suite.status === 'failed' ? '❌' : '⏸️';
  report += `| ${suite.name} | ${statusIcon} ${suite.status} | ${suite.stats.total} | ${suite.stats.passed} | ${suite.stats.failed} | ${suite.stats.skipped} | ${suite.duration.toFixed(0)} |\n`;
}

// Add failing test details
const failedSuites = inventory.testSuites.filter(s => s.status === 'failed');
if (failedSuites.length > 0) {
  report += `\n## Failing Test Details\n\n`;
  for (const suite of failedSuites) {
    if (suite.failingTests.length > 0) {
      report += `### ${suite.name}\n`;
      for (const test of suite.failingTests.slice(0, 5)) { // Limit to first 5 failures
        const errorSummary = test.failureMessages[0]?.split('\n')[0]?.substring(0, 100) || 'Unknown error';
        report += `- **${test.name}**\n  - Error: ${errorSummary}${test.failureMessages[0]?.length > 100 ? '...' : ''}\n`;
      }
      if (suite.failingTests.length > 5) {
        report += `- ... and ${suite.failingTests.length - 5} more failing tests\n`;
      }
      report += `\n`;
    }
  }
}

// Write JSON inventory
const jsonPath = path.join(__dirname, 'test-inventory.json');
fs.writeFileSync(jsonPath, JSON.stringify(inventory, null, 2));
console.log(`JSON inventory written to: ${jsonPath}`);

// Write markdown report
const reportPath = path.join(__dirname, 'TEST_INVENTORY.md');
fs.writeFileSync(reportPath, report);
console.log(`Markdown report written to: ${reportPath}`);

console.log('\nSummary:');
console.log(`- Total Suites: ${inventory.summary.totalTestSuites}`);
console.log(`- Passed: ${inventory.summary.passedSuites}`);
console.log(`- Failed: ${inventory.summary.failedSuites}`);
console.log(`- Skipped: ${inventory.summary.pendingSuites}`);
