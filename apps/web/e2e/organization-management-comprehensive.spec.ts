import { test, expect } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";

/**
 * Organization Management E2E Tests
 * 
 * Tests complete organization workflow:
 * - Organization creation and setup
 * - Member management and roles
 * - Organization listings management
 * - Settings and permissions
 * - Organization analytics and reporting
 */

test.describe("Organization Management", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
  });

  test.describe("Organization Creation", () => {
    test("should create new organization step by step", async ({ page }) => {
      // Login as owner
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to organization creation
      await page.goto("/organizations/new");
      
      // Should show organization creation form
      await expect(page.locator("h1")).toContainText(/Create Organization/i);
      
      // Step 1: Basic information
      await expect(page.locator('[data-testid="org-basic-info"]')).toBeVisible();
      
      await page.fill('[data-testid="org-name"]', "Test Rental Company");
      await page.fill('[data-testid="org-description"]', "Professional property management company");
      await page.selectOption('[data-testid="org-type"]', "property-management");
      await page.fill('[data-testid="org-phone"]', "+977-1-2345678");
      await page.fill('[data-testid="org-email"]', "info@testrental.com");
      await page.fill('[data-testid="org-website"]', "https://testrental.com");
      
      await page.click('[data-testid="continue-to-address"]');
      
      // Step 2: Address information
      await expect(page.locator('[data-testid="org-address-form"]')).toBeVisible();
      
      await page.fill('[data-testid="org-street"]', "Thamel, Kathmandu");
      await page.fill('[data-testid="org-city"]', "Kathmandu");
      await page.fill('[data-testid="org-state"]', "Bagmati");
      await page.fill('[data-testid="org-postal"]', "44600");
      await page.selectOption('[data-testid="org-country"]', "NP");
      
      await page.click('[data-testid="continue-to-documents"]');
      
      // Step 3: Document upload
      await expect(page.locator('[data-testid="org-documents"]')).toBeVisible();
      
      // Upload business registration
      const registrationUpload = page.locator('[data-testid="registration-upload"]');
      if (await registrationUpload.isVisible()) {
        const fileInput = registrationUpload.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: 'business-registration.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('fake pdf content')
        });
        
        await expect(registrationUpload.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
      }
      
      await page.click('[data-testid="continue-to-review"]');
      
      // Step 4: Review and submit
      await expect(page.locator('[data-testid="org-review"]')).toBeVisible();
      await expect(page.locator('[data-testid="org-summary"]')).toBeVisible();
      
      // Verify all information is displayed
      await expect(page.locator('text=Test Rental Company')).toBeVisible();
      await expect(page.locator('text=Thamel, Kathmandu')).toBeVisible();
      
      await page.click('[data-testid="submit-organization"]');
      
      // Success confirmation
      await expect(page.locator('[data-testid="org-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="org-id"]')).toBeVisible();
      
      // Should redirect to organization dashboard
      await expect(page).toHaveURL(/.*\/organizations\/[^\/]+/);
    });

    test("should validate required fields", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations/new");
      
      // Try to continue without required fields
      await page.click('[data-testid="continue-to-address"]');
      
      // Should show validation errors
      await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="type-error"]')).toBeVisible();
      
      // Fill partial info and try again
      await page.fill('[data-testid="org-name"]', "Test Org");
      await page.click('[data-testid="continue-to-address"]');
      
      // Should show remaining errors
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="type-error"]')).toBeVisible();
    });

    test("should check for duplicate organization names", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations/new");
      
      // Try to use existing organization name
      await page.fill('[data-testid="org-name"]', "Existing Organization");
      await page.fill('[data-testid="org-email"]', "new@test.com");
      await page.selectOption('[data-testid="org-type"]', "property-management");
      
      await page.click('[data-testid="continue-to-address"]');
      
      // Should show duplicate name error
      await expect(page.locator('[data-testid="duplicate-name-error"]')).toBeVisible();
    });
  });

  test.describe("Organization Dashboard", () => {
    test("should display organization overview", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to existing organization
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      const orgCount = await orgCards.count();
      
      if (orgCount > 0) {
        await orgCards.first().click();
        
        // Should show organization dashboard
        await expect(page.locator("h1")).toContainText(/Organization Dashboard/i);
        
        // Should show overview cards
        await expect(page.locator('[data-testid="overview-stats"]')).toBeVisible();
        await expect(page.locator('[data-testid="total-listings"]')).toBeVisible();
        await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
        await expect(page.locator('[data-testid="active-bookings"]')).toBeVisible();
        await expect(page.locator('[data-testid="team-members"]')).toBeVisible();
        
        // Should show quick actions
        await expect(page.locator('[data-testid="quick-actions"]')).toBeVisible();
        await expect(page.locator('[data-testid="add-listing-btn"]')).toBeVisible();
        await expect(page.locator('[data-testid="invite-member-btn"]')).toBeVisible();
      }
    });

    test("should show organization analytics", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        
        // Navigate to analytics
        const analyticsTab = page.locator('[data-testid="analytics-tab"]');
        if (await analyticsTab.isVisible()) {
          await analyticsTab.click();
          
          // Should show analytics dashboard
          await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
          await expect(page.locator('[data-testid="occupancy-chart"]')).toBeVisible();
          await expect(page.locator('[data-testid="booking-trends"]')).toBeVisible();
          
          // Should have date range selector
          await expect(page.locator('[data-testid="date-range-selector"]')).toBeVisible();
          
          // Test date range selection
          await page.selectOption('[data-testid="date-range"]', "last-30-days");
          await page.click('[data-testid="apply-date-range"]');
          
          // Should update charts
          await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
        }
      }
    });
  });

  test.describe("Member Management", () => {
    test("should invite and manage organization members", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        
        // Navigate to members
        await page.goto("/organizations/test-org/members");
        
        // Should show members list
        await expect(page.locator('[data-testid="members-list"]')).toBeVisible();
        await expect(page.locator('[data-testid="invite-member-btn"]')).toBeVisible();
        
        // Invite new member
        await page.click('[data-testid="invite-member-btn"]');
        
        await expect(page.locator('[data-testid="invite-form"]')).toBeVisible();
        
        await page.fill('[data-testid="member-email"]', "newmember@example.com");
        await page.selectOption('[data-testid="member-role"]', "manager");
        await page.fill('[data-testid="invite-message"]', "Welcome to our organization!");
        
        await page.click('[data-testid="send-invitation"]');
        
        // Should show success message
        await expect(page.locator('[data-testid="invitation-sent"]')).toBeVisible();
        
        // Should show pending invitation
        await expect(page.locator('[data-testid="pending-invitation"]')).toBeVisible();
      }
    });

    test("should manage member roles and permissions", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        await page.goto("/organizations/test-org/members");
        
        // Find existing member
        const memberRows = page.locator('[data-testid="member-row"]');
        const memberCount = await memberRows.count();
        
        if (memberCount > 0) {
          const firstMember = memberRows.first();
          
          // Change member role
          const roleDropdown = firstMember.locator('[data-testid="member-role-select"]');
          if (await roleDropdown.isVisible()) {
            await roleDropdown.click();
            await page.locator('[data-testid="role-admin"]').click();
            
            // Should show confirmation
            await expect(page.locator('[data-testid="role-change-confirmation"]')).toBeVisible();
            await page.locator('[data-testid="confirm-role-change"]').click();
            
            // Should update role
            await expect(firstMember.locator('text=Admin')).toBeVisible();
          }
          
          // Remove member
          const removeBtn = firstMember.locator('[data-testid="remove-member"]');
          if (await removeBtn.isVisible()) {
            await removeBtn.click();
            
            await expect(page.locator('[data-testid="remove-confirmation"]')).toBeVisible();
            await page.locator('[data-testid="confirm-remove"]').click();
            
            // Should remove member
            await expect(firstMember).not.toBeVisible();
          }
        }
      }
    });

    test("should handle pending invitations", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        await page.goto("/organizations/test-org/members");
        
        // Check for pending invitations section
        const pendingSection = page.locator('[data-testid="pending-invitations"]');
        if (await pendingSection.isVisible()) {
          const pendingInvites = pendingSection.locator('[data-testid="pending-invite"]');
          const pendingCount = await pendingInvites.count();
          
          if (pendingCount > 0) {
            const firstInvite = pendingInvites.first();
            
            // Resend invitation
            const resendBtn = firstInvite.locator('[data-testid="resend-invite"]');
            if (await resendBtn.isVisible()) {
              await resendBtn.click();
              await expect(page.locator('[data-testid="invite-resent"]')).toBeVisible();
            }
            
            // Cancel invitation
            const cancelBtn = firstInvite.locator('[data-testid="cancel-invite"]');
            if (await cancelBtn.isVisible()) {
              await cancelBtn.click();
              await expect(page.locator('[data-testid="cancel-confirmation"]')).toBeVisible();
              await page.locator('[data-testid="confirm-cancel"]').click();
              
              await expect(firstInvite).not.toBeVisible();
            }
          }
        }
      }
    });
  });

  test.describe("Organization Listings", () => {
    test("should manage organization listings", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        await page.goto("/organizations/test-org/listings");
        
        // Should show organization listings
        await expect(page.locator('[data-testid="org-listings"]')).toBeVisible();
        await expect(page.locator('[data-testid="add-listing-btn"]')).toBeVisible();
        
        // Check listing cards
        const listingCards = page.locator('[data-testid="listing-card"]');
        const listingCount = await listingCards.count();
        
        if (listingCount > 0) {
          const firstListing = listingCards.first();
          
          // Should show listing details
          await expect(firstListing.locator('[data-testid="listing-title"]')).toBeVisible();
          await expect(firstListing.locator('[data-testid="listing-status"]')).toBeVisible();
          await expect(firstListing.locator('[data-testid="listing-revenue"]')).toBeVisible();
          
          // Edit listing
          const editBtn = firstListing.locator('[data-testid="edit-listing"]');
          if (await editBtn.isVisible()) {
            await editBtn.click();
            await expect(page).toHaveURL(/.*\/listings\/[^\/]+\/edit/);
          }
        }
        
        // Add new listing
        await page.click('[data-testid="add-listing-btn"]');
        await expect(page).toHaveURL(/.*\/listings\/new/);
        await expect(page.locator('[data-testid="listing-form"]')).toBeVisible();
      }
    });

    test("should show listing performance metrics", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        await page.goto("/organizations/test-org/listings");
        
        const listingCards = page.locator('[data-testid="listing-card"]');
        if (await listingCards.first().isVisible()) {
          const firstListing = listingCards.first();
          
          // Click on listing to view details
          await firstListing.click();
          
          // Should show listing performance
          await expect(page.locator('[data-testid="listing-performance"]')).toBeVisible();
          await expect(page.locator('[data-testid="occupancy-rate"]')).toBeVisible();
          await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
          await expect(page.locator('[data-testid="booking-history"]')).toBeVisible();
        }
      }
    });

    test("should bulk manage listings", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        await page.goto("/organizations/test-org/listings");
        
        // Select multiple listings
        const listingCards = page.locator('[data-testid="listing-card"]');
        const listingCount = await listingCards.count();
        
        if (listingCount > 1) {
          // Select first two listings
          await listingCards.first().locator('[data-testid="listing-checkbox"]').click();
          await listingCards.nth(1).locator('[data-testid="listing-checkbox"]').click();
          
          // Should show bulk actions
          await expect(page.locator('[data-testid="bulk-actions"]')).toBeVisible();
          
          // Test bulk action
          const bulkActionBtn = page.locator('[data-testid="bulk-update"]');
          if (await bulkActionBtn.isVisible()) {
            await bulkActionBtn.click();
            
            await expect(page.locator('[data-testid="bulk-update-modal"]')).toBeVisible();
            
            // Select bulk action type
            await page.selectOption('[data-testid="bulk-action-type"]', "update-price");
            await page.fill('[data-testid="price-adjustment"]', "10");
            await page.locator('[data-testid="apply-bulk-update"]').click();
            
            // Should show success
            await expect(page.locator('[data-testid="bulk-update-success"]')).toBeVisible();
          }
        }
      }
    });
  });

  test.describe("Organization Settings", () => {
    test("should manage organization settings", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        await page.goto("/organizations/test-org/settings");
        
        // Should show settings tabs
        await expect(page.locator('[data-testid="settings-tabs"]')).toBeVisible();
        
        // General settings
        await expect(page.locator('[data-testid="general-settings"]')).toBeVisible();
        await expect(page.locator('[data-testid="org-name-input"]')).toBeVisible();
        await expect(page.locator('[data-testid="org-description-input"]')).toBeVisible();
        
        // Update organization info
        await page.fill('[data-testid="org-description-input"]', "Updated description");
        await page.click('[data-testid="save-settings"]');
        
        await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();
        
        // Notification settings
        const notificationTab = page.locator('[data-testid="notification-settings"]');
        if (await notificationTab.isVisible()) {
          await notificationTab.click();
          
          await expect(page.locator('[data-testid="notification-preferences"]')).toBeVisible();
          
          // Update notification preferences
          await page.check('[data-testid="email-notifications"]');
          await page.check('[data-testid="sms-notifications"]');
          await page.click('[data-testid="save-notifications"]');
          
          await expect(page.locator('[data-testid="notifications-saved"]')).toBeVisible();
        }
      }
    });

    test("should manage billing and subscription", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        await page.goto("/organizations/test-org/settings");
        
        const billingTab = page.locator('[data-testid="billing-settings"]');
        if (await billingTab.isVisible()) {
          await billingTab.click();
          
          // Should show billing information
          await expect(page.locator('[data-testid="billing-plan"]')).toBeVisible();
          await expect(page.locator('[data-testid="billing-history"]')).toBeVisible();
          await expect(page.locator('[data-testid="payment-methods"]')).toBeVisible();
          
          // Update payment method
          const addPaymentBtn = page.locator('[data-testid="add-payment-method"]');
          if (await addPaymentBtn.isVisible()) {
            await addPaymentBtn.click();
            
            await expect(page.locator('[data-testid="payment-form"]')).toBeVisible();
            
            await page.selectOption('[data-testid="card-type"]', "visa");
            await page.fill('[data-testid="card-number"]', "4242424242424242");
            await page.fill('[data-testid="card-expiry"]', "12/25");
            await page.fill('[data-testid="card-cvc"]', "123");
            
            await page.click('[data-testid="save-payment-method"]');
            
            await expect(page.locator('[data-testid="payment-added"]')).toBeVisible();
          }
        }
      }
    });

    test("should manage organization permissions", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        await page.goto("/organizations/test-org/settings");
        
        const permissionsTab = page.locator('[data-testid="permissions-settings"]');
        if (await permissionsTab.isVisible()) {
          await permissionsTab.click();
          
          // Should show role permissions
          await expect(page.locator('[data-testid="role-permissions"]')).toBeVisible();
          
          const roleRows = page.locator('[data-testid="role-row"]');
          const roleCount = await roleRows.count();
          
          if (roleCount > 0) {
            const firstRole = roleRows.first();
            
            // Edit role permissions
            const editPermissionsBtn = firstRole.locator('[data-testid="edit-permissions"]');
            if (await editPermissionsBtn.isVisible()) {
              await editPermissionsBtn.click();
              
              await expect(page.locator('[data-testid="permissions-form"]')).toBeVisible();
              
              // Toggle permissions
              await page.check('[data-testid="permission-manage-listings"]');
              await page.uncheck('[data-testid="permission-manage-members"]');
              
              await page.click('[data-testid="save-permissions"]');
              
              await expect(page.locator('[data-testid="permissions-updated"]')).toBeVisible();
            }
          }
        }
      }
    });
  });

  test.describe("Organization Reports", () => {
    test("should generate and export reports", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        
        // Navigate to reports
        const reportsTab = page.locator('[data-testid="reports-tab"]');
        if (await reportsTab.isVisible()) {
          await reportsTab.click();
          
          // Should show report options
          await expect(page.locator('[data-testid="report-types"]')).toBeVisible();
          
          // Generate financial report
          await page.click('[data-testid="financial-report"]');
          
          await expect(page.locator('[data-testid="report-filters"]')).toBeVisible();
          
          // Set report parameters
          await page.selectOption('[data-testid="report-period"]', "monthly");
          await page.fill('[data-testid="start-date"]', "2025-01-01");
          await page.fill('[data-testid="end-date"]', "2025-12-31");
          
          await page.click('[data-testid="generate-report"]');
          
          // Should show report preview
          await expect(page.locator('[data-testid="report-preview"]')).toBeVisible();
          
          // Export report
          await page.click('[data-testid="export-report"]');
          await page.selectOption('[data-testid="export-format"]', "excel");
          await page.locator('[data-testid="confirm-export"]').click();
          
          // Should trigger download
          const downloadPromise = page.waitForEvent('download');
          await downloadPromise;
        }
      }
    });

    test("should show organization performance metrics", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        
        const reportsTab = page.locator('[data-testid="reports-tab"]');
        if (await reportsTab.isVisible()) {
          await reportsTab.click();
          
          // Should show performance metrics
          await expect(page.locator('[data-testid="performance-metrics"]')).toBeVisible();
          await expect(page.locator('[data-testid="revenue-growth"]')).toBeVisible();
          await expect(page.locator('[data-testid="occupancy-trends"]')).toBeVisible();
          await expect(page.locator('[data-testid="member-productivity"]')).toBeVisible();
        }
      }
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should work on mobile devices", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      // Should be mobile-friendly
      await expect(page.locator("h1")).toBeVisible();
      
      const orgCards = page.locator('[data-testid="organization-card"]');
      if (await orgCards.first().isVisible()) {
        await orgCards.first().click();
        
        // Test mobile navigation
        const mobileNav = page.locator('[data-testid="mobile-nav"]');
        if (await mobileNav.isVisible()) {
          await mobileNav.click();
          await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
        }
        
        // Test mobile member management
        await page.goto("/organizations/test-org/members");
        await expect(page.locator('[data-testid="members-list"]')).toBeVisible();
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should be accessible with keyboard navigation", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Test ARIA labels
      const interactiveElements = page.locator('button, input, select, textarea, a[href]');
      const count = await interactiveElements.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = interactiveElements.nth(i);
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });

    test("should support screen readers", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/organizations");
      
      // Check for proper heading structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);
      
      // Check for landmark regions
      const landmarks = page.locator('main, nav, header, footer, section, article');
      const landmarkCount = await landmarks.count();
      expect(landmarkCount).toBeGreaterThan(0);
    });
  });
});
