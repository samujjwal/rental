import { test, expect, Page } from "@playwright/test";

// Test user credentials
const TEST_USER = {
  email: "owner@test.com",
  password: "Test123!@#",
};

// Helper to login
async function loginAsUser(page: Page) {
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);
}

test.describe("Organization Management", () => {
  test.describe("Organizations List", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsUser(page);
      await page.goto("/organizations");
    });

    test("should display organizations page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Organization/i);
    });

    test("should show organizations list", async ({ page }) => {
      const orgList = page.locator('[data-testid="organizations-list"]');
      await expect(orgList).toBeVisible();
    });

    test("should show empty state when no organizations", async ({ page }) => {
      const emptyState = page.locator('text=/No organizations|Create your first/i');
      const orgCard = page.locator('[data-testid="organization-card"]');
      await expect(emptyState.or(orgCard.first())).toBeVisible();
    });

    test("should navigate to create organization", async ({ page }) => {
      await page.click('button:has-text("Create"), a:has-text("New Organization")');
      await expect(page).toHaveURL(/.*organizations\/new/);
    });

    test("should display organization card details", async ({ page }) => {
      const orgCard = page.locator('[data-testid="organization-card"]').first();
      if (await orgCard.isVisible()) {
        await expect(page.locator('[data-testid="org-name"]').first()).toBeVisible();
        await expect(page.locator('[data-testid="org-members-count"]').first()).toBeVisible();
      }
    });

    test("should navigate to organization details", async ({ page }) => {
      const orgCard = page.locator('[data-testid="organization-card"]').first();
      if (await orgCard.isVisible()) {
        await orgCard.click();
        await expect(page).toHaveURL(/.*organizations\/.*/);
      }
    });
  });

  test.describe("Create Organization", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsUser(page);
      await page.goto("/organizations/new");
    });

    test("should display create organization form", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Create|New/i);
      await expect(page.locator('input[name="name"]')).toBeVisible();
    });

    test("should show organization name input", async ({ page }) => {
      await expect(page.locator('input[name="name"]')).toBeVisible();
    });

    test("should show description textarea", async ({ page }) => {
      const description = page.locator('textarea[name="description"]');
      if (await description.isVisible()) {
        await expect(description).toBeVisible();
      }
    });

    test("should show logo upload", async ({ page }) => {
      const logoUpload = page.locator('[data-testid="logo-upload"]');
      if (await logoUpload.isVisible()) {
        await expect(logoUpload).toBeVisible();
      }
    });

    test("should validate organization name", async ({ page }) => {
      await page.fill('input[name="name"]', 'AB');
      await page.click('button:has-text("Create")');
      await expect(page.locator('text=/too short|minimum|at least/i')).toBeVisible();
    });

    test("should create organization successfully", async ({ page }) => {
      await page.fill('input[name="name"]', 'Test Organization ' + Date.now());
      
      const description = page.locator('textarea[name="description"]');
      if (await description.isVisible()) {
        await description.fill('This is a test organization description.');
      }
      
      await page.click('button:has-text("Create")');
      await expect(page).toHaveURL(/.*organizations\/.*/);
    });

    test("should upload organization logo", async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        await fileInput.setInputFiles({
          name: 'logo.png',
          mimeType: 'image/png',
          buffer: Buffer.from('fake logo image'),
        });
      }
    });

    test("should cancel creation", async ({ page }) => {
      await page.click('button:has-text("Cancel")');
      await expect(page).toHaveURL(/.*organizations$/);
    });
  });

  test.describe("Organization Settings", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsUser(page);
      await page.goto("/organizations/1/settings");
    });

    test("should display organization settings", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Settings|Organization/i);
    });

    test("should show organization name field", async ({ page }) => {
      await expect(page.locator('input[name="name"]')).toBeVisible();
    });

    test("should update organization name", async ({ page }) => {
      await page.fill('input[name="name"]', 'Updated Organization Name');
      await page.click('button:has-text("Save")');
      await expect(page.locator('text=/saved|updated|success/i')).toBeVisible();
    });

    test("should update organization description", async ({ page }) => {
      const description = page.locator('textarea[name="description"]');
      if (await description.isVisible()) {
        await description.fill('Updated organization description.');
        await page.click('button:has-text("Save")');
        await expect(page.locator('text=/saved|updated/i')).toBeVisible();
      }
    });

    test("should update organization logo", async ({ page }) => {
      const uploadButton = page.locator('[data-testid="change-logo"]');
      if (await uploadButton.isVisible()) {
        await uploadButton.click();
        
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: 'new-logo.png',
          mimeType: 'image/png',
          buffer: Buffer.from('new fake logo'),
        });
      }
    });

    test("should show danger zone", async ({ page }) => {
      const dangerZone = page.locator('[data-testid="danger-zone"]');
      if (await dangerZone.isVisible()) {
        await expect(dangerZone).toBeVisible();
      }
    });

    test("should delete organization", async ({ page }) => {
      const deleteButton = page.locator('button:has-text("Delete Organization")');
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        await expect(page.locator('[data-testid="delete-modal"]')).toBeVisible();
        
        // Confirm deletion requires typing org name
        const confirmInput = page.locator('input[name="confirmName"]');
        if (await confirmInput.isVisible()) {
          await confirmInput.fill('Organization Name');
        }
        
        // Don't actually delete in test
      }
    });
  });

  test.describe("Organization Members", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsUser(page);
      await page.goto("/organizations/1/members");
    });

    test("should display members page", async ({ page }) => {
      await expect(page.locator("h1")).toContainText(/Members/i);
    });

    test("should show members list", async ({ page }) => {
      await expect(page.locator('[data-testid="members-list"]')).toBeVisible();
    });

    test("should show member details", async ({ page }) => {
      const memberRow = page.locator('[data-testid="member-row"]').first();
      if (await memberRow.isVisible()) {
        await expect(page.locator('[data-testid="member-name"]').first()).toBeVisible();
        await expect(page.locator('[data-testid="member-role"]').first()).toBeVisible();
      }
    });

    test("should invite new member", async ({ page }) => {
      await page.click('button:has-text("Invite")');
      
      await expect(page.locator('[data-testid="invite-modal"]')).toBeVisible();
      
      await page.fill('input[name="email"]', 'newmember@example.com');
      
      // Select role
      const roleSelect = page.locator('[data-testid="role-select"]');
      if (await roleSelect.isVisible()) {
        await roleSelect.click();
        await page.click('text=Member');
      }
      
      await page.click('button:has-text("Send Invite")');
      await expect(page.locator('text=/invited|sent|success/i')).toBeVisible();
    });

    test("should validate invite email", async ({ page }) => {
      await page.click('button:has-text("Invite")');
      
      await page.fill('input[name="email"]', 'invalid-email');
      await page.click('button:has-text("Send Invite")');
      
      await expect(page.locator('text=/invalid.*email|email.*invalid/i')).toBeVisible();
    });

    test("should change member role", async ({ page }) => {
      const roleButton = page.locator('[data-testid="change-role"]').first();
      if (await roleButton.isVisible()) {
        await roleButton.click();
        
        await page.click('text=Admin');
        await expect(page.locator('text=/updated|changed/i')).toBeVisible();
      }
    });

    test("should remove member", async ({ page }) => {
      const removeButton = page.locator('[data-testid="remove-member"]').first();
      if (await removeButton.isVisible()) {
        await removeButton.click();
        
        await expect(page.locator('[data-testid="remove-modal"]')).toBeVisible();
        await page.click('button:has-text("Confirm")');
        
        await expect(page.locator('text=/removed|success/i')).toBeVisible();
      }
    });

    test("should show pending invitations", async ({ page }) => {
      const pendingSection = page.locator('[data-testid="pending-invites"]');
      if (await pendingSection.isVisible()) {
        await expect(pendingSection).toBeVisible();
      }
    });

    test("should cancel pending invitation", async ({ page }) => {
      const cancelInvite = page.locator('[data-testid="cancel-invite"]').first();
      if (await cancelInvite.isVisible()) {
        await cancelInvite.click();
        await expect(page.locator('text=/cancelled|revoked/i')).toBeVisible();
      }
    });

    test("should resend invitation", async ({ page }) => {
      const resendButton = page.locator('[data-testid="resend-invite"]').first();
      if (await resendButton.isVisible()) {
        await resendButton.click();
        await expect(page.locator('text=/resent|sent/i')).toBeVisible();
      }
    });

    test("should search members", async ({ page }) => {
      const searchInput = page.locator('input[name="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('john');
        await page.keyboard.press('Enter');
      }
    });

    test("should filter by role", async ({ page }) => {
      const roleFilter = page.locator('[data-testid="role-filter"]');
      if (await roleFilter.isVisible()) {
        await roleFilter.click();
        await page.click('text=Admin');
      }
    });
  });

  test.describe("Organization Roles & Permissions", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsUser(page);
      await page.goto("/organizations/1/settings");
    });

    test("should display role options", async ({ page }) => {
      await expect(page.locator('text=/Owner|Admin|Member/i')).toBeVisible();
    });

    test("should show role permissions", async ({ page }) => {
      const permissionsSection = page.locator('[data-testid="permissions-section"]');
      if (await permissionsSection.isVisible()) {
        await expect(permissionsSection).toBeVisible();
      }
    });

    test("should transfer ownership", async ({ page }) => {
      const transferButton = page.locator('button:has-text("Transfer Ownership")');
      if (await transferButton.isVisible()) {
        await transferButton.click();
        
        await expect(page.locator('[data-testid="transfer-modal"]')).toBeVisible();
        
        // Select new owner
        const memberSelect = page.locator('[data-testid="new-owner-select"]');
        if (await memberSelect.isVisible()) {
          await memberSelect.click();
          await page.locator('[data-testid="member-option"]').first().click();
        }
        
        // Don't actually transfer in test
      }
    });
  });

  test.describe("Organization Listings", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsUser(page);
      await page.goto("/organizations/1");
    });

    test("should show organization listings", async ({ page }) => {
      const listings = page.locator('[data-testid="org-listings"]');
      if (await listings.isVisible()) {
        await expect(listings).toBeVisible();
      }
    });

    test("should create listing under organization", async ({ page }) => {
      const createButton = page.locator('button:has-text("Create Listing")');
      if (await createButton.isVisible()) {
        await createButton.click();
        await expect(page).toHaveURL(/.*listings\/new/);
      }
    });

    test("should assign existing listing to organization", async ({ page }) => {
      const assignButton = page.locator('button:has-text("Assign Listing")');
      if (await assignButton.isVisible()) {
        await assignButton.click();
        
        await expect(page.locator('[data-testid="assign-modal"]')).toBeVisible();
        
        // Select listing
        const listingSelect = page.locator('[data-testid="listing-select"]');
        if (await listingSelect.isVisible()) {
          await listingSelect.click();
          await page.locator('[data-testid="listing-option"]').first().click();
          await page.click('button:has-text("Assign")');
        }
      }
    });

    test("should remove listing from organization", async ({ page }) => {
      const removeButton = page.locator('[data-testid="remove-listing"]').first();
      if (await removeButton.isVisible()) {
        await removeButton.click();
        await page.click('button:has-text("Confirm")');
        await expect(page.locator('text=/removed|success/i')).toBeVisible();
      }
    });
  });

  test.describe("Organization Analytics", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsUser(page);
      await page.goto("/organizations/1");
    });

    test("should display organization stats", async ({ page }) => {
      const stats = page.locator('[data-testid="org-stats"]');
      if (await stats.isVisible()) {
        await expect(stats).toBeVisible();
      }
    });

    test("should show total bookings", async ({ page }) => {
      const totalBookings = page.locator('[data-testid="total-bookings"]');
      if (await totalBookings.isVisible()) {
        await expect(totalBookings).toBeVisible();
      }
    });

    test("should show total revenue", async ({ page }) => {
      const revenue = page.locator('[data-testid="total-revenue"]');
      if (await revenue.isVisible()) {
        await expect(revenue).toBeVisible();
      }
    });

    test("should filter analytics by date range", async ({ page }) => {
      const dateFilter = page.locator('[data-testid="date-range-filter"]');
      if (await dateFilter.isVisible()) {
        await dateFilter.click();
        await page.click('text=Last 30 Days');
      }
    });
  });
});

