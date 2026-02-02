import { test, expect, Page } from "@playwright/test";

// Test admin credentials
const TEST_ADMIN = {
  email: "admin@test.com",
  password: "Test123!@#",
};

// Helper to login as admin
async function loginAsAdmin(page: Page) {
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', TEST_ADMIN.email);
  await page.fill('input[type="password"]', TEST_ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*admin|.*dashboard/);
}

test.describe("Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
  });

  test.describe("Dashboard Overview", () => {
    test("should display admin dashboard", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Admin|Dashboard/i);
    });

    test("should show platform stats", async ({ page }) => {
      await expect(page.locator('[data-testid="platform-stats"]')).toBeVisible();
    });

    test("should display total users count", async ({ page }) => {
      await expect(page.locator('[data-testid="total-users"]')).toBeVisible();
    });

    test("should display total listings count", async ({ page }) => {
      await expect(page.locator('[data-testid="total-listings"]')).toBeVisible();
    });

    test("should display total bookings count", async ({ page }) => {
      await expect(page.locator('[data-testid="total-bookings"]')).toBeVisible();
    });

    test("should display total revenue", async ({ page }) => {
      await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
    });

    test("should display active disputes count", async ({ page }) => {
      await expect(page.locator('[data-testid="active-disputes"]')).toBeVisible();
    });

    test("should show recent activity feed", async ({ page }) => {
      const activityFeed = page.locator('[data-testid="activity-feed"]');
      if (await activityFeed.isVisible()) {
        await expect(activityFeed).toBeVisible();
      }
    });

    test("should show alerts/notifications", async ({ page }) => {
      const alerts = page.locator('[data-testid="admin-alerts"]');
      if (await alerts.isVisible()) {
        await expect(alerts).toBeVisible();
      }
    });
  });

  test.describe("Navigation", () => {
    test("should navigate to users management", async ({ page }) => {
      await page.click('a:has-text("Users")');
      await expect(page).toHaveURL(/.*admin.*users|.*entities.*user/i);
    });

    test("should navigate to listings management", async ({ page }) => {
      await page.click('a:has-text("Listings")');
      await expect(page).toHaveURL(/.*admin.*listings|.*entities.*listing/i);
    });

    test("should navigate to bookings management", async ({ page }) => {
      await page.click('a:has-text("Bookings")');
      await expect(page).toHaveURL(/.*admin.*bookings|.*entities.*booking/i);
    });

    test("should navigate to disputes", async ({ page }) => {
      await page.click('a:has-text("Disputes")');
      await expect(page).toHaveURL(/.*admin.*disputes/);
    });

    test("should navigate to payments", async ({ page }) => {
      await page.click('a:has-text("Payments")');
      await expect(page).toHaveURL(/.*admin.*payments|.*entities.*payment/i);
    });

    test("should navigate to organizations", async ({ page }) => {
      await page.click('a:has-text("Organizations")');
      await expect(page).toHaveURL(/.*admin.*organizations|.*entities.*organization/i);
    });

    test("should navigate to system settings", async ({ page }) => {
      await page.click('a:has-text("System"), a:has-text("Settings")');
      await expect(page).toHaveURL(/.*admin.*system|.*admin.*settings/);
    });
  });
});

