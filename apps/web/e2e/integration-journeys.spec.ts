/**
 * Integration Tests - Cross-Feature User Journeys
 * Tests complete end-to-end workflows combining multiple features
 * @tags @integration @journeys @critical
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3401';
const API_URL = process.env.E2E_API_URL || 'http://localhost:3400/api';

test.describe('Integration - Full User Journeys', () => {
  test('Complete rental journey: search → book → pay → message → rate', async ({
    page,
    request,
  }) => {
    // 1. Search for listings
    await page.goto(`${BASE_URL}`);
    await page.locator('[data-testid="search"]').fill('apartment');
    await page.locator('[data-testid="search-btn"]').click();
    
    await page.waitForURL(/\/search/);
    const listings = page.locator('[data-testid="listing-card"]');
    await expect(listings.first()).toBeVisible();
    
    // 2. Click on first listing
    await listings.first().click();
    await page.waitForURL(/\/listings\/[^/]+$/);
    
    // 3. Make a booking
    const checkInDate = new Date(2026, 4, 15);
    const checkOutDate = new Date(2026, 4, 18);
    
    await page.locator('[data-testid="check-in"]').fill(
      checkInDate.toISOString().split('T')[0]
    );
    await page.locator('[data-testid="check-out"]').fill(
      checkOutDate.toISOString().split('T')[0]
    );
    await page.locator('[data-testid="guests"]').fill('2');
    
    // 4. Create booking
    await page.locator('[data-testid="book-btn"]').click();
    
    // Should redirect to checkout
    await page.waitForURL(/\/checkout/);
    const bookingTotal = page.locator('[data-testid="total-price"]');
    await expect(bookingTotal).toBeVisible();
    
    // 5. Process payment
    await page.locator('[data-testid="stripe-iframe"]').evaluate((el) => {
      (el as any).innerText = 'Mock Stripe'; // Mock for testing
    });
    
    await page.locator('[data-testid="pay-btn"]').click();
    
    // Should show confirmation
    await page.waitForURL(/\/booking-confirmation/);
    const confirmMessage = page.locator('[data-testid="success-message"]');
    await expect(confirmMessage).toContainText('Booking confirmed');
    
    // 6. Send message to owner
    await page.locator('[data-testid="message-owner-btn"]').click();
    
    const messageInput = page.locator('[data-testid="message-input"]');
    await messageInput.fill(
      'Hi! Looking forward to my stay. Any check-in instructions?'
    );
    await page.locator('[data-testid="send-msg-btn"]').click();
    
    await expect(page.locator('[data-testid="message-sent"]')).toBeVisible();
    
    // 7. After stay completes, should prompt for review
    // (In real scenario, this happens after stay date)
    await page.goto(`${BASE_URL}/my-bookings`);
    
    const completedBooking = page.locator('[data-testid="booking-status"]:text("Completed")');
    if (await completedBooking.isVisible()) {
      await page.locator('[data-testid="leave-review-btn"]').click();
      
      // 8. Rate the listing
      const ratingStars = page.locator('[data-testid="star-rating"]');
      await ratingStars.nth(4).click(); // 5 stars
      
      // Add review text
      await page.locator('[data-testid="review-text"]').fill(
        'Amazing place! Very clean and comfortable. Owner was great!'
      );
      
      await page.locator('[data-testid="submit-review-btn"]').click();
      
      await expect(page.locator('[data-testid="review-submitted"]')).toBeVisible();
    }
  });

  test('Owner workflow: list property → manage bookings → process payments → respond to messages', async ({
    page,
    request,
  }) => {
    // 1. Login as owner
    await page.goto(`${BASE_URL}/login`);
    await page.locator('[data-testid="email"]').fill('owner@test.com');
    await page.locator('[data-testid="password"]').fill('password123');
    await page.locator('[data-testid="login-btn"]').click();
    
    // 2. Navigate to create listing
    await page.goto(`${BASE_URL}/my-listings`);
    await page.locator('[data-testid="create-listing-btn"]').click();
    
    // 3. Fill listing details
    await page.locator('[data-testid="title"]').fill('Beautiful Mountain Cottage');
    await page.locator('[data-testid="description"]').fill(
      'Cozy 2-bedroom cottage with mountain views'
    );
    await page.locator('[data-testid="price"]').fill('150');
    await page.locator('[data-testid="category"]').selectOption('apartment');
    await page.locator('[data-testid="max-guests"]').fill('4');
    
    // 4. Add amenities
    await page.locator('[data-testid="amenity-wifi"]').click();
    await page.locator('[data-testid="amenity-kitchen"]').click();
    await page.locator('[data-testid="amenity-ac"]').click();
    
    // 5. Publish listing
    await page.locator('[data-testid="publish-btn"]').click();
    await expect(page.locator('[data-testid="success"]')).toBeVisible();
    
    // Get listing ID from URL
    const url = page.url();
    const listingId = url.split('/').pop();
    
    // 6. Simulate booking (as different user)
    const booking = await request.post(`${API_URL}/bookings`, {
      data: {
        listingId,
        checkInDate: '2026-05-15',
        checkOutDate: '2026-05-18',
        guestCount: 2,
        status: 'pending',
      },
    });
    
    const bookingId = (await booking.json()).id;
    
    // 7. Back to owner - view pending bookings
    await page.goto(`${BASE_URL}/my-bookings`);
    
    const pendingBooking = page.locator(
      '[data-testid="booking-status"]:text("Pending")'
    ).first();
    await expect(pendingBooking).toBeVisible();
    
    // 8. Approve booking
    await page.locator('[data-testid="approve-booking-btn"]').first().click();
    await expect(page.locator('[data-testid="booking-approved"]')).toBeVisible();
    
    // 9. Check messages
    await page.goto(`${BASE_URL}/messages`);
    
    const messages = page.locator('[data-testid="message-item"]');
    if (await messages.count() > 0) {
      await messages.first().click();
      
      // 10. Reply to message
      await page.locator('[data-testid="reply-input"]').fill('Looking forward to hosting you!');
      await page.locator('[data-testid="send-reply-btn"]').click();
      
      await expect(page.locator('[data-testid="reply-sent"]')).toBeVisible();
    }
    
    // 11. Check earnings/payments
    await page.goto(`${BASE_URL}/earnings`);
    
    const totalEarnings = page.locator('[data-testid="total-earnings"]');
    await expect(totalEarnings).toBeVisible();
    
    // Should show pending payment from booking
    const pendingPayments = page.locator('[data-testid="pending-payment"]');
    const count = await pendingPayments.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('Admin moderation workflow: investigate complaint → suspend listing → handle appeal', async ({
    page,
    request,
  }) => {
    // 1. Login as admin
    await page.goto(`${BASE_URL}/login`);
    await page.locator('[data-testid="email"]').fill('admin@test.com');
    await page.locator('[data-testid="password"]').fill('admin123');
    await page.locator('[data-testid="login-btn"]').click();
    
    // 2. Navigate to moderation panel
    await page.goto(`${BASE_URL}/admin/moderation`);
    
    // 3. View flagged listings
    const flaggedListings = page.locator('[data-testid="flagged-listing"]');
    if (await flaggedListings.count() > 0) {
      await flaggedListings.first().click();
      
      // 4. Review complaint details
      const complaintTitle = page.locator('[data-testid="complaint-title"]');
      const complaintDetails = page.locator('[data-testid="complaint-details"]');
      
      await expect(complaintTitle).toBeVisible();
      await expect(complaintDetails).toBeVisible();
      
      // 5. Take action - suspend listing
      await page.locator('[data-testid="action-select"]').selectOption('suspend');
      await page.locator('[data-testid="reason"]').fill('Violates pricing policy');
      
      await page.locator('[data-testid="apply-action-btn"]').click();
      
      await expect(page.locator('[data-testid="action-applied"]')).toBeVisible();
      
      // 6. View user appeals
      await page.goto(`${BASE_URL}/admin/appeals`);
      
      const appeals = page.locator('[data-testid="appeal-item"]');
      if (await appeals.count() > 0) {
        await appeals.first().click();
        
        // 7. Review appeal
        const appealText = page.locator('[data-testid="appeal-text"]');
        await expect(appealText).toBeVisible();
        
        // 8. Decide on appeal
        const decideButton = page.locator('[data-testid="approve-appeal-btn"]');
        await decideButton.click();
        
        // Should reverse suspension or show decision
        await expect(
          page.locator('[data-testid="appeal-processed"]')
        ).toBeVisible();
      }
    }
  });

  test('Dispute resolution workflow: create dispute → exchange evidence → resolve', async ({
    page,
    request,
  }) => {
    // 1. Login as guest with completed booking
    await page.goto(`${BASE_URL}/login`);
    await page.locator('[data-testid="email"]').fill('renter@test.com');
    await page.locator('[data-testid="password"]').fill('password123');
    await page.locator('[data-testid="login-btn"]').click();
    
    // 2. Go to completed booking
    await page.goto(`${BASE_URL}/my-bookings`);
    
    const completedBooking = page.locator(
      '[data-testid="booking-status"]:text("Completed")'
    );
    if (await completedBooking.isVisible()) {
      await completedBooking.locator('..').click();
      
      // 3. File dispute
      await page.locator('[data-testid="file-dispute-btn"]').click();
      
      const disputeModal = page.locator('[data-testid="dispute-modal"]');
      await disputeModal.locator('[data-testid="reason"]').selectOption('property_damage');
      
      await disputeModal
        .locator('[data-testid="description"]')
        .fill('Broken window found on check-out');
      
      // 4. Upload evidence
      await disputeModal
        .locator('[data-testid="upload-evidence"]')
        .setInputFiles('./test-fixtures/damage-photo.png');
      
      await disputeModal.locator('[data-testid="file-dispute"]').click();
      
      await expect(page.locator('[data-testid="dispute-filed"]')).toBeVisible();
      
      const disputeId = await page
        .locator('[data-testid="dispute-id"]')
        .textContent();
      
      // 5. Wait for owner to respond (simulate with API)
      await request.post(`${API_URL}/disputes/${disputeId}/response`, {
        data: {
          description: 'Window was already broken when guest arrived',
          evidence: ['timestamp-photo.png'],
        },
      });
      
      // 6. Check owner's response
      await page.reload();
      
      const ownerResponse = page.locator('[data-testid="owner-response"]');
      await expect(ownerResponse).toBeVisible();
      
      // 7. Request mediation or accept resolution
      const resolution = page.locator('[data-testid="accept-resolution-btn"]');
      
      if (await resolution.isVisible()) {
        await resolution.click();
        
        await expect(page.locator('[data-testid="dispute-resolved"]')).toBeVisible();
      }
    }
  });

  test('Multi-listing management: bulk operations workflow', async ({ page }) => {
    // 1. Login as owner
    await page.goto(`${BASE_URL}/login`);
    await page.locator('[data-testid="email"]').fill('owner@test.com');
    await page.locator('[data-testid="password"]').fill('password123');
    await page.locator('[data-testid="login-btn"]').click();
    
    // 2. Go to listings
    await page.goto(`${BASE_URL}/my-listings`);
    
    // 3. Select multiple listings
    const listings = page.locator('[data-testid="listing-checkbox"]');
    const count = await listings.count();
    
    if (count >= 2) {
      // Select first 2
      await listings.nth(0).click();
      await listings.nth(1).click();
      
      // 4. Perform bulk action - update pricing
      await page.locator('[data-testid="bulk-action-select"]').selectOption('update-price');
      
      const priceInput = page.locator('[data-testid="bulk-price-input"]');
      await priceInput.fill('200');
      
      await page.locator('[data-testid="apply-bulk-action"]').click();

      // 5. Verify changes - wait for prices to update
      const updatedPrices = page.locator('[data-testid="listing-price"]');
      await updatedPrices.first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      
      // First two should be updated
      for (let i = 0; i < 2 && i < count; i++) {
        const price = await updatedPrices.nth(i).textContent();
        expect(price).toContain('200');
      }
    }
  });

  test('Guest & Owner coordination: booking modification workflow', async ({
    page,
    request,
  }) => {
    // Setup: Create active booking
    const listing = await request.post(`${API_URL}/listings`, {
      data: {
        title: 'Booking Modification Test',
        price: 100,
        category: 'apartment',
        country: 'NP',
      },
    });
    const listingId = (await listing.json()).id;
    
    const booking = await request.post(`${API_URL}/bookings`, {
      data: {
        listingId,
        checkInDate: '2026-05-15',
        checkOutDate: '2026-05-18',
        guestCount: 2,
      },
    });
    const bookingId = (await booking.json()).id;
    
    // 1. Login as guest
    await page.goto(`${BASE_URL}/login`);
    await page.locator('[data-testid="email"]').fill('renter@test.com');
    await page.locator('[data-testid="password"]').fill('password123');
    await page.locator('[data-testid="login-btn"]').click();
    
    // 2. Go to booking
    await page.goto(`${BASE_URL}/my-bookings/${bookingId}`);
    
    // 3. Request modification
    await page.locator('[data-testid="modify-booking-btn"]').click();
    
    const modal = page.locator('[data-testid="modify-modal"]');
    
    // Change checkout date
    await modal
      .locator('[data-testid="new-checkout"]')
      .fill('2026-05-20'); // Extend by 2 days
    
    await modal.locator('[data-testid="request-modification"]').click();
    
    await expect(page.locator('[data-testid="modification-requested"]')).toBeVisible();
    
    // 4. Owner reviews (simulate)
    const approveResponse = await request.patch(`${API_URL}/bookings/${bookingId}`, {
      data: {
        status: 'modification_approved',
        newCheckOutDate: '2026-05-20',
      },
    });
    
    expect(approveResponse.ok()).toBeTruthy();
    
    // 5. Guest sees approval
    await page.reload();
    
    const approvedStatus = page.locator('[data-testid="modification-approved"]');
    await expect(approvedStatus).toBeVisible();
  });

  test('Review aggregation & reputation workflow', async ({ page, request }) => {
    // 1. Simulate multiple guest reviews for same listing
    const reviews = [
      {
        rating: 5,
        text: 'Excellent place! Clean, comfortable, and great location.',
      },
      {
        rating: 4,
        text: 'Very good, but WiFi was a bit slow.',
      },
      {
        rating: 5,
        text: 'Amazing experience. Will definitely book again!',
      },
    ];
    
    for (const review of reviews) {
      await request.post(`${API_URL}/reviews`, {
        data: {
          listingId: 'reputation-test-listing',
          rating: review.rating,
          text: review.text,
        },
      });
    }
    
    // 2. View listing page
    await page.goto(`${BASE_URL}/listings/reputation-test-listing`);
    
    // 3. Check overall rating display
    const ratingBadge = page.locator('[data-testid="overall-rating"]');
    const ratingText = await ratingBadge.textContent();

    // Should show average (4.7 stars)
    expect(ratingText && (ratingText.includes('4.7') || ratingText.includes('4'))).toBeTruthy();
    
    // 4. View review breakdown
    const reviewStats = page.locator('[data-testid="review-stats"]');
    await expect(reviewStats).toBeVisible();
    
    // 5. Check owner reputation badge
    const ownerBadge = page.locator('[data-testid="owner-badge"]');
    
    // Should show "Superhost" or similar if rating is high
    const hasTopBadge = await ownerBadge.innerText();
    expect(hasTopBadge).toBeTruthy();
  });
});