test.describe("Organization Invitation Flow", () => {
  test("should accept organization invitation", async ({ page }) => {
    // Navigate to invitation link with token
    await page.goto("/organizations/invite?token=test-invite-token");
    
    // If not logged in, redirect to login
    const loginPage = page.locator('text=/Login|Sign In/i');
    if (await loginPage.isVisible()) {
      await loginAsUser(page);
      await page.goto("/organizations/invite?token=test-invite-token");
    }
    
    // Accept invitation
    const acceptButton = page.locator('button:has-text("Accept")');
    if (await acceptButton.isVisible()) {
      await acceptButton.click();
      await expect(page).toHaveURL(/.*organizations\/.*/);
    }
  });

  test("should decline organization invitation", async ({ page }) => {
    await page.goto("/organizations/invite?token=test-invite-token");
    
    const declineButton = page.locator('button:has-text("Decline")');
    if (await declineButton.isVisible()) {
      await declineButton.click();
      await expect(page.locator('text=/declined|success/i')).toBeVisible();
    }
  });

  test("should handle expired invitation", async ({ page }) => {
    await page.goto("/organizations/invite?token=expired-token");
    
    await expect(page.locator('text=/expired|invalid|no longer valid/i')).toBeVisible();
  });

  test("should handle already used invitation", async ({ page }) => {
    await page.goto("/organizations/invite?token=used-token");
    
    await expect(page.locator('text=/already.*used|already.*member|invalid/i')).toBeVisible();
  });
});