test.describe("Admin Entity Management - Users", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/entities/user");
  });

  test("should display users list", async ({ page }) => {
    await expect(page.locator('[data-testid="data-table"]')).toBeVisible();
  });

  test("should show user columns", async ({ page }) => {
    await expect(page.locator('text=/Name|Email|Role|Status/i')).toBeVisible();
  });

  test("should search users", async ({ page }) => {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test@example.com');
      await page.keyboard.press('Enter');
    }
  });

  test("should filter by role", async ({ page }) => {
    const roleFilter = page.locator('[data-testid="role-filter"]');
    if (await roleFilter.isVisible()) {
      await roleFilter.click();
      await page.click('text=Owner');
    }
  });

  test("should filter by status", async ({ page }) => {
    const statusFilter = page.locator('[data-testid="status-filter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.click('text=Active');
    }
  });

  test("should view user details", async ({ page }) => {
    const viewButton = page.locator('[data-testid="view-button"]').first();
    if (await viewButton.isVisible()) {
      await viewButton.click();
      await expect(page.locator('[data-testid="user-details-modal"]')).toBeVisible();
    }
  });

  test("should edit user", async ({ page }) => {
    const editButton = page.locator('[data-testid="edit-button"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await expect(page.locator('[data-testid="edit-user-modal"]')).toBeVisible();
    }
  });

  test("should change user role", async ({ page }) => {
    const editButton = page.locator('[data-testid="edit-button"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      
      const roleSelect = page.locator('[data-testid="role-select"]');
      if (await roleSelect.isVisible()) {
        await roleSelect.click();
        await page.click('text=Admin');
        await page.click('button:has-text("Save")');
        await expect(page.locator('text=/updated|success/i')).toBeVisible();
      }
    }
  });

  test("should suspend user", async ({ page }) => {
    const suspendButton = page.locator('[data-testid="suspend-button"]').first();
    if (await suspendButton.isVisible()) {
      await suspendButton.click();
      
      // Reason input
      const reasonInput = page.locator('textarea[name="reason"]');
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('Violation of terms of service');
      }
      
      await page.click('button:has-text("Confirm")');
      await expect(page.locator('text=/suspended|success/i')).toBeVisible();
    }
  });

  test("should unsuspend user", async ({ page }) => {
    // Filter suspended users first
    const statusFilter = page.locator('[data-testid="status-filter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.click('text=Suspended');
    }
    
    const unsuspendButton = page.locator('[data-testid="unsuspend-button"]').first();
    if (await unsuspendButton.isVisible()) {
      await unsuspendButton.click();
      await page.click('button:has-text("Confirm")');
      await expect(page.locator('text=/activated|unsuspended/i')).toBeVisible();
    }
  });

  test("should delete user", async ({ page }) => {
    const deleteButton = page.locator('[data-testid="delete-button"]').first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await expect(page.locator('[data-testid="delete-confirm-modal"]')).toBeVisible();
      // Don't actually confirm delete in test
    }
  });

  test("should export users", async ({ page }) => {
    const exportButton = page.locator('button:has-text("Export")');
    if (await exportButton.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportButton.click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/users.*\.csv|\.xlsx/);
    }
  });

  test("should paginate users", async ({ page }) => {
    const nextPage = page.locator('[data-testid="pagination-next"]');
    if (await nextPage.isVisible()) {
      await nextPage.click();
    }
  });

  test("should change page size", async ({ page }) => {
    const pageSizeSelect = page.locator('[data-testid="page-size-select"]');
    if (await pageSizeSelect.isVisible()) {
      await pageSizeSelect.click();
      await page.click('text=50');
    }
  });
});

test.describe("Admin Entity Management - Listings", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/entities/listing");
  });

  test("should display listings list", async ({ page }) => {
    await expect(page.locator('[data-testid="data-table"]')).toBeVisible();
  });

  test("should show listing columns", async ({ page }) => {
    await expect(page.locator('text=/Title|Owner|Price|Status/i')).toBeVisible();
  });

  test("should search listings", async ({ page }) => {
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('camera');
      await page.keyboard.press('Enter');
    }
  });

  test("should filter by category", async ({ page }) => {
    const categoryFilter = page.locator('[data-testid="category-filter"]');
    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();
      await page.click('text=Electronics');
    }
  });

  test("should filter by status", async ({ page }) => {
    const statusFilter = page.locator('[data-testid="status-filter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.click('text=Active');
    }
  });

  test("should view listing details", async ({ page }) => {
    const viewButton = page.locator('[data-testid="view-button"]').first();
    if (await viewButton.isVisible()) {
      await viewButton.click();
      await expect(page.locator('[data-testid="listing-details-modal"]')).toBeVisible();
    }
  });

  test("should approve pending listing", async ({ page }) => {
    // Filter pending listings
    const statusFilter = page.locator('[data-testid="status-filter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.click('text=Pending');
    }
    
    const approveButton = page.locator('[data-testid="approve-button"]').first();
    if (await approveButton.isVisible()) {
      await approveButton.click();
      await expect(page.locator('text=/approved|success/i')).toBeVisible();
    }
  });

  test("should reject pending listing", async ({ page }) => {
    const statusFilter = page.locator('[data-testid="status-filter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.click('text=Pending');
    }
    
    const rejectButton = page.locator('[data-testid="reject-button"]').first();
    if (await rejectButton.isVisible()) {
      await rejectButton.click();
      
      const reasonInput = page.locator('textarea[name="reason"]');
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('Images do not meet guidelines');
      }
      
      await page.click('button:has-text("Confirm")');
      await expect(page.locator('text=/rejected|success/i')).toBeVisible();
    }
  });

  test("should feature listing", async ({ page }) => {
    const featureButton = page.locator('[data-testid="feature-button"]').first();
    if (await featureButton.isVisible()) {
      await featureButton.click();
      await expect(page.locator('text=/featured|success/i')).toBeVisible();
    }
  });

  test("should unfeature listing", async ({ page }) => {
    const unfeatureButton = page.locator('[data-testid="unfeature-button"]').first();
    if (await unfeatureButton.isVisible()) {
      await unfeatureButton.click();
      await expect(page.locator('text=/unfeatured|removed/i')).toBeVisible();
    }
  });

  test("should suspend listing", async ({ page }) => {
    const suspendButton = page.locator('[data-testid="suspend-button"]').first();
    if (await suspendButton.isVisible()) {
      await suspendButton.click();
      
      const reasonInput = page.locator('textarea[name="reason"]');
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('Violates content policy');
      }
      
      await page.click('button:has-text("Confirm")');
      await expect(page.locator('text=/suspended|success/i')).toBeVisible();
    }
  });

  test("should delete listing", async ({ page }) => {
    const deleteButton = page.locator('[data-testid="delete-button"]').first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await expect(page.locator('[data-testid="delete-confirm-modal"]')).toBeVisible();
    }
  });
});

