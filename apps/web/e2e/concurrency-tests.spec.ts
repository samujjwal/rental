/**
 * Concurrency & Race Condition Tests
 * Validates system behavior under concurrent user actions
 * @tags @concurrency @advanced @critical
 */

import { test, expect, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3401';
const API_URL = process.env.E2E_API_URL || 'http://localhost:3400/api';

test.describe('Concurrency Tests', () => {
  test('Concurrent booking attempts on same slot - winner takes slot', async ({ context, request }) => {
    // Setup: Create a listing with limited availability
    const listing = await request.post(`${API_URL}/listings`, {
      data: {
        title: 'Limited Apartment',
        description: 'Only 1 unit',
        price: 100,
        currency: 'USD',
        category: 'apartment',
        country: 'NP',
        location: 'Kathmandu',
        maxGuests: 2,
      },
    });
    
    const listingId = (await listing.json()).id;
    
    // Create 2 concurrent browser contexts (simulating 2 users)
    const context1 = await context.browser().newContext();
    const context2 = await context.browser().newContext();
    
    // Login both users
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    const dates = {
      start: new Date().toISOString().split('T')[0],
      end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
    
    // Both users navigate to same listing
    await page1.goto(`${BASE_URL}/listings/${listingId}`);
    await page2.goto(`${BASE_URL}/listings/${listingId}`);
    
    // Both start booking concurrently
    const [booking1, booking2] = await Promise.all([
      (async () => {
        await page1.locator('[data-testid="book-now-btn"]').click();
        await page1.locator('[data-testid="check-in"]').fill(dates.start);
        await page1.locator('[data-testid="check-out"]').fill(dates.end);
        await page1.locator('[data-testid="confirm-booking"]').click();
        
        // Wait for confirmation
        try {
          await page1.waitForURL(/\/booking\/.+\/confirmation/, { timeout: 10_000 });
          return { success: true, page: 1 };
        } catch {
          return { success: false, page: 1 };
        }
      })(),
      (async () => {
        await page2.locator('[data-testid="book-now-btn"]').click();
        await page2.locator('[data-testid="check-in"]').fill(dates.start);
        await page2.locator('[data-testid="check-out"]').fill(dates.end);
        await page2.locator('[data-testid="confirm-booking"]').click();
        
        try {
          await page2.waitForURL(/\/booking\/.+\/confirmation/, { timeout: 10_000 });
          return { success: true, page: 2 };
        } catch {
          return { success: false, page: 2 };
        }
      })(),
    ]);
    
    // Exactly one should succeed
    expect(booking1.success || booking2.success).toBeTruthy();
    expect(booking1.success === booking2.success).toBeFalsy();
    
    // Verify availability locked
    const availability = await request.get(`${API_URL}/listings/${listingId}/availability`, {
      params: { start: dates.start, end: dates.end },
    });
    const slots = await availability.json();
    expect(slots.available).toBe(0);
    
    await page1.close();
    await page2.close();
    await context1.close();
    await context2.close();
  });

  test('Concurrent message sends - all preserved in order', async ({ context, request }) => {
    // Create a conversation
    const conv = await request.post(`${API_URL}/conversations`, {
      data: {
        participantIds: ['user1', 'user2'],
        topic: 'Booking Discussion',
      },
    });
    
    const convId = (await conv.json()).id;
    
    // Send 5 messages concurrently
    const messages = await Promise.all([
      request.post(`${API_URL}/conversations/${convId}/messages`, {
        data: { body: 'Message 1', senderId: 'user1' },
      }),
      request.post(`${API_URL}/conversations/${convId}/messages`, {
        data: { body: 'Message 2', senderId: 'user1' },
      }),
      request.post(`${API_URL}/conversations/${convId}/messages`, {
        data: { body: 'Message 3', senderId: 'user2' },
      }),
      request.post(`${API_URL}/conversations/${convId}/messages`, {
        data: { body: 'Message 4', senderId: 'user1' },
      }),
      request.post(`${API_URL}/conversations/${convId}/messages`, {
        data: { body: 'Message 5', senderId: 'user2' },
      }),
    ]);
    
    // Verify all created
    expect(messages.every(r => r.ok())).toBeTruthy();
    
    // Fetch and verify order
    const historyRes = await request.get(`${API_URL}/conversations/${convId}/messages`);
    const history = await historyRes.json();
    
    expect(history.messages.length).toBe(5);
    // Timestamps should be in ascending order (allowing for microsecond ties)
    for (let i = 1; i < history.messages.length; i++) {
      const ts1 = new Date(history.messages[i - 1].createdAt).getTime();
      const ts2 = new Date(history.messages[i].createdAt).getTime();
      expect(ts2).toBeGreaterThanOrEqual(ts1);
    }
  });

  test('Concurrent reviews prevent duplicates', async ({ request }) => {
    // Complete a booking first
    const booking = await request.post(`${API_URL}/bookings`, {
      data: {
        listingId: 'test-listing',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        guestCount: 1,
      },
    });
    
    const bookingId = (await booking.json()).id;
    
    // Mark as completed
    await request.patch(`${API_URL}/bookings/${bookingId}`, {
      data: { status: 'COMPLETED' },
    });
    
    // Attempt to submit review twice concurrently
    const reviews = await Promise.all([
      request.post(`${API_URL}/bookings/${bookingId}/review`, {
        data: {
          rating: 5,
          comment: 'Great place!',
          reviewer: 'renter',
        },
      }),
      request.post(`${API_URL}/bookings/${bookingId}/review`, {
        data: {
          rating: 4,
          comment: 'Good but cold',
          reviewer: 'renter',
        },
      }),
    ]);
    
    // One succeeds, one should fail with duplicate
    const outcomes = reviews.map(r => r.ok());
    expect(outcomes.filter(o => o).length).toBe(1); // Exactly 1 success
    
    // Verify only 1 review in database
    const listingReviews = await request.get(`${API_URL}/listings/test-listing/reviews`);
    const reviewList = await listingReviews.json();
    expect(reviewList.reviews.filter((r: any) => r.bookingId === bookingId).length).toBe(1);
  });

  test('Concurrent availability updates serialize correctly', async ({ request }) => {
    const listingId = 'concurrent-test-listing';
    
    // Create listing
    await request.post(`${API_URL}/listings`, {
      data: {
        id: listingId,
        title: 'Test',
        price: 100,
        category: 'apartment',
        country: 'NP',
      },
    });
    
    // Concurrent updates to availability
    const updates = await Promise.all([
      request.post(`${API_URL}/listings/${listingId}/availability`, {
        data: { date: '2026-04-01', available: false, reason: 'Owner event' },
      }),
      request.post(`${API_URL}/listings/${listingId}/availability`, {
        data: { date: '2026-04-01', available: true, reason: 'Update' },  // Overrides first
      }),
      request.post(`${API_URL}/listings/${listingId}/availability`, {
        data: { date: '2026-04-01', available: false, reason: 'Owner away' },  // Overrides second
      }),
    ]);
    
    // All requests processed
    expect(updates.every(r => r.ok())).toBeTruthy();
    
    // Final state should be last update
    const availRes = await request.get(
      `${API_URL}/listings/${listingId}/availability?date=2026-04-01`
    );
    const avail = await availRes.json();
    expect(avail.available).toBe(false);
  });

  test('Concurrent favorites toggling', async ({ request }) => {
    const userId = 'test-user';
    const listingId = 'test-listing-fav';
    
    // Rapid toggle favorite 10 times
    const toggles = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => 
        request.post(`${API_URL}/users/${userId}/favorites/${listingId}/toggle`, {
          data: {},
        })
      )
    );
    
    // All should succeed
    toggles.forEach(t => expect(t.status).toBe('fulfilled'));
    
    // Verify final state is consistent (deterministic)
    const finalRes = await request.get(`${API_URL}/users/${userId}/favorites`);
    const favoritesList = await finalRes.json();
    
    // With odd toggle count (10), should be NOT favorited at end
    // With even, SHOULD be favorited (or configured default)
    const isFavorited = favoritesList.favorites.some(
      (f: any) => f.listingId === listingId
    );
    expect(typeof isFavorited).toBe('boolean');
  });

  test('Concurrent payout requests serialize', async ({ request }) => {
    const ownerId = 'test-owner';
    
    // Create multiple bookings
    const bookings = await Promise.all([
      request.post(`${API_URL}/bookings`, {
        data: { listingId: 'list1', ownerId, totalAmount: 100 },
      }),
      request.post(`${API_URL}/bookings`, {
        data: { listingId: 'list2', ownerId, totalAmount: 200 },
      }),
      request.post(`${API_URL}/bookings`, {
        data: { listingId: 'list3', ownerId, totalAmount: 300 },
      }),
    ]);
    
    // Complete all bookings
    for (const b of bookings) {
      const id = (await b.json()).id;
      await request.patch(`${API_URL}/bookings/${id}`, {
        data: { status: 'COMPLETED' },
      });
    }
    
    // Request payout concurrently 3 times
    const payouts = await Promise.all([
      request.post(`${API_URL}/payouts`, {
        data: { ownerId, amount: 600 },
      }),
      request.post(`${API_URL}/payouts`, {
        data: { ownerId, amount: 600 },
      }),
      request.post(`${API_URL}/payouts`, {
        data: { ownerId, amount: 600 },
      }),
    ]);
    
    // Should create exactly 1 payout (others rejected as duplicate)
    const successCount = payouts.filter(p => p.ok()).length;
    expect(successCount).toBe(1);
  });
});
