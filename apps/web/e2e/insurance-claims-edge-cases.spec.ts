import { test, expect } from '@playwright/test';

/**
 * INSURANCE CLAIMS EDGE CASES E2E TESTS
 * 
 * These tests validate insurance claims edge cases and error scenarios:
 * - Duplicate claim prevention
 * - Claim deadline enforcement
 * - Document limits and validation
 * - Claims fraud detection
 * - Appeal processes
 * 
 * Business Truth Validated:
 * - Duplicate claims are prevented
 * - Claim deadlines are enforced
 * - Document limits are respected
 * - Fraud detection works properly
 * - Appeal processes function correctly
 */

test.describe('Insurance Claims Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    // Login as insured user
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('insured@example.com');
    await page.locator('[data-testid="password-input"]').fill('password123');
    await page.locator('[data-testid="login-button"]').click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should prevent duplicate claims', async ({ page }) => {
    // Submit first claim
    await page.goto('/insurance/claims/new');
    
    await page.locator('[data-testid="policy-selector"]').click();
    await page.locator('[data-testid="policy-option-rental"]').click();
    
    await page.locator('[data-testid="incident-type-selector"]').click();
    await page.locator('[data-testid="incident-type-damage"]').click();
    
    await page.locator('[data-testid="incident-date-input"]').fill('2024-06-01');
    await page.locator('[data-testid="incident-description"]').fill('Water damage in bathroom');
    await page.locator('[data-testid="incident-location-input"]').fill('Kathmandu, Nepal');
    await page.locator('[data-testid="estimated-amount-input"]').fill('50000');
    
    await page.locator('[data-testid="upload-documents-button"]').click();
    await page.locator('[data-testid="photo-upload-input"]').setInputFiles('test-files/damage-photo-1.jpg');
    await page.locator('[data-testid="receipt-upload-input"]').setInputFiles('test-files/repair-receipt.pdf');
    await page.locator('[data-testid="upload-continue-button"]').click();
    
    await page.locator('[data-testid="terms-checkbox"]').check();
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    await expect(page.locator('[data-testid="claim-confirmation"]')).toBeVisible();
    
    // Try to submit duplicate claim
    await page.goto('/insurance/claims/new');
    
    await page.locator('[data-testid="policy-selector"]').click();
    await page.locator('[data-testid="policy-option-rental"]').click();
    
    await page.locator('[data-testid="incident-type-selector"]').click();
    await page.locator('[data-testid="incident-type-damage"]').click();
    
    await page.locator('[data-testid="incident-date-input"]').fill('2024-06-01');
    await page.locator('[data-testid="incident-description"]').fill('Water damage in bathroom');
    await page.locator('[data-testid="incident-location-input"]').fill('Kathmandu, Nepal');
    await page.locator('[data-testid="estimated-amount-input"]').fill('50000');
    
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    // Should detect duplicate claim
    await expect(page.locator('[data-testid="duplicate-claim-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="existing-claim-reference"]')).toBeVisible();
    await expect(page.locator('[data-testid="duplicate-claim-message"]')).toContainText(
      'A claim with similar details already exists'
    );
    
    // Test options for duplicate claim
    await expect(page.locator('[data-testid="view-existing-claim"]')).toBeVisible();
    await expect(page.locator('[data-testid="continue-anyway"]')).toBeVisible();
    await expect(page.locator('[data-testid="cancel-submission"]')).toBeVisible();
    
    // Test view existing claim
    await page.locator('[data-testid="view-existing-claim"]').click();
    await expect(page).toHaveURL(/\/insurance\/claims\/\w+/);
    
    // Go back and try to continue anyway
    await page.goBack();
    await page.locator('[data-testid="continue-anyway"]').click();
    
    // Should require additional justification
    await expect(page.locator('[data-testid="duplicate-justification"]')).toBeVisible();
    await expect(page.locator('[data-testid="justification-textarea"]')).toBeVisible();
    
    await page.locator('[data-testid="justification-textarea"]').fill(
      'This is a separate incident from the previous claim. Different room was affected.'
    );
    
    await page.locator('[data-testid="submit-with-justification"]').click();
    
    // Should require supervisor approval
    await expect(page.locator('[data-testid="supervisor-approval-required"]')).toBeVisible();
    await expect(page.locator('[data-testid="pending-supervisor-review"]')).toBeVisible();
  });

  test('should enforce claim deadlines', async ({ page }) => {
    // Test claim submission within deadline
    const validDate = new Date();
    validDate.setDate(validDate.getDate() - 10); // 10 days ago
    
    await page.goto('/insurance/claims/new');
    
    await page.locator('[data-testid="policy-selector"]').click();
    await page.locator('[data-testid="policy-option-rental"]').click();
    
    await page.locator('[data-testid="incident-date-input"]').fill(validDate.toISOString().split('T')[0]);
    
    // Should show deadline warning but allow submission
    await expect(page.locator('[data-testid="deadline-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="days-remaining"]')).toContainText('355 days remaining');
    
    // Test claim submission after deadline
    const expiredDate = new Date();
    expiredDate.setFullYear(expiredDate.getFullYear() - 2); // 2 years ago
    
    await page.locator('[data-testid="incident-date-input"]').fill(expiredDate.toISOString().split('T')[0]);
    
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    // Should reject claim due to deadline
    await expect(page.locator('[data-testid="deadline-expired-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="deadline-expired-message"]')).toContainText(
      'Claims must be submitted within 365 days of the incident'
    );
    
    // Test exception request
    await expect(page.locator('[data-testid="request-exception"]')).toBeVisible();
    await page.locator('[data-testid="request-exception"]').click();
    
    await expect(page.locator('[data-testid="exception-request-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="exception-reason"]')).toBeVisible();
    
    await page.locator('[data-testid="exception-reason"]').fill('Unable to submit due to medical emergency');
    await page.locator('[data-testid="exception-details"]').fill(
      'Was hospitalized for 3 months immediately following the incident and unable to file claim.'
    );
    
    await page.locator('[data-testid="submit-exception-request"]').click();
    
    await expect(page.locator('[data-testid="exception-request-submitted"]')).toBeVisible();
    await expect(page.locator('[data-testid="exception-reference"]')).toBeVisible();
  });

  test('should enforce document limits', async ({ page }) => {
    await page.goto('/insurance/claims/new');
    
    // Fill basic claim info
    await page.locator('[data-testid="policy-selector"]').click();
    await page.locator('[data-testid="policy-option-rental"]').click();
    
    await page.locator('[data-testid="incident-type-selector"]').click();
    await page.locator('[data-testid="incident-type-damage"]').click();
    
    await page.locator('[data-testid="incident-date-input"]').fill('2024-06-01');
    await page.locator('[data-testid="incident-description"]').fill('Property damage due to water leak');
    await page.locator('[data-testid="incident-location-input"]').fill('Kathmandu, Nepal');
    await page.locator('[data-testid="estimated-amount-input"]').fill('50000');
    
    // Click upload documents
    await page.locator('[data-testid="upload-documents-button"]').click();
    await expect(page.locator('[data-testid="document-upload-modal"]')).toBeVisible();
    
    // Test file size limit
    await page.locator('[data-testid="photo-upload-input"]').setInputFiles('test-files/large-image.jpg');
    
    await expect(page.locator('[data-testid="file-size-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-size-error"]')).toContainText('File too large');
    
    // Test document count limit
    await page.locator('[data-testid="photo-upload-input"]').setInputFiles([
      'test-files/damage-photo-1.jpg',
      'test-files/damage-photo-2.jpg',
      'test-files/damage-photo-3.jpg',
      'test-files/damage-photo-4.jpg',
      'test-files/damage-photo-5.jpg',
      'test-files/damage-photo-6.jpg'
    ]);
    
    await expect(page.locator('[data-testid="upload-limit-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-limit-error"]')).toContainText('Maximum 5 photos allowed');
    
    // Remove extra photos
    await page.locator('[data-testid="remove-photo-6"]').click();
    await page.locator('[data-testid="remove-photo-5"]').click();
    
    // Test file type validation
    await page.locator('[data-testid="additional-document-upload"]').setInputFiles('test-files/invalid-file.txt');
    
    await expect(page.locator('[data-testid="file-type-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-type-error"]')).toContainText('Invalid file type');
    
    // Test document quality check
    await page.locator('[data-testid="upload-continue-button"]').click();
    await expect(page.locator('[data-testid="document-quality-check"]')).toBeVisible();
    
    // Should detect low quality images
    await expect(page.locator('[data-testid="low-quality-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="quality-improvement-suggestions"]')).toBeVisible();
    
    // Test required documents per claim type
    await expect(page.locator('[data-testid="missing-required-docs-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="required-receipt-missing"]')).toBeVisible();
    
    // Upload required receipt
    await page.locator('[data-testid="receipt-upload-input"]').setInputFiles('test-files/repair-receipt.pdf');
    await page.locator('[data-testid="upload-continue-button"]').click();
    
    // Should pass validation
    await expect(page.locator('[data-testid="document-validation-passed"]')).toBeVisible();
  });

  test('should detect potential fraud', async ({ page }) => {
    // Login as insurance provider
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('provider@insurance.com');
    await page.locator('[data-testid="password-input"]').fill('provider123');
    await page.locator('[data-testid="login-button"]').click();
    
    await page.goto('/insurance/provider');
    
    // Navigate to suspicious claim
    await page.locator('[data-testid="pending-claims"]').click();
    await page.locator('[data-testid="suspicious-claim-indicator"]').first().click();
    
    // Check fraud detection indicators
    await expect(page.locator('[data-testid="fraud-detection"]')).toBeVisible();
    await expect(page.locator('[data-testid="fraud-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="fraud-indicators"]')).toBeVisible();
    
    // Test specific fraud indicators
    await expect(page.locator('[data-testid="indicator-recent-policy"]')).toBeVisible();
    await expect(page.locator('[data-testid="indicator-similar-claims"]')).toBeVisible();
    await expect(page.locator'[data-testid='indicator-unusual-pattern']).toBeVisible();
    
    // Check fraud analysis details
    await page.locator('[data-testid="view-fraud-analysis"]').click();
    await expect(page.locator'[data-testid='fraud-analysis-report']).toBeVisible();
    
    await expect(page.locator'[data-testid='claim-frequency-analysis')).toBeVisible();
    await expect(page.locator'[data-testid='timing-pattern-analysis')).toBeVisible();
    await expect(page.locator'[data-testid='amount-pattern-analysis')).toBeVisible();
    
    // Test fraud investigation workflow
    await page.locator'[data-testid='initiate-investigation')).click();
    await expect(page.locator'[data-testid='investigation-form')).toBeVisible();
    
    await page.locator'[data-testid='investigation-reason')).selectOption('high-fraud-risk');
    await page.locator'[data-testid='investigation-priority')).selectOption('urgent');
    await page.locator'[data-testid='investigation-notes')).fill(
      'Multiple fraud indicators detected. Pattern suggests potential organized fraud activity.'
    );
    
    await page.locator'[data-testid='assign-investigator')).selectOption('senior-investigator');
    await page.locator'[data-testid='submit-investigation')).click();
    
    await expect(page.locator'[data-testid='investigation-initiated')).toBeVisible();
    await expect(page.locator'[data-testid='claim-flagged')).toBeVisible();
    
    // Test fraud prevention measures
    await expect(page.locator'[data-testid='prevention-actions')).toBeVisible();
    await expect(page.locator'[data-testid='payment-hold')).toBeVisible();
    await expect(page.locator'[data-testid='additional-verification')).toBeVisible();
    
    // Enable additional verification
    await page.locator'[data-testid='enable-verification')).click();
    await expect(page.locator'[data-testid='verification-requirements')).toBeVisible();
    
    await page.locator'[data-testid='require-id-verification')).check();
    await page.locator'[data-testid='require-additional-evidence')).check();
    await page.locator'[data-testid='schedule-interview')).check();
    
    await page.locator'[data-testid='save-verification-settings')).click();
    await expect(page.locator'[data-testid='verification-enabled')).toBeVisible();
  });

  test('should handle claim appeals', async ({ page }) => {
    // Login as user with rejected claim
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('rejected@example.com');
    await page.locator'[data-testid='password-input']).fill('password123');
    await page.locator'[data-testid='login-button')).click();
    
    // Navigate to rejected claim
    await page.goto('/insurance/claims');
    await page.locator'[data-testid='rejected-claim']).first().click();
    
    // Check appeal eligibility
    await expect(page.locator'[data-testid='appeal-section')).toBeVisible();
    await expect(page.locator'[data-testid='appeal-deadline')).toBeVisible();
    await expect(page.locator'[data-testid='appeal-instructions')).toBeVisible();
    
    // Test appeal process
    await page.locator'[data-testid='initiate-appeal')).click();
    await expect(page.locator'[data-testid='appeal-form')).toBeVisible();
    
    // Check appeal grounds
    await expect(page.locator'[data-testid='appeal-grounds')).toBeVisible();
    await expect(page.locator'[data-testid='ground-new-evidence')).toBeVisible();
    await expect(page.locator'[data-testid='ground-policy-misinterpretation')).toBeVisible();
    await expect(page.locator'[data-testid='ground-procedural-error')).toBeVisible();
    
    // Select appeal ground
    await page.locator'[data-testid='appeal-ground-selector')).click();
    await page.locator'[data-testid='ground-new-evidence')).click();
    
    // Fill appeal details
    await page.locator'[data-testid='appeal-argument')).fill(
      'The claim was rejected due to insufficient evidence, but I have now obtained additional documentation that proves the damage was covered under the policy.'
    );
    
    // Upload new evidence
    await page.locator'[data-testid='new-evidence-upload')).click();
    await page.locator'[data-testid='evidence-upload-input')).setInputFiles('test-files/new-evidence.pdf');
    await page.locator'[data-testid='evidence-description')).fill('Expert report confirming damage cause and timeline');
    await page.locator'[data-testid='upload-evidence')).click();
    
    // Test appeal review process
    await page.locator'[data-testid='submit-appeal')).click();
    await expect(page.locator'[data-testid='appeal-submission-processing')).toBeVisible();
    
    await expect(page.locator'[data-testid='appeal-submitted')).toBeVisible();
    await expect(page.locator'[data-testid='appeal-reference')).toBeVisible();
    await expect(page.locator'[data-testid='appeal-status']).toContainText('Under Review');
    
    // Check appeal timeline
    await expect(page.locator'[data-testid='appeal-timeline')).toBeVisible();
    await expect(page.locator'[data-testid='step-1-submission')).toBeVisible();
    await expect(page.locator'[data-testid='step-2-review')).toBeVisible();
    await expect(page.locator'[data-testid='step-3-decision')).toBeVisible();
    
    // Test appeal communication
    await expect(page.locator'[data-testid='appeal-communication')).toBeVisible();
    await page.locator'[data-testid='send-message')).click();
    await page.locator'[data-testid='message-input')).fill('Please review the new evidence carefully as it significantly impacts the claim outcome.');
    await page.locator'[data-testid='send-message')).click();
    
    await expect(page.locator'[data-testid='message-sent')).toBeVisible();
    
    // Test appeal status tracking
    await page.locator'[data-testid='refresh-status')).click();
    await expect(page.locator'[data-testid='status-updated')).toBeVisible();
    
    // Test appeal outcome scenarios
    // Mock appeal approval
    await page.goto('/login');
    await page.locator'[data-testid='email-input']).fill('provider@insurance.com');
    await page.locator'[data-testid='password-input']).fill('provider123');
    await page.locator'[data-testid='login-button')).click();
    
    await page.goto('/insurance/provider/appeals');
    await page.locator'[data-testid='appeal-review']).first().click();
    
    await page.locator'[data-testid='approve-appeal')).click();
    await page.locator'[data-testid='approval-reason')).fill('New evidence sufficiently supports claim coverage. Original decision overturned.');
    await page.locator'[data-testid='confirm-approval')).click();
    
    await expect(page.locator'[data-testid='appeal-approved')).toBeVisible();
    
    // Check claim status update
    await expect(page.locator'[data-testid='claim-status-updated')).toBeVisible();
    await expect(page.locator'[data-testid='claim-reinstated')).toBeVisible();
  });

  test('should handle complex claim scenarios', async ({ page }) => {
    // Test multi-policy claim
    await page.goto('/insurance/claims/new');
    
    await page.locator'[data-testid='policy-selector')).click();
    await expect(page.locator'[data-testid='multiple-policies-available')).toBeVisible();
    
    await page.locator'[data-testid='policy-combined')).click();
    await expect(page.locator'[data-testid='policy-coordination')).toBeVisible();
    
    // Test partial coverage scenarios
    await page.locator'[data-testid='incident-type-selector')).click();
    await page.locator'[data-testid='incident-type-partial-damage')).click();
    
    await page.locator'[data-testid='incident-date-input')).fill('2024-06-01');
    await page.locator'[data-testid='incident-description')).fill('Partial damage to property covered under multiple policies');
    await page.locator'[data-testid='estimated-amount-input']).fill('100000');
    
    await page.locator'[data-testid='submit-claim-button')).click();
    
    // Check coverage breakdown
    await expect(page.locator'[data-testid='coverage-breakdown')).toBeVisible();
    await expect(page.locator'[data-testid='policy-1-coverage')).toBeVisible();
    await expect(page.locator'[data-testid='policy-2-coverage')).toBeVisible();
    await expect(page.locator'[data-testid='coordination-benefits')).toBeVisible();
    
    // Test claim modification scenarios
    await page.locator'[data-testid='modify-claim')).click();
    await expect(page.locator'[data-testid='modification-form')).toBeVisible();
    
    await page.locator'[data-testid='modification-reason')).selectOption('additional-damage');
    await page.locator'[data-testid='additional-amount')).fill('25000');
    await page.locator'[data-testid='modification-notes')).fill('Additional damage discovered during repairs');
    
    await page.locator'[data-testid='submit-modification')).click();
    await expect(page.locator'[data-testid='modification-submitted')).toBeVisible();
    
    // Test claim withdrawal
    await page.locator'[data-testid='withdraw-claim')).click();
    await expect(page.locator'[data-testid='withdrawal-confirmation')).toBeVisible();
    
    await page.locator'[data-testid='withdrawal-reason')).fill('Decided to handle repairs independently');
    await page.locator'[data-testid='confirm-withdrawal')).click();
    
    await expect(page.locator'[data-testid='claim-withdrawn')).toBeVisible();
    await expect(page.locator'[data-testid='withdrawal-reference')).toBeVisible();
    
    // Test claim re-opening
    await page.locator'[data-testid='reopen-claim')).click();
    await expect(page.locator'[data-testid='reopening-form')).toBeVisible();
    
    await page.locator'[data-testid='reopening-reason')).fill('New evidence discovered that supports original claim');
    await page.locator'[data-testid='reopening-evidence')).setInputFiles('test-files/new-evidence.pdf');
    await page.locator'[data-testid='submit-reopening')).click();
    
    await expect(page.locator'[data-testid='claim-reopened')).toBeVisible();
    await expect(page.locator'[data-testid='claim-status']).toContainText('Reopened');
  });

  test('should handle international claims', async ({ page }) => {
    // Test international claim submission
    await page.goto('/insurance/claims/new');
    
    await page.locator'[data-testid='policy-selector')).click();
    await page.locator'[data-testid='policy-international')).click();
    
    await page.locator'[data-testid='incident-type-selector')).click();
    await page.locator'[data-testid='incident-type-international')).click();
    
    await page.locator'[data-testid='incident-country')).selectOption('United States');
    await page.locator'[data-testid='incident-city']).fill('New York');
    await page.locator'[data-testid='incident-date-input')).fill('2024-06-01');
    
    await page.locator'[data-testid='incident-description')).fill('Property damage while traveling internationally');
    await page.locator'[data-testid='estimated-amount-input']).fill('50000');
    
    // Test currency conversion
    await expect(page.locator'[data-testid='currency-conversion')).toBeVisible();
    await page.locator'[data-testid='local-currency')).selectOption('USD');
    await expect(page.locator'[data-testid='converted-amount')).toBeVisible();
    
    // Test international documentation requirements
    await page.locator'[data-testid='upload-documents-button')).click();
    await expect(page.locator'[data-testid='international-docs-required')).toBeVisible();
    
    await expect(page.locator'[data-testid='police-report-required')).toBeVisible();
    await expect(page.locator'[data-testid='translation-required')).toBeVisible();
    await expect(page.locator'[data-testid='consulate-verification')).toBeVisible();
    
    // Upload international documents
    await page.locator'[data-testid='police-report-upload')).setInputFiles('test-files/police-report.pdf');
    await page.locator'[data-testid='translation-upload')).setInputFiles('test-files/translation.pdf');
    await page.locator'[data-testid='consulate-upload')).setInputFiles('test-files/consulate-letter.pdf');
    
    await page.locator'[data-testid='upload-continue-button')).click();
    
    // Test international claim processing
    await page.locator'[data-testid='terms-checkbox')).check();
    await page.locator'[data-testid='submit-claim-button')).click();
    
    await expect(page.locator'[data-testid='international-claim-processing')).toBeVisible();
    await expect(page.locator'[data-testid='international-verification')).toBeVisible();
    
    // Test international coordination
    await expect(page.locator'[data-testid='international-coordinator')).toBeVisible();
    await expect(page.locator'[data-testid='local-partner-contact')).toBeVisible();
    
    // Test international payment processing
    await expect(page.locator'[data-testid='international-payment')).toBeVisible();
    await page.locator'[data-testid='payment-method-international')).selectOption('international-transfer');
    await expect(page.locator'[data-testid='exchange-rate-applied')).toBeVisible();
  });

  test('should handle claim analytics and reporting', async ({ page }) => {
    // Login as insurance provider
    await page.goto('/login');
    await page.locator'[data-testid='email-input']).fill('provider@insurance.com');
    await page.locator'[data-testid='password-input']).fill('provider123');
    await page.locator'[data-testid='login-button')).click();
    
    // Navigate to analytics dashboard
    await page.goto('/insurance/analytics');
    
    // Check claim analytics
    await expect(page.locator'[data-testid='claims-overview')).toBeVisible();
    await expect(page.locator'[data-testid='claims-trends')).toBeVisible();
    await expect(page.locator'[data-testid='claims-by-type')).toBeVisible();
    await expect(page.locator'[data-testid='claims-by-region')).toBeVisible();
    
    // Test claim performance metrics
    await expect(page.locator'[data-testid='processing-time-metrics')).toBeVisible();
    await expect(page.locator'[data-testid='approval-rate-metrics')).toBeVisible();
    await expect(page.locator'[data-testid='payout-accuracy-metrics')).toBeVisible();
    
    // Test fraud analytics
    await page.locator'[data-testid='fraud-analytics')).click();
    await expect(page.locator'[data-testid='fraud-trends')).toBeVisible();
    await expect(page.locator'[data-testid='fraud-patterns')).toBeVisible();
    await expect(page.locator'[data-testid='fraud-hotspots')).toBeVisible();
    
    // Test claim reporting
    await page.locator'[data-testid='generate-reports')).click();
    await expect(page.locator'[data-testid='report-options')).toBeVisible();
    
    await page.locator'[data-testid='report-type')).selectOption('monthly-summary');
    await page.locator'[data-testid='report-period')).selectOption('last-30-days');
    await page.locator'[data-testid='include-charts')).check();
    
    await page.locator'[data-testid='generate-report')).click();
    await expect(page.locator'[data-testid='report-generating')).toBeVisible();
    
    await expect(page.locator'[data-testid='report-ready')).toBeVisible();
    await page.locator'[data-testid='download-report')).click();
    await expect(page.locator'[data-testid='report-downloaded')).toBeVisible();
    
    // Test custom analytics
    await page.locator'[data-testid='custom-analytics')).click();
    await expect(page.locator'[data-testid='analytics-builder')).toBeVisible();
    
    await page.locator'[data-testid='metric-selector')).selectOption('claim-frequency');
    await page.locator'[data-testid='dimension-selector')).selectOption('by-policy-type');
    await page.locator'[data-testid='time-range')).selectOption('quarterly');
    
    await page.locator'[data-testid='run-analysis')).click();
    await expect(page.locator'[data-testid='analysis-results')).toBeVisible();
    await expect(page.locator'[data-testid='custom-chart')).toBeVisible();
    
    // Test alert configuration
    await page.locator'[data-testid='analytics-alerts')).click();
    await expect(page.locator'[data-testid='alert-settings')).toBeVisible();
    
    await page.locator'[data-testid='create-alert')).click();
    await page.locator'[data-testid='alert-name')).fill('High Claim Volume Alert');
    await page.locator'[data-testid='alert-condition')).selectOption('claim-count-threshold');
    await page.locator'[data-testid='threshold-value')).fill('100');
    await page.locator'[data-testid='alert-frequency')).selectOption('daily');
    
    await page.locator'[data-testid='save-alert')).click();
    await expect(page.locator'[data-testid='alert-created')).toBeVisible();
  });
});
