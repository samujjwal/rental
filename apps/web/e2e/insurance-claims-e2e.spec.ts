import { test, expect } from '@playwright/test';

/**
 * INSURANCE CLAIMS E2E TESTS
 * 
 * These tests validate the complete insurance claims workflow:
 * - Claims submission process
 * - Document upload functionality
 * - Claims tracking and status updates
 * - Claims review and approval
 * - Communication with insurance providers
 * 
 * Business Truth Validated:
 * - Users can submit insurance claims correctly
 * - Document uploads work properly
 * - Claims are tracked throughout the lifecycle
 * - Insurance providers receive necessary information
 * - Claims processing is efficient and accurate
 */

test.describe('Insurance Claims Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a user with insurance coverage
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('insured@example.com');
    await page.locator('[data-testid="password-input"]').fill('password123');
    await page.locator('[data-testid="login-button"]').click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should navigate to insurance claims section', async ({ page }) => {
    // Navigate to insurance section
    await page.locator('[data-testid="insurance-nav-link"]').click();
    await expect(page).toHaveURL('/insurance');
    
    // Check insurance dashboard
    await expect(page.locator('[data-testid="insurance-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-policies"]')).toBeVisible();
    await expect(page.locator('[data-testid="claims-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-new-claim-button"]')).toBeVisible();
  });

  test('should start a new insurance claim', async ({ page }) => {
    await page.goto('/insurance');
    
    // Click file new claim
    await page.locator('[data-testid="file-new-claim-button"]').click();
    await expect(page).toHaveURL('/insurance/claims/new');
    
    // Check claim form
    await expect(page.locator('[data-testid="claim-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="policy-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="incident-type-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="incident-date-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="incident-description"]')).toBeVisible();
  });

  test('should select policy and claim type', async ({ page }) => {
    await page.goto('/insurance/claims/new');
    
    // Select policy
    await page.locator('[data-testid="policy-selector"]').click();
    await page.locator('[data-testid="policy-option-rental"]').click();
    
    // Select incident type
    await page.locator('[data-testid="incident-type-selector"]').click();
    await page.locator('[data-testid="incident-type-damage"]').click();
    
    // Verify selection
    await expect(page.locator('[data-testid="selected-policy"]')).toContainText('Rental Insurance');
    await expect(page.locator('[data-testid="selected-incident-type"]')).toContainText('Property Damage');
  });

  test('should fill claim details', async ({ page }) => {
    await page.goto('/insurance/claims/new');
    
    // Fill required fields
    await page.locator('[data-testid="policy-selector"]').click();
    await page.locator('[data-testid="policy-option-rental"]').click();
    
    await page.locator('[data-testid="incident-type-selector"]').click();
    await page.locator('[data-testid="incident-type-damage"]').click();
    
    await page.locator('[data-testid="incident-date-input"]').fill('2024-06-01');
    await page.locator('[data-testid="incident-time-input"]').fill('14:30');
    
    await page.locator('[data-testid="incident-location-input"]').fill('Kathmandu, Nepal');
    await page.locator('[data-testid="incident-description"]').fill(
      'Water damage occurred in the bathroom due to a pipe burst. The bathroom floor and walls were damaged, and water leaked to the living room below.'
    );
    
    await page.locator('[data-testid="estimated-amount-input"]').fill('50000');
    
    // Verify form is filled
    await expect(page.locator('[data-testid="incident-date-input"]')).toHaveValue('2024-06-01');
    await expect(page.locator('[data-testid="incident-description"]')).toHaveValue(/Water damage/);
    await expect(page.locator('[data-testid="estimated-amount-input"]')).toHaveValue('50000');
  });

  test('should upload claim documents', async ({ page }) => {
    await page.goto('/insurance/claims/new');
    
    // Fill basic claim info first
    await page.locator('[data-testid="policy-selector"]').click();
    await page.locator('[data-testid="policy-option-rental"]').click();
    
    await page.locator('[data-testid="incident-type-selector"]').click();
    await page.locator('[data-testid="incident-type-damage"]').click();
    
    await page.locator('[data-testid="incident-date-input"]').fill('2024-06-01');
    await page.locator('[data-testid="incident-description"]').fill('Property damage due to water leak');
    
    // Upload documents
    await page.locator('[data-testid="upload-documents-button"]').click();
    await expect(page.locator('[data-testid="document-upload-modal"]')).toBeVisible();
    
    // Upload photos
    await page.locator('[data-testid="photo-upload-input"]').setInputFiles('test-files/damage-photo-1.jpg');
    await page.locator('[data-testid="photo-upload-input"]').setInputFiles('test-files/damage-photo-2.jpg');
    
    // Upload receipts
    await page.locator('[data-testid="receipt-upload-input"]').setInputFiles('test-files/repair-receipt.pdf');
    
    // Upload police report if applicable
    await page.locator('[data-testid="police-report-upload-input"]').setInputFiles('test-files/police-report.pdf');
    
    // Verify uploaded files
    await expect(page.locator('[data-testid="uploaded-photos"]')).toBeVisible();
    await expect(page.locator('[data-testid="uploaded-receipts"]')).toBeVisible();
    await expect(page.locator('[data-testid="uploaded-reports"]')).toBeVisible();
    
    await page.locator('[data-testid="upload-continue-button"]').click();
  });

  test('should validate claim submission', async ({ page }) => {
    await page.goto('/insurance/claims/new');
    
    // Try to submit without required fields
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    // Check validation errors
    await expect(page.locator('[data-testid="validation-errors"]')).toBeVisible();
    await expect(page.locator('[data-testid="policy-required-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="incident-type-required-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="description-required-error"]')).toBeVisible();
    
    // Fill required fields
    await page.locator('[data-testid="policy-selector"]').click();
    await page.locator('[data-testid="policy-option-rental"]').click();
    
    await page.locator('[data-testid="incident-type-selector"]').click();
    await page.locator('[data-testid="incident-type-damage"]').click();
    
    await page.locator('[data-testid="incident-date-input"]').fill('2024-06-01');
    await page.locator('[data-testid="incident-description"]').fill('Property damage incident');
    
    // Now submit should work
    await page.locator('[data-testid="submit-claim-button"]').click();
    await expect(page.locator('[data-testid="claim-submission-success"]')).toBeVisible();
  });

  test('should validate claim submission requirements', async ({ page }) => {
    await page.goto('/insurance/claims/new');
    
    // Test empty form submission
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    // Check all validation errors
    await expect(page.locator('[data-testid="validation-errors"]')).toBeVisible();
    await expect(page.locator('[data-testid="policy-required-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="incident-type-required-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="incident-date-required-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="description-required-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="location-required-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="documents-required-error"]')).toBeVisible();
    
    // Test invalid date format
    await page.locator('[data-testid="policy-selector"]').click();
    await page.locator('[data-testid="policy-option-rental"]').click();
    
    await page.locator('[data-testid="incident-type-selector"]').click();
    await page.locator('[data-testid="incident-type-damage"]').click();
    
    await page.locator('[data-testid="incident-date-input"]').fill('invalid-date');
    await page.locator('[data-testid="incident-description"]').fill('Test claim');
    await page.locator('[data-testid="incident-location-input"]').fill('Test location');
    
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    await expect(page.locator('[data-testid="date-format-error"]')).toBeVisible();
    
    // Test future date validation
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    await page.locator('[data-testid="incident-date-input"]').fill(futureDate.toISOString().split('T')[0]);
    
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    await expect(page.locator('[data-testid="future-date-error"]')).toBeVisible();
    
    // Test past date limit (too old)
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 2);
    await page.locator('[data-testid="incident-date-input"]').fill(oldDate.toISOString().split('T')[0]);
    
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    await expect(page.locator('[data-testid="date-too-old-error"]')).toBeVisible();
    
    // Test description length validation
    await page.locator('[data-testid="incident-date-input"]').fill('2024-06-01');
    await page.locator('[data-testid="incident-description"]').fill('Too short');
    
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    await expect(page.locator('[data-testid="description-too-short-error"]')).toBeVisible();
    
    // Test description too long
    const longDescription = 'x'.repeat(2000);
    await page.locator('[data-testid="incident-description"]').fill(longDescription);
    
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    await expect(page.locator('[data-testid="description-too-long-error"]')).toBeVisible();
    
    // Test estimated amount validation
    await page.locator('[data-testid="incident-description"]').fill('Valid claim description with sufficient length');
    await page.locator('[data-testid="estimated-amount-input"]').fill('0');
    
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    await expect(page.locator('[data-testid="amount-too-low-error"]')).toBeVisible();
    
    // Test amount too high
    await page.locator('[data-testid="estimated-amount-input"]').fill('999999999');
    
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    await expect(page.locator('[data-testid="amount-too-high-error"]')).toBeVisible();
    
    // Test document requirements
    await page.locator('[data-testid="estimated-amount-input"]').fill('50000');
    
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    await expect(page.locator('[data-testid="documents-required-error"]')).toBeVisible();
  });

  test('should handle document upload validation', async ({ page }) => {
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
    
    // Test file type validation
    await page.locator('[data-testid="photo-upload-input"]').setInputFiles('test-files/invalid-file.txt');
    
    await expect(page.locator('[data-testid="file-type-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-type-error"]')).toContainText('Invalid file type');
    
    // Test file size validation
    await page.locator('[data-testid="photo-upload-input"]').setInputFiles('test-files/large-image.jpg');
    
    await expect(page.locator('[data-testid="file-size-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-size-error"]')).toContainText('File too large');
    
    // Test required documents per claim type
    await page.locator('[data-testid="photo-upload-input"]').setInputFiles('test-files/damage-photo-1.jpg');
    
    // Should show missing required documents
    await page.locator('[data-testid="upload-continue-button"]').click();
    
    await expect(page.locator('[data-testid="missing-required-docs-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="required-receipt-missing"]')).toBeVisible();
    
    // Upload required receipt
    await page.locator('[data-testid="receipt-upload-input"]').setInputFiles('test-files/repair-receipt.pdf');
    
    // Test document description requirement
    await page.locator('[data-testid="upload-continue-button"]').click();
    
    await expect(page.locator('[data-testid="document-description-required"]')).toBeVisible();
    
    // Add document description
    await page.locator('[data-testid="photo-description"]').fill('Photo of water damage in bathroom');
    await page.locator('[data-testid="receipt-description"]').fill('Receipt for bathroom repairs');
    
    // Test document quality check
    await page.locator('[data-testid="upload-continue-button"]').click();
    
    await expect(page.locator('[data-testid="document-quality-check"]')).toBeVisible();
    await expect(page.locator('[data-testid="photo-quality-passed"]')).toBeVisible();
    await expect(page.locator('[data-testid="receipt-quality-passed"]')).toBeVisible();
    
    // Test document upload limit
    await page.locator('[data-testid="additional-photo-upload"]').setInputFiles([
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
    
    // Complete upload
    await page.locator('[data-testid="upload-continue-button"]').click();
    await expect(page.locator('[data-testid="document-upload-success"]')).toBeVisible();
  });

  test('should handle claim submission confirmation', async ({ page }) => {
    await page.goto('/insurance/claims/new');
    
    // Complete full claim form
    await page.locator('[data-testid="policy-selector"]').click();
    await page.locator('[data-testid="policy-option-rental"]').click();
    
    await page.locator('[data-testid="incident-type-selector"]').click();
    await page.locator('[data-testid="incident-type-damage"]').click();
    
    await page.locator('[data-testid="incident-date-input"]').fill('2024-06-01');
    await page.locator('[data-testid="incident-time-input"]').fill('14:30');
    await page.locator('[data-testid="incident-location-input"]').fill('Kathmandu, Nepal');
    await page.locator('[data-testid="incident-description"]').fill(
      'Water damage occurred in the bathroom due to a pipe burst. The bathroom floor and walls were damaged, and water leaked to the living room below.'
    );
    await page.locator('[data-testid="estimated-amount-input"]').fill('50000');
    
    // Upload documents
    await page.locator('[data-testid="upload-documents-button"]').click();
    await page.locator('[data-testid="photo-upload-input"]').setInputFiles('test-files/damage-photo-1.jpg');
    await page.locator('[data-testid="photo-description"]').fill('Photo of water damage');
    await page.locator('[data-testid="receipt-upload-input"]').setInputFiles('test-files/repair-receipt.pdf');
    await page.locator('[data-testid="receipt-description"]').fill('Repair receipt');
    await page.locator('[data-testid="upload-continue-button"]').click();
    
    // Test submission confirmation modal
    await page.locator('[data-testid="submit-claim-button"]').click();
    await expect(page.locator('[data-testid="submission-confirmation-modal"]')).toBeVisible();
    
    // Check claim summary in confirmation
    await expect(page.locator('[data-testid="confirmation-policy"]')).toContainText('Rental Insurance');
    await expect(page.locator('[data-testid="confirmation-incident-type"]')).toContainText('Property Damage');
    await expect(page.locator('[data-testid="confirmation-date"]')).toContainText('2024-06-01');
    await expect(page.locator('[data-testid="confirmation-amount"]')).toContainText('50,000');
    await expect(page.locator('[data-testid="confirmation-documents-count"]')).toContainText('2 documents');
    
    // Test terms and conditions
    await expect(page.locator('[data-testid="terms-checkbox"]')).toBeVisible();
    await expect(page.locator('[data-testid="terms-link"]')).toBeVisible();
    
    // Try to submit without accepting terms
    await page.locator('[data-testid="confirm-submission-button"]').click();
    
    await expect(page.locator('[data-testid="terms-required-error"]')).toBeVisible();
    
    // Accept terms
    await page.locator('[data-testid="terms-checkbox"]').check();
    await page.locator('[data-testid="confirm-submission-button"]').click();
    
    // Check submission processing
    await expect(page.locator('[data-testid="claim-submission-processing"]')).toBeVisible();
    await expect(page.locator('[data-testid="submission-progress"]')).toBeVisible();
    
    // Wait for submission completion
    await expect(page.locator('[data-testid="claim-confirmation"]')).toBeVisible();
    
    // Verify confirmation details
    await expect(page.locator('[data-testid="claim-reference-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-status"]')).toContainText('Submitted');
    await expect(page.locator('[data-testid="submission-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="expected-processing-time"]')).toBeVisible();
    
    // Save reference number
    const referenceNumber = await page.locator('[data-testid="claim-reference-number"]').textContent();
    expect(referenceNumber).toMatch(/CLM-\d{8}/);
    
    // Test confirmation email notification
    await expect(page.locator('[data-testid="email-notification-sent"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-email"]')).toContainText('insured@example.com');
    
    // Test SMS notification
    await expect(page.locator('[data-testid="sms-notification-sent"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-phone"]')).toContainText('+977');
    
    // Test next steps information
    await expect(page.locator('[data-testid="next-steps"]')).toBeVisible();
    await expect(page.locator('[data-testid="step-1-review"]')).toBeVisible();
    await expect(page.locator('[data-testid="step-2-assessment"]')).toBeVisible();
    await expect(page.locator="[data-testid='step-3-decision']").toBeVisible();
    
    // Test tracking information
    await expect(page.locator('[data-testid="tracking-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="contact-support"]')).toBeVisible();
    
    // Test download confirmation PDF
    await page.locator('[data-testid="download-confirmation"]').click();
    await expect(page.locator('[data-testid="pdf-downloaded"]')).toBeVisible();
    
    // Test navigation to claims list
    await page.locator('[data-testid="view-all-claims"]').click();
    await expect(page).toHaveURL('/insurance/claims');
    await expect(page.locator('[data-testid="claims-list"]')).toContainText(referenceNumber);
  });

  test('should handle duplicate claim prevention', async ({ page }) => {
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
    await expect(page.locator="[data-testid='justification-textarea']").toBeVisible();
    
    await page.locator('[data-testid="justification-textarea"]').fill(
      'This is a separate incident from the previous claim. Different room was affected.'
    );
    
    await page.locator('[data-testid="submit-with-justification"]').click();
    
    // Should require supervisor approval
    await expect(page.locator('[data-testid="supervisor-approval-required"]')).toBeVisible();
    await expect(page.locator('[data-testid="pending-supervisor-review"]')).toBeVisible();
  });

  test('should handle claim deadline enforcement', async ({ page }) => {
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
    await expect(page.locator="[data-testid='exception-reason']").toBeVisible();
    
    await page.locator('[data-testid="exception-reason"]').fill('Unable to submit due to medical emergency');
    await page.locator('[data-testid="exception-details"]').fill(
      'Was hospitalized for 3 months immediately following the incident and unable to file claim.'
    );
    
    await page.locator('[data-testid="submit-exception-request"]').click();
    
    await expect(page.locator('[data-testid="exception-request-submitted"]')).toBeVisible();
    await expect(page.locator('[data-testid="exception-reference"]')).toBeVisible();
  });

  test('should complete claim submission', async ({ page }) => {
    await page.goto('/insurance/claims/new');
    
    // Complete full claim form
    await page.locator('[data-testid="policy-selector"]').click();
    await page.locator('[data-testid="policy-option-rental"]').click();
    
    await page.locator('[data-testid="incident-type-selector"]').click();
    await page.locator('[data-testid="incident-type-damage"]').click();
    
    await page.locator('[data-testid="incident-date-input"]').fill('2024-06-01');
    await page.locator('[data-testid="incident-time-input"]').fill('14:30');
    await page.locator('[data-testid="incident-location-input"]').fill('Kathmandu, Nepal');
    await page.locator('[data-testid="incident-description"]').fill('Water damage in bathroom due to pipe burst');
    await page.locator('[data-testid="estimated-amount-input"]').fill('50000');
    
    // Upload documents
    await page.locator('[data-testid="upload-documents-button"]').click();
    await page.locator('[data-testid="photo-upload-input"]').setInputFiles('test-files/damage-photo-1.jpg');
    await page.locator('[data-testid="upload-continue-button"]').click();
    
    // Submit claim
    await page.locator('[data-testid="submit-claim-button"]').click();
    
    // Check confirmation
    await expect(page.locator('[data-testid="claim-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-reference-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-status"]')).toContainText('Submitted');
    
    // Save reference number
    const referenceNumber = await page.locator('[data-testid="claim-reference-number"]').textContent();
    expect(referenceNumber).toMatch(/CLM-\d{8}/);
  });

  test('should handle claim review process', async ({ page }) => {
    // Login as insurance provider
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('provider@insurance.com');
    await page.locator('[data-testid="password-input"]').fill('provider123');
    await page.locator('[data-testid="login-button"]').click();
    
    // Navigate to provider dashboard
    await page.goto('/insurance/provider');
    
    // Check pending claims
    await expect(page.locator('[data-testid="pending-claims"]')).toBeVisible();
    await expect(page.locator('[data-testid="pending-claim-item"]').first()).toBeVisible();
    
    // Click on a claim to review
    await page.locator('[data-testid="pending-claim-item"]').first().click();
    await expect(page).toHaveURL(/\/insurance\/provider\/claims\/\w+/);
    
    // Check claim review interface
    await expect(page.locator('[data-testid="claim-review"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-details-review"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-documents-review"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-assessment"]')).toBeVisible();
    
    // Check claim information
    await expect(page.locator('[data-testid="review-policy-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="review-incident-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="review-claim-amount"]')).toBeVisible();
    
    // Test document review
    await expect(page.locator('[data-testid="document-viewer"]')).toBeVisible();
    await expect(page.locator('[data-testid="document-thumbnail"]').first()).toBeVisible();
    
    // View document details
    await page.locator('[data-testid="document-thumbnail"]').first().click();
    await expect(page.locator('[data-testid="document-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="document-zoom-controls"]')).toBeVisible();
    
    // Test document annotations
    await page.locator('[data-testid="add-annotation"]').click();
    await expect(page.locator('[data-testid="annotation-tools"]')).toBeVisible();
    
    await page.locator('[data-testid="annotation-text"]').click();
    await page.locator('[data-testid="annotation-area"]').dragTo(page.locator('[data-testid="document-preview"]'));
    await page.locator('[data-testid="annotation-comment"]').fill('Damage visible in this area');
    await page.locator('[data-testid="save-annotation"]').click();
    
    // Check assessment tools
    await expect(page.locator('[data-testid="damage-assessment"]')).toBeVisible();
    await expect(page.locator('[data-testid="coverage-check"]')).toBeVisible();
    await expect(page.locator('[data-testid="policy-validation"]')).toBeVisible();
    
    // Test damage assessment
    await page.locator('[data-testid="damage-severity"]').selectOption('moderate');
    await page.locator('[data-testid="damage-type"]').selectOption('water-damage');
    await page.locator('[data-testid="damage-location"]').selectOption('bathroom');
    
    // Test coverage check
    await expect(page.locator('[data-testid="coverage-percentage"]')).toBeVisible();
    await expect(page.locator('[data-testid="covered-amount"]')).toBeVisible();
    await expect(page.locator('[data-testid="excess-amount"]')).toBeVisible();
    
    // Test policy validation
    await expect(page.locator('[data-testid="policy-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="premium-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-history"]')).toBeVisible();
    
    // Add review notes
    await page.locator('[data-testid="review-notes"]').fill(
      'Claim reviewed and validated. Water damage confirmed in bathroom. Policy covers water damage incidents. Recommended approval for partial coverage.'
    );
    
    // Save review progress
    await page.locator('[data-testid="save-review-progress"]').click();
    await expect(page.locator('[data-testid="review-saved"]')).toBeVisible();
    
    // Test claim scoring
    await expect(page.locator('[data-testid="claim-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="risk-assessment"]')).toBeVisible();
    await expect(page.locator('[data-testid="fraud-indicators"]')).toBeVisible();
    
    // Check fraud detection
    await expect(page.locator('[data-testid="fraud-check-passed"]')).toBeVisible();
    await expect(page.locator('[data-testid="no-fraud-indicators"]')).toBeVisible();
    
    // Test escalation criteria
    await expect(page.locator('[data-testid="escalation-check"]')).toBeVisible();
    await expect(page.locator('[data-testid="no-escalation-needed"]')).toBeVisible();
  });

  test('should handle claim approval workflow', async ({ page }) => {
    // Login as insurance provider
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('provider@insurance.com');
    await page.locator('[data-testid="password-input"]').fill('provider123');
    await page.locator('[data-testid="login-button"]').click();
    
    await page.goto('/insurance/provider/claims/test-claim-id');
    
    // Complete review first
    await page.locator('[data-testid="damage-severity"]').selectOption('moderate');
    await page.locator('[data-testid="damage-type"]').selectOption('water-damage');
    await page.locator('[data-testid="review-notes"]').fill('Valid claim with proper documentation');
    
    // Test approval process
    await page.locator('[data-testid="approve-claim-button"]').click();
    await expect(page.locator('[data-testid="approval-confirmation"]')).toBeVisible();
    
    // Check approval details
    await expect(page.locator('[data-testid="approval-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="approved-amount"]')).toBeVisible();
    await expect(page.locator('[data-testid="deductible-amount"]')).toBeVisible();
    await expect(page.locator('[data-testid="payout-amount"]')).toBeVisible();
    
    // Test amount adjustment
    await page.locator('[data-testid="adjust-amount"]').click();
    await expect(page.locator('[data-testid="amount-adjustment-form"]')).toBeVisible();
    
    await page.locator('[data-testid="adjustment-reason"]').selectOption('policy-limit');
    await page.locator('[data-testid="adjusted-amount"]').fill('45000');
    await page.locator('[data-testid="adjustment-notes"]').fill('Adjusted based on policy coverage limits');
    
    await page.locator('[data-testid="apply-adjustment"]').click();
    await expect(page.locator('[data-testid="adjustment-applied"]')).toBeVisible();
    
    // Add approval notes
    await page.locator('[data-testid="approval-notes"]').fill(
      'Claim approved for water damage coverage. Amount adjusted based on policy terms and deductible. Documentation verified and complete.'
    );
    
    // Test approval conditions
    await expect(page.locator('[data-testid="approval-conditions"]')).toBeVisible();
    await page.locator('[data-testid="condition-repair-verification"]').check();
    await page.locator('[data-testid="condition-final-inspection"]').check();
    
    // Test payment scheduling
    await expect(page.locator="[data-testid='payment-scheduling']").toBeVisible();
    await page.locator('[data-testid="payment-timing"]').selectOption('immediate');
    await page.locator('[data-testid="payment-method"]').selectOption('bank-transfer');
    
    // Confirm approval
    await page.locator('[data-testid="confirm-approval"]').click();
    await expect(page.locator('[data-testid="approval-processing"]')).toBeVisible();
    
    // Check approval completion
    await expect(page.locator('[data-testid="claim-approved"]')).toBeVisible();
    await expect(page.locator('[data-testid="approval-reference"]')).toBeVisible();
    await expect(page.locator'[data-testid='payment-scheduled']).toBeVisible();
    
    // Test notification to claimant
    await expect(page.locator('[data-testid="claimant-notification"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-sent-to-claimant"]')).toBeVisible();
    await expect(page.locator'[data-testid='sms-sent-to-claimant']).toBeVisible();
    
    // Test approval workflow completion
    await expect(page.locator('[data-testid="workflow-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="next-actions"]')).toBeVisible();
    await expect(page.locator'[data-testid='payment-processing']).toBeVisible();
  });

  test('should handle claim rejection workflow', async ({ page }) => {
    // Login as insurance provider
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('provider@insurance.com');
    await page.locator('[data-testid="password-input"]').fill('provider123');
    await page.locator('[data-testid="login-button"]').click();
    
    await page.goto('/insurance/provider/claims/test-claim-id');
    
    // Test rejection process
    await page.locator('[data-testid="reject-claim-button"]').click();
    await expect(page.locator('[data-testid="rejection-form"]')).toBeVisible();
    
    // Check rejection reasons
    await expect(page.locator('[data-testid="rejection-reasons"]')).toBeVisible();
    await expect(page.locator('[data-testid="reason-not-covered"]')).toBeVisible();
    await expect(page.locator('[data-testid="reason-insufficient-documentation"]')).toBeVisible();
    await expect(page.locator'[data-testid='reason-policy-exclusion']).toBeVisible();
    await expect(page.locator'[data-testid='reason-fraud-suspicion']).toBeVisible();
    
    // Select rejection reason
    await page.locator('[data-testid="rejection-reason-selector"]').click();
    await page.locator('[data-testid="rejection-not-covered"]').click();
    
    // Test reason-specific details
    await expect(page.locator('[data-testid="coverage-details"]')).toBeVisible();
    await expect(page.locator'[data-testid='policy-exclusion-clause']).toBeVisible();
    await expect(page.locator'[data-testid='explanation-text']).toBeVisible();
    
    // Add rejection details
    await page.locator('[data-testid="rejection-explanation"]').fill(
      'This type of water damage is specifically excluded under policy section 4.2.1. The policy only covers sudden and accidental water damage, not gradual leaks or maintenance-related issues.'
    );
    
    // Test evidence requirements
    await expect(page.locator('[data-testid="evidence-requirements"]')).toBeVisible();
    await page.locator('[data-testid="additional-evidence-requested"]').check();
    await page.locator'[data-testid='evidence-deadline"]').fill('2024-07-01');
    
    // Add rejection notes
    await page.locator'[data-testid='internal-notes']).fill(
      'Claim rejected due to policy exclusion. Customer may appeal with additional evidence showing damage was sudden and accidental.'
    );
    
    // Test appeal process information
    await expect(page.locator'[data-testid='appeal-process-info']).toBeVisible();
    await expect(page.locator'[data-testid='appeal-deadline']).toBeVisible();
    await expect(page.locator'[data-testid='appeal-instructions']).toBeVisible();
    
    // Confirm rejection
    await page.locator'[data-testid='confirm-rejection']).click();
    await expect(page.locator'[data-testid='rejection-processing']).toBeVisible();
    
    // Check rejection completion
    await expect(page.locator'[data-testid='claim-rejected')).toBeVisible();
    await expect(page.locator'[data-testid='rejection-reference']).toBeVisible();
    await expect(page.locator'[data-testid='rejection-date']).toBeVisible();
    
    // Test notification to claimant
    await expect(page.locator'[data-testid='claimant-rejection-notification')).toBeVisible();
    await expect(page.locator'[data-testid='rejection-email-sent')).toBeVisible();
    await expect(page.locator'[data-testid='rejection-sms-sent']).toBeVisible();
    
    // Test rejection workflow completion
    await expect(page.locator'[data-testid='rejection-workflow-completed')).toBeVisible();
    await expect(page.locator'[data-testid='appeal-option-available']).toBeVisible();
  });

  test('should handle claim communication', async ({ page }) => {
    // Login as insurance provider
    await page.goto('/login');
    await page.locator'[data-testid='email-input']).fill('provider@insurance.com');
    await page.locator'[data-testid='password-input']).fill('provider123');
    await page.locator'[data-testid='login-button']).click();
    
    await page.goto('/insurance/provider/claims/test-claim-id');
    
    // Check communication section
    await expect(page.locator'[data-testid='claim-communication')).toBeVisible();
    await expect(page.locator'[data-testid='message-thread')).toBeVisible();
    await expect(page.locator'[data-testid='message-input')).toBeVisible();
    
    // Test message templates
    await expect(page.locator'[data-testid='message-templates')).toBeVisible();
    await page.locator'[data-testid='template-selector']).click();
    await expect(page.locator'[data-testid='template-request-info')).toBeVisible();
    await expect(page.locator'[data-testid='template-approval-notice')).toBeVisible();
    await expect(page.locator'[data-testid='template-rejection-notice')).toBeVisible();
    
    // Use approval template
    await page.locator'[data-testid='template-approval-notice')).click();
    await expect(page.locator'[data-testid='template-content')).toBeVisible();
    
    // Customize template
    await page.locator'[data-testid='template-content')).fill(
      'Your claim has been approved! We have processed your claim for water damage and scheduled payment. Please review the approval details and let us know if you have any questions.'
    );
    
    // Test message options
    await expect(page.locator'[data-testid='message-options')).toBeVisible();
    await page.locator'[data-testid='send-email']).check();
    await page.locator'[data-testid='send-sms']).check();
    await page.locator'[data-testid='mark-urgent')).uncheck();
    
    // Send message
    await page.locator'[data-testid='send-message-button')).click();
    await expect(page.locator'[data-testid='message-sent')).toBeVisible();
    
    // Check message history
    await expect(page.locator'[data-testid='message-history')).toBeVisible();
    await expect(page.locator'[data-testid='message-item']).first()).toBeVisible();
    await expect(page.locator'[data-testid='message-timestamp')).first()).toBeVisible();
    await expect(page.locator'[data-testid='message-status')).first()).toBeVisible();
    
    // Test message filtering
    await page.locator'[data-testid='filter-messages')).click();
    await page.locator'[data-testid='filter-sent')).click();
    await expect(page.locator'[data-testid='message-item']).first()).toBeVisible();
    
    // Test message search
    await page.locator'[data-testid='search-messages')).fill('approval');
    await page.locator'[data-testid='search-button')).click();
    await expect(page.locator'[data-testid='search-results')).toBeVisible();
    
    // Test attachment sending
    await page.locator'[data-testid='attach-file')).click();
    await expect(page.locator'[data-testid='file-attachment')).toBeVisible();
    await page.locator'[data-testid='attachment-input')).setInputFiles('test-files/claim-summary.pdf');
    await page.locator'[data-testid='add-attachment')).click();
    
    // Send message with attachment
    await page.locator'[data-testid='message-input')).fill('Please find the claim summary attached');
    await page.locator'[data-testid='send-message-button')).click();
    
    await expect(page.locator'[data-testid='attachment-sent')).toBeVisible();
    
    // Test message notifications
    await expect(page.locator'[data-testid='message-notifications')).toBeVisible();
    await expect(page.locator'[data-testid='new-message-alert')).toBeVisible();
    
    // Test message preferences
    await page.locator'[data-testid='message-preferences')).click();
    await expect(page.locator'[data-testid='notification-settings')).toBeVisible();
    await page.locator'[data-testid='email-notifications')).check();
    await page.locator'[data-testid='sms-notifications')).uncheck();
    await page.locator'[data-testid='save-preferences')).click();
    
    await expect(page.locator'[data-testid='preferences-saved')).toBeVisible();
  });

  test('should handle claim resolution', async ({ page }) => {
    // Login as insurance provider
    await page.goto('/login');
    await page.locator'[data-testid='email-input']).fill('provider@insurance.com');
    await page.locator'[data-testid='password-input']).fill('provider123');
    await page.locator'[data-testid='login-button']).click();
    
    // Navigate to approved claim
    await page.goto('/insurance/provider/claims/approved-claim-id');
    
    // Check resolution section
    await expect(page.locator'[data-testid='claim-resolution')).toBeVisible();
    await expect(page.locator'[data-testid='resolution-status')).toBeVisible();
    await expect(page.locator'[data-testid='resolution-steps')).toBeVisible();
    
    // Test resolution workflow
    await expect(page.locator'[data-testid='step-1-verification')).toBeVisible();
    await expect(page.locator'[data-testid='step-2-payment')).toBeVisible();
    await expect(page.locator'[data-testid='step-3-closure')).toBeVisible();
    
    // Complete verification step
    await page.locator'[data-testid='verify-claim-details')).click();
    await expect(page.locator'[data-testid='verification-checklist')).toBeVisible();
    
    await page.locator'[data-testid='verify-claimant-identity')).check();
    await page.locator'[data-testid='verify-policy-status')).check();
    await page.locator'[data-testid='verify-documentation')).check();
    await page.locator'[data-testid='verify-approval-amount')).check();
    
    await page.locator'[data-testid='complete-verification')).click();
    await expect(page.locator'[data-testid='verification-completed')).toBeVisible();
    
    // Test payment processing
    await page.locator'[data-testid='process-payment')).click();
    await expect(page.locator'[data-testid='payment-details')).toBeVisible();
    
    await expect(page.locator'[data-testid='payment-amount')).toBeVisible();
    await expect(page.locator'[data-testid='payment-method')).toBeVisible();
    await expect(page.locator'[data-testid='payment-schedule')).toBeVisible();
    
    // Confirm payment
    await page.locator'[data-testid='confirm-payment')).click();
    await expect(page.locator'[data-testid='payment-processing')).toBeVisible();
    
    await expect(page.locator'[data-testid='payment-completed')).toBeVisible();
    await expect(page.locator'[data-testid='payment-reference')).toBeVisible();
    
    // Test claim closure
    await page.locator'[data-testid='close-claim')).click();
    await expect(page.locator'[data-testid='closure-checklist')).toBeVisible();
    
    await page.locator'[data-testid='confirm-payment-received')).check();
    await page.locator'[data-testid='confirm-claimant-satisfied')).check();
    await page.locator'[data-testid='confirm-documentation-archived')).check();
    
    // Add closure notes
    await page.locator'[data-testid='closure-notes')).fill(
      'Claim successfully resolved. Payment processed and claimant confirmed satisfaction. All documentation archived according to policy.'
    );
    
    // Complete closure
    await page.locator'[data-testid='complete-closure')).click();
    await expect(page.locator'[data-testid='claim-closed')).toBeVisible();
    
    // Check closure confirmation
    await expect(page.locator'[data-testid='closure-date')).toBeVisible();
    await expect(page.locator'[data-testid='closure-reference')).toBeVisible();
    await expect(page.locator'[data-testid='final-summary')).toBeVisible();
    
    // Test post-resolution follow-up
    await expect(page.locator'[data-testid='follow-up-required')).toBeVisible();
    await page.locator'[data-testid='schedule-follow-up')).check();
    await page.locator'[data-testid='follow-up-date']).fill('2024-07-15');
    await page.locator'[data-testid='follow-up-type')).selectOption('satisfaction-survey');
    
    await page.locator'[data-testid='save-follow-up')).click();
    await expect(page.locator'[data-testid='follow-up-scheduled')).toBeVisible();
    
    // Test resolution reporting
    await expect(page.locator'[data-testid='resolution-report')).toBeVisible();
    await page.locator'[data-testid='generate-report')).click();
    
    await expect(page.locator'[data-testid='report-generated')).toBeVisible();
    await expect(page.locator'[data-testid='download-report')).toBeVisible();
    
    // Test analytics update
    await expect(page.locator'[data-testid='analytics-updated')).toBeVisible();
    await expect(page.locator'[data-testid='metrics-updated')).toBeVisible();
  });

  test('should handle claim payout', async ({ page }) => {
    // Login as insurance provider
    await page.goto('/login');
    await page.locator'[data-testid='email-input']).fill('provider@insurance.com');
    await page.locator'[data-testid='password-input']).fill('provider123');
    await page.locator'[data-testid='login-button')).click();
    
    // Navigate to approved claim
    await page.goto('/insurance/provider/claims/approved-claim-id');
    
    // Check payout section
    await expect(page.locator'[data-testid='claim-payout')).toBeVisible();
    await expect(page.locator'[data-testid='payout-details')).toBeVisible();
    await expect(page.locator'[data-testid='payout-method')).toBeVisible();
    
    // Test payout calculation
    await expect(page.locator'[data-testid='payout-breakdown')).toBeVisible();
    await expect(page.locator'[data-testid='approved-amount')).toBeVisible();
    await expect(page.locator'[data-testid='deductible')).toBeVisible();
    await expect(page.locator'[data-testid='excess']).toBeVisible();
    await expect(page.locator'[data-testid='final-payout')).toBeVisible();
    
    // Verify payout calculation
    const approvedAmount = await page.locator'[data-testid='approved-amount']).textContent();
    const deductible = await page.locator'[data-testid='deductible']).textContent();
    const finalPayout = await page.locator'[data-testid='final-payout')).textContent();
    
    expect(finalPayout).toContain(approvedAmount);
    expect(finalPayout).toContain(deductible);
    
    // Test payout method selection
    await page.locator'[data-testid='payout-method-selector')).click();
    await expect(page.locator'[data-testid='method-bank-transfer')).toBeVisible();
    await expect(page.locator'[data-testid='method-cheque')).toBeVisible();
    await expect(page.locator'[data-testid='method-digital-wallet')).toBeVisible();
    
    // Select bank transfer
    await page.locator'[data-testid='method-bank-transfer')).click();
    await expect(page.locator'[data-testid='bank-details-form')).toBeVisible();
    
    // Fill bank details
    await page.locator'[data-testid='bank-name']).fill('Nabil Bank');
    await page.locator'[data-testid='account-number')).fill('1234567890');
    await page.locator'[data-testid='account-holder']).fill('John Doe');
    await page.locator'[data-testid='branch-code')).fill('001');
    
    // Test bank validation
    await page.locator'[data-testid='validate-bank')).click();
    await expect(page.locator'[data-testid='bank-validated')).toBeVisible();
    
    // Test payout scheduling
    await expect(page.locator'[data-testid='payout-schedule')).toBeVisible();
    await page.locator'[data-testid='schedule-immediate']).click();
    await expect(page.locator'[data-testid='immediate-confirmation')).toBeVisible();
    
    // Test tax withholding
    await expect(page.locator'[data-testid='tax-withholding')).toBeVisible();
    await page.locator'[data-testid='tax-rate')).selectOption('15%');
    await expect(page.locator'[data-testid='tax-amount')).toBeVisible();
    
    // Test payout confirmation
    await page.locator'[data-testid='initiate-payout')).click();
    await expect(page.locator'[data-testid='payout-confirmation')).toBeVisible();
    
    // Check confirmation details
    await expect(page.locator'[data-testid='confirmation-amount')).toBeVisible();
    await expect(page.locator'[data-testid='confirmation-method')).toBeVisible();
    await expect(page.locator'[data-testid='confirmation-timing')).toBeVisible();
    
    // Confirm payout
    await page.locator'[data-testid='confirm-payout')).click();
    await expect(page.locator'[data-testid='payout-processing')).toBeVisible();
    
    // Check payout completion
    await expect(page.locator'[data-testid='payout-completed')).toBeVisible();
    await expect(page.locator'[data-testid='payout-reference')).toBeVisible();
    await expect(page.locator'[data-testid='transaction-id')).toBeVisible();
    
    // Test payout notifications
    await expect(page.locator'[data-testid='payout-notifications')).toBeVisible();
    await expect(page.locator'[data-testid='claimant-notified')).toBeVisible();
    await expect(page.locator'[data-testid='bank-notified')).toBeVisible();
    
    // Test payout receipt
    await expect(page.locator'[data-testid='payout-receipt')).toBeVisible();
    await page.locator'[data-testid='generate-receipt')).click();
    await expect(page.locator'[data-testid='receipt-generated')).toBeVisible();
    await page.locator'[data-testid='download-receipt')).click();
    await expect(page.locator'[data-testid='receipt-downloaded')).toBeVisible();
    
    // Test payout tracking
    await expect(page.locator'[data-testid='payout-tracking')).toBeVisible();
    await expect(page.locator'[data-testid='tracking-status')).toBeVisible();
    await expect(page.locator'[data-testid='estimated-delivery')).toBeVisible();
    
    // Test payout history
    await expect(page.locator'[data-testid='payout-history')).toBeVisible();
    await expect(page.locator'[data-testid='history-item']).first()).toBeVisible();
    await expect(page.locator'[data-testid='history-date']).first()).toBeVisible();
    await expect(page.locator'[data-testid='history-amount']).first()).toBeVisible();
  });

  test('should handle claim status tracking', async ({ page }) => {
    // Go to claims history
    await page.goto('/insurance/claims');
    
    // Check claims list
    await expect(page.locator('[data-testid="claims-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-item"]').first()).toBeVisible();
    
    // Click on a claim
    await page.locator('[data-testid="claim-item"]').first().click();
    await expect(page).toHaveURL(/\/insurance\/claims\/\w+/);
    
    // Check claim details
    await expect(page.locator('[data-testid="claim-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-status-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-timeline"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-documents"]')).toBeVisible();
    
    // Check timeline events
    await expect(page.locator('[data-testid="timeline-submitted"]')).toBeVisible();
    await expect(page.locator('[data-testid="timeline-under-review"]')).toBeVisible();
  });

  test('should communicate with insurance provider', async ({ page }) => {
    await page.goto('/insurance/claims/test-claim-id');
    
    // Check communication section
    await expect(page.locator('[data-testid="claim-communication"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-thread"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
    
    // Send a message
    await page.locator('[data-testid="message-input"]').fill(
      'I have additional photos of the damage that I would like to upload. Please let me know the best way to provide them.'
    );
    await page.locator('[data-testid="send-message-button"]').click();
    
    // Verify message sent
    await expect(page.locator('[data-testid="message-sent"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-timestamp"]')).toBeVisible();
    
    // Check for auto-response
    await page.waitForSelector('[data-testid="provider-response"]', { state: 'visible' });
    await expect(page.locator('[data-testid="provider-response"]')).toBeVisible();
  });

  test('should upload additional documents', async ({ page }) => {
    await page.goto('/insurance/claims/test-claim-id');
    
    // Click upload additional documents
    await page.locator('[data-testid="upload-additional-docs-button"]').click();
    await expect(page.locator('[data-testid="additional-docs-modal"]')).toBeVisible();
    
    // Upload new documents
    await page.locator('[data-testid="additional-photo-upload"]').setInputFiles('test-files/additional-damage-photo.jpg');
    await page.locator('[data-testid="additional-receipt-upload"]').setInputFiles('test-files/additional-receipt.pdf');
    
    // Add description
    await page.locator('[data-testid="document-description"]').fill('Additional photos showing the extent of water damage');
    
    // Submit additional documents
    await page.locator('[data-testid="submit-additional-docs"]').click();
    
    // Verify upload
    await expect(page.locator('[data-testid="additional-docs-uploaded"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-updated-timestamp"]')).toBeVisible();
  });

  test('should handle claim approval', async ({ page }) => {
    // Login as insurance provider
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('provider@insurance.com');
    await page.locator('[data-testid="password-input"]').fill('provider123');
    await page.locator('[data-testid="login-button"]').click();
    
    // Navigate to provider dashboard
    await page.goto('/insurance/provider');
    
    // Check pending claims
    await expect(page.locator('[data-testid="pending-claims"]')).toBeVisible();
    await page.locator('[data-testid="pending-claim-item"]').first().click();
    
    // Review claim details
    await expect(page.locator('[data-testid="claim-review"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-documents-review"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-assessment"]')).toBeVisible();
    
    // Approve claim
    await page.locator('[data-testid="approve-claim-button"]').click();
    await expect(page.locator('[data-testid="approval-confirmation"]')).toBeVisible();
    
    // Add approval notes
    await page.locator('[data-testid="approval-notes"]').fill(
      'Claim approved for water damage. Coverage amount: NPR 45,000 based on policy terms and assessment.'
    );
    await page.locator('[data-testid="confirm-approval"]').click();
    
    // Verify approval
    await expect(page.locator('[data-testid="claim-approved"]')).toBeVisible();
    await expect(page.locator('[data-testid="approval-amount"]')).toContainText('45,000');
  });

  test('should handle claim rejection', async ({ page }) => {
    // Login as insurance provider
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('provider@insurance.com');
    await page.locator('[data-testid="password-input"]').fill('provider123');
    await page.locator('[data-testid="login-button"]').click();
    
    await page.goto('/insurance/provider');
    await page.locator('[data-testid="pending-claim-item"]').nth(1).click();
    
    // Reject claim
    await page.locator('[data-testid="reject-claim-button"]').click();
    await expect(page.locator('[data-testid="rejection-form"]')).toBeVisible();
    
    // Select rejection reason
    await page.locator('[data-testid="rejection-reason-selector"]').click();
    await page.locator('[data-testid="rejection-not-covered"]').click();
    
    // Add rejection details
    await page.locator('[data-testid="rejection-explanation"]').fill(
      'This type of damage is not covered under the current policy terms. Please review your policy document for coverage details.'
    );
    
    // Confirm rejection
    await page.locator('[data-testid="confirm-rejection"]').click();
    await expect(page.locator('[data-testid="claim-rejected"]')).toBeVisible();
  });

  test('should handle claim payment processing', async ({ page }) => {
    // Login as user
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill('insured@example.com');
    await page.locator('[data-testid="password-input"]').fill('password123');
    await page.locator('[data-testid="login-button"]').click();
    
    // Go to approved claim
    await page.goto('/insurance/claims/approved-claim-id');
    
    // Check payment section
    await expect(page.locator('[data-testid="claim-payment"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-amount"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-method-selector"]')).toBeVisible();
    
    // Select payment method
    await page.locator('[data-testid="payment-method-selector"]').click();
    await page.locator('[data-testid="payment-bank-transfer"]').click();
    
    // Fill payment details
    await page.locator('[data-testid="bank-account-input"]').fill('1234567890');
    await page.locator('[data-testid="bank-name-input"]').fill('Nabil Bank');
    await page.locator('[data-testid="account-holder-input"]').fill('John Doe');
    
    // Submit payment request
    await page.locator('[data-testid="submit-payment-request"]').click();
    
    // Verify payment initiated
    await expect(page.locator('[data-testid="payment-initiated"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-reference"]')).toBeVisible();
  });

  test('should display claim history and statistics', async ({ page }) => {
    await page.goto('/insurance');
    
    // Check claims statistics
    await expect(page.locator('[data-testid="claims-statistics"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-claims-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="approved-claims-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="pending-claims-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-payout-amount"]')).toBeVisible();
    
    // Check claims history table
    await expect(page.locator('[data-testid="claims-history-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="claims-table-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="claims-table-row"]').first()).toBeVisible();
    
    // Test filtering
    await page.locator('[data-testid="filter-status-selector"]').click();
    await page.locator('[data-testid="filter-approved"]').click();
    
    await expect(page.locator('[data-testid="claims-table-row"]')).toHaveCount.greaterThan(0);
    
    // Test sorting
    await page.locator('[data-testid="sort-by-date"]').click();
    await expect(page.locator('[data-testid="claims-table-row"]').first()).toBeVisible();
  });

  test('should handle claim appeal process', async ({ page }) => {
    // Go to rejected claim
    await page.goto('/insurance/claims/rejected-claim-id');
    
    // Check appeal option
    await expect(page.locator('[data-testid="appeal-claim-button"]')).toBeVisible();
    await page.locator('[data-testid="appeal-claim-button"]').click();
    
    // Fill appeal form
    await expect(page.locator('[data-testid="appeal-form"]')).toBeVisible();
    await page.locator('[data-testid="appeal-reason"]').selectOption('New Evidence');
    await page.locator('[data-testid="appeal-description"]').fill(
      'I have obtained a professional assessment that confirms the damage was caused by a covered event. I am submitting this new evidence for reconsideration.'
    );
    
    // Upload appeal documents
    await page.locator('[data-testid="appeal-docs-upload"]').setInputFiles('test-files/professional-assessment.pdf');
    
    // Submit appeal
    await page.locator('[data-testid="submit-appeal"]').click();
    
    // Verify appeal submitted
    await expect(page.locator('[data-testid="appeal-submitted"]')).toBeVisible();
    await expect(page.locator('[data-testid="appeal-reference"]')).toBeVisible();
    await expect(page.locator('[data-testid="claim-status"]')).toContainText('Under Appeal');
  });

  test('should handle mobile responsive claims interface', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/insurance/claims');
    
    // Check mobile layout
    await expect(page.locator('[data-testid="mobile-claims-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-claims-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-claim-item"]').first()).toBeVisible();
    
    // Test mobile claim details
    await page.locator('[data-testid="mobile-claim-item"]').first().click();
    await expect(page.locator('[data-testid="mobile-claim-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-claim-timeline"]')).toBeVisible();
    
    // Test mobile document upload
    await page.locator('[data-testid="mobile-upload-button"]').click();
    await expect(page.locator('[data-testid="mobile-upload-modal"]')).toBeVisible();
  });

  test('should handle claim notifications', async ({ page }) => {
    // Enable notifications
    await page.context().grantPermissions(['notifications']);
    
    await page.goto('/insurance/claims');
    
    // Check notification settings
    await page.locator('[data-testid="notification-settings"]').click();
    await expect(page.locator('[data-testid="notification-preferences"]')).toBeVisible();
    
    // Enable claim status notifications
    await page.locator('[data-testid="claim-status-notifications"]').check();
    await page.locator('[data-testid="payment-notifications"]').check();
    await page.locator('[data-testid="save-notification-settings"]').click();
    
    // Verify settings saved
    await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();
  });
});