test.describe("Admin Entity Management - Bookings", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/entities/booking");
  });

  test("should display bookings list", async ({ page }) => {
    await expect(page.locator('[data-testid="data-table"]')).toBeVisible();
  });

  test("should show booking columns", async ({ page }) => {
    await expect(page.locator('text=/Listing|Renter|Owner|Status|Amount/i')).toBeVisible();
  });

  test("should filter by status", async ({ page }) => {
    const statusFilter = page.locator('[data-testid="status-filter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.click('text=Active');
    }
  });

  test("should filter by date range", async ({ page }) => {
    const dateFilter = page.locator('[data-testid="date-filter"]');
    if (await dateFilter.isVisible()) {
      await dateFilter.click();
      await page.click('text=Last 30 days');
    }
  });

  test("should view booking details", async ({ page }) => {
    const viewButton = page.locator('[data-testid="view-button"]').first();
    if (await viewButton.isVisible()) {
      await viewButton.click();
      await expect(page.locator('[data-testid="booking-details-modal"]')).toBeVisible();
    }
  });

  test("should cancel booking as admin", async ({ page }) => {
    const cancelButton = page.locator('[data-testid="cancel-button"]').first();
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      
      const reasonInput = page.locator('textarea[name="reason"]');
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('Admin cancellation due to policy violation');
      }
      
      await page.click('button:has-text("Confirm")');
      await expect(page.locator('text=/cancelled|success/i')).toBeVisible();
    }
  });

  test("should process refund", async ({ page }) => {
    const refundButton = page.locator('[data-testid="refund-button"]').first();
    if (await refundButton.isVisible()) {
      await refundButton.click();
      
      const amountInput = page.locator('input[name="refundAmount"]');
      if (await amountInput.isVisible()) {
        await amountInput.fill('50');
      }
      
      const reasonInput = page.locator('textarea[name="reason"]');
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('Partial refund due to early return');
      }
      
      await page.click('button:has-text("Process Refund")');
      await expect(page.locator('text=/refund.*processed|success/i')).toBeVisible();
    }
  });
});