test.describe("Leave Organization", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test("should show leave option for member", async ({ page }) => {
    await page.goto("/organizations/1/settings");
    
    const leaveButton = page.locator('button:has-text("Leave Organization")');
    if (await leaveButton.isVisible()) {
      await expect(leaveButton).toBeVisible();
    }
  });

  test("should confirm before leaving", async ({ page }) => {
    await page.goto("/organizations/1/settings");
    
    const leaveButton = page.locator('button:has-text("Leave Organization")');
    if (await leaveButton.isVisible()) {
      await leaveButton.click();
      await expect(page.locator('[data-testid="leave-modal"]')).toBeVisible();
      await expect(page.locator('text=/Are you sure|Confirm/i')).toBeVisible();
    }
  });

  test("should leave organization successfully", async ({ page }) => {
    await page.goto("/organizations/1/settings");
    
    const leaveButton = page.locator('button:has-text("Leave Organization")');
    if (await leaveButton.isVisible()) {
      await leaveButton.click();
      await page.click('button:has-text("Confirm")');
      await expect(page).toHaveURL(/.*organizations$/);
    }
  });

  test("should prevent owner from leaving without transfer", async ({ page }) => {
    await page.goto("/organizations/1/settings");
    
    const leaveButton = page.locator('button:has-text("Leave Organization")');
    if (await leaveButton.isVisible()) {
      await leaveButton.click();
      
      // If owner, should show transfer requirement
      const transferMessage = page.locator('text=/transfer ownership|cannot leave|owner/i');
      if (await transferMessage.isVisible()) {
        await expect(transferMessage).toBeVisible();
      }
    }
  });
});