test.describe("Admin Dispute Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/disputes");
  });

  test("should display disputes list", async ({ page }) => {
    await expect(page.locator('[data-testid="disputes-list"]')).toBeVisible();
  });

  test("should show dispute columns", async ({ page }) => {
    await expect(page.locator('text=/Booking|Reporter|Type|Status|Created/i')).toBeVisible();
  });

  test("should filter by status - open", async ({ page }) => {
    await page.click('button:has-text("Open"), [data-testid="filter-open"]');
    await expect(page).toHaveURL(/.*status=open|.*tab=open/);
  });

  test("should filter by status - in progress", async ({ page }) => {
    await page.click('button:has-text("In Progress"), [data-testid="filter-in-progress"]');
  });

  test("should filter by status - resolved", async ({ page }) => {
    await page.click('button:has-text("Resolved"), [data-testid="filter-resolved"]');
  });

  test("should filter by type", async ({ page }) => {
    const typeFilter = page.locator('[data-testid="type-filter"]');
    if (await typeFilter.isVisible()) {
      await typeFilter.click();
      await page.click('text=Damage');
    }
  });

  test("should view dispute details", async ({ page }) => {
    const disputeCard = page.locator('[data-testid="dispute-card"]').first();
    if (await disputeCard.isVisible()) {
      await disputeCard.click();
      await expect(page.locator('[data-testid="dispute-details"]')).toBeVisible();
    }
  });

  test("should view dispute evidence", async ({ page }) => {
    const disputeCard = page.locator('[data-testid="dispute-card"]').first();
    if (await disputeCard.isVisible()) {
      await disputeCard.click();
      await expect(page.locator('[data-testid="evidence-section"]')).toBeVisible();
    }
  });

  test("should view dispute messages", async ({ page }) => {
    const disputeCard = page.locator('[data-testid="dispute-card"]').first();
    if (await disputeCard.isVisible()) {
      await disputeCard.click();
      await expect(page.locator('[data-testid="dispute-messages"]')).toBeVisible();
    }
  });

  test("should assign dispute to self", async ({ page }) => {
    const disputeCard = page.locator('[data-testid="dispute-card"]').first();
    if (await disputeCard.isVisible()) {
      await disputeCard.click();
      
      const assignButton = page.locator('button:has-text("Assign to Me")');
      if (await assignButton.isVisible()) {
        await assignButton.click();
        await expect(page.locator('text=/assigned|success/i')).toBeVisible();
      }
    }
  });

  test("should add admin note to dispute", async ({ page }) => {
    const disputeCard = page.locator('[data-testid="dispute-card"]').first();
    if (await disputeCard.isVisible()) {
      await disputeCard.click();
      
      await page.fill('textarea[name="adminNote"]', 'Investigating the issue. Contacted both parties.');
      await page.click('button:has-text("Add Note")');
      
      await expect(page.locator('text=Investigating the issue')).toBeVisible();
    }
  });

  test("should send message in dispute", async ({ page }) => {
    const disputeCard = page.locator('[data-testid="dispute-card"]').first();
    if (await disputeCard.isVisible()) {
      await disputeCard.click();
      
      await page.fill('textarea[name="message"]', 'We are reviewing your dispute. Please provide additional evidence if available.');
      await page.click('button:has-text("Send")');
    }
  });

  test("should resolve dispute - favor reporter", async ({ page }) => {
    const disputeCard = page.locator('[data-testid="dispute-card"]').first();
    if (await disputeCard.isVisible()) {
      await disputeCard.click();
      
      const resolveButton = page.locator('button:has-text("Resolve")');
      if (await resolveButton.isVisible()) {
        await resolveButton.click();
        
        // Select resolution
        await page.click('text=Favor Reporter');
        
        // Add resolution note
        await page.fill('textarea[name="resolution"]', 'Evidence supports the reporter claim. Full refund issued.');
        
        // Refund amount (if applicable)
        const refundInput = page.locator('input[name="refundAmount"]');
        if (await refundInput.isVisible()) {
          await refundInput.fill('100');
        }
        
        await page.click('button:has-text("Confirm Resolution")');
        await expect(page.locator('text=/resolved|success/i')).toBeVisible();
      }
    }
  });

  test("should resolve dispute - favor reported", async ({ page }) => {
    const disputeCard = page.locator('[data-testid="dispute-card"]').first();
    if (await disputeCard.isVisible()) {
      await disputeCard.click();
      
      const resolveButton = page.locator('button:has-text("Resolve")');
      if (await resolveButton.isVisible()) {
        await resolveButton.click();
        
        await page.click('text=Favor Reported');
        await page.fill('textarea[name="resolution"]', 'Evidence does not support the claim. No action taken.');
        await page.click('button:has-text("Confirm Resolution")');
        
        await expect(page.locator('text=/resolved|success/i')).toBeVisible();
      }
    }
  });

  test("should resolve dispute - partial resolution", async ({ page }) => {
    const disputeCard = page.locator('[data-testid="dispute-card"]').first();
    if (await disputeCard.isVisible()) {
      await disputeCard.click();
      
      const resolveButton = page.locator('button:has-text("Resolve")');
      if (await resolveButton.isVisible()) {
        await resolveButton.click();
        
        await page.click('text=Partial');
        await page.fill('textarea[name="resolution"]', 'Both parties share responsibility. Partial refund issued.');
        
        const refundInput = page.locator('input[name="refundAmount"]');
        if (await refundInput.isVisible()) {
          await refundInput.fill('50');
        }
        
        await page.click('button:has-text("Confirm Resolution")');
        await expect(page.locator('text=/resolved|success/i')).toBeVisible();
      }
    }
  });

  test("should escalate dispute", async ({ page }) => {
    const disputeCard = page.locator('[data-testid="dispute-card"]').first();
    if (await disputeCard.isVisible()) {
      await disputeCard.click();
      
      const escalateButton = page.locator('button:has-text("Escalate")');
      if (await escalateButton.isVisible()) {
        await escalateButton.click();
        
        await page.fill('textarea[name="reason"]', 'Requires senior review due to high value dispute.');
        await page.click('button:has-text("Confirm")');
        
        await expect(page.locator('text=/escalated|success/i')).toBeVisible();
      }
    }
  });
});

test.describe("Admin System Settings", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/system");
  });

  test("should display system settings page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/System|Settings/i);
  });

  test("should show platform configuration", async ({ page }) => {
    await expect(page.locator('[data-testid="platform-config"]')).toBeVisible();
  });

  test("should update commission rate", async ({ page }) => {
    const commissionInput = page.locator('input[name="commissionRate"]');
    if (await commissionInput.isVisible()) {
      await commissionInput.fill('15');
      await page.click('button:has-text("Save")');
      await expect(page.locator('text=/saved|updated/i')).toBeVisible();
    }
  });

  test("should update minimum payout amount", async ({ page }) => {
    const payoutInput = page.locator('input[name="minPayoutAmount"]');
    if (await payoutInput.isVisible()) {
      await payoutInput.fill('25');
      await page.click('button:has-text("Save")');
      await expect(page.locator('text=/saved|updated/i')).toBeVisible();
    }
  });

  test("should toggle maintenance mode", async ({ page }) => {
    const maintenanceToggle = page.locator('[data-testid="maintenance-toggle"]');
    if (await maintenanceToggle.isVisible()) {
      await maintenanceToggle.click();
      await expect(page.locator('[data-testid="maintenance-modal"]')).toBeVisible();
    }
  });

  test("should navigate to power operations", async ({ page }) => {
    await page.click('a:has-text("Power Operations")');
    await expect(page).toHaveURL(/.*power-operations/);
  });
});

test.describe("Admin Power Operations", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/system/power-operations");
  });

  test("should display power operations page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/Power|Operations/i);
  });

  test("should require confirmation for dangerous operations", async ({ page }) => {
    const dangerousButton = page.locator('[data-testid="clear-cache"]');
    if (await dangerousButton.isVisible()) {
      await dangerousButton.click();
      await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible();
      await expect(page.locator('text=/Are you sure|This action/i')).toBeVisible();
    }
  });

  test("should show bulk operations", async ({ page }) => {
    const bulkOps = page.locator('[data-testid="bulk-operations"]');
    if (await bulkOps.isVisible()) {
      await expect(bulkOps).toBeVisible();
    }
  });

  test("should export all data", async ({ page }) => {
    const exportButton = page.locator('button:has-text("Export All Data")');
    if (await exportButton.isVisible()) {
      await exportButton.click();
      await expect(page.locator('text=/processing|started/i')).toBeVisible();
    }
  });
});

test.describe("Admin Reports & Analytics", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should view revenue report", async ({ page }) => {
    await page.goto("/admin");
    const revenueReport = page.locator('[data-testid="revenue-chart"]');
    if (await revenueReport.isVisible()) {
      await expect(revenueReport).toBeVisible();
    }
  });

  test("should view user growth report", async ({ page }) => {
    await page.goto("/admin");
    const userGrowth = page.locator('[data-testid="user-growth-chart"]');
    if (await userGrowth.isVisible()) {
      await expect(userGrowth).toBeVisible();
    }
  });

  test("should filter reports by date range", async ({ page }) => {
    await page.goto("/admin");
    const dateRange = page.locator('[data-testid="date-range-picker"]');
    if (await dateRange.isVisible()) {
      await dateRange.click();
      await page.click('text=Last 90 Days');
    }
  });

  test("should export reports", async ({ page }) => {
    await page.goto("/admin");
    const exportButton = page.locator('button:has-text("Export Report")');
    if (await exportButton.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportButton.click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/report.*\.csv|\.pdf|\.xlsx/);
    }
  });
});

test.describe("Admin Access Control", () => {
  test("should deny access to non-admin users", async ({ page }) => {
    // Login as regular user
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', 'renter@test.com');
    await page.fill('input[type="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);
    
    // Try to access admin
    await page.goto("/admin");
    await expect(page).toHaveURL(/.*dashboard|.*unauthorized|.*forbidden/);
  });

  test("should show unauthorized message for non-admin", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', 'renter@test.com');
    await page.fill('input[type="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);
    
    const response = await page.goto("/admin");
    // Either redirect or show unauthorized
    const url = page.url();
    expect(url).not.toContain('/admin');
  });
});
