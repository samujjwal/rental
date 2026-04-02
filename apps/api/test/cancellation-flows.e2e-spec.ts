import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/**
 * Comprehensive E2E tests for cancellation flows
 * Tests all cancellation scenarios with refund calculations
 */
describe('Cancellation Flows E2E', () => {
  let apiClient: any;
  let testBooking: any;

  beforeEach(async () => {
    // Setup test data
    testBooking = {
      id: 'booking-test-1',
      renterId: 'renter-1',
      ownerId: 'owner-1',
      listingId: 'listing-1',
      status: 'PENDING_OWNER_APPROVAL',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      totalPrice: 50000,
      basePrice: 45000,
      serviceFee: 5000,
      currency: 'NPR',
      cancellationPolicy: {
        type: 'FLEXIBLE',
        fullRefundHours: 24,
        partialRefundHours: 12,
        partialRefundPercent: 50,
      },
    };
  });

  describe('Cancel Before Owner Approval', () => {
    it('should allow renter to cancel with full refund', async () => {
      // Arrange
      const booking = { ...testBooking, status: 'PENDING_OWNER_APPROVAL' };

      // Act
      const response = await apiClient.post(`/bookings/${booking.id}/cancel`, {
        reason: 'Changed plans',
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('CANCELLED');
      expect(response.data.refund).toEqual({
        refundAmount: 50000,
        cancellationFee: 0,
        reason: 'cancelled_before_approval',
      });
    });

    it('should notify both parties of cancellation', async () => {
      const booking = { ...testBooking, status: 'PENDING_OWNER_APPROVAL' };

      await apiClient.post(`/bookings/${booking.id}/cancel`, {
        reason: 'Changed plans',
      });

      // Verify notifications sent
      const renterNotifications = await apiClient.get(
        `/notifications?userId=${booking.renterId}`
      );
      const ownerNotifications = await apiClient.get(
        `/notifications?userId=${booking.ownerId}`
      );

      expect(renterNotifications.data).toContainEqual(
        expect.objectContaining({
          type: 'BOOKING_CANCELLED',
          bookingId: booking.id,
        })
      );
      expect(ownerNotifications.data).toContainEqual(
        expect.objectContaining({
          type: 'BOOKING_CANCELLED',
          bookingId: booking.id,
        })
      );
    });

    it('should not process payment if cancelled before approval', async () => {
      const booking = { ...testBooking, status: 'PENDING_OWNER_APPROVAL' };

      await apiClient.post(`/bookings/${booking.id}/cancel`);

      const payments = await apiClient.get(`/payments?bookingId=${booking.id}`);
      expect(payments.data).toHaveLength(0);
    });
  });

  describe('Cancel After Approval, Before Payment', () => {
    it('should cancel with full refund (flexible policy)', async () => {
      const booking = {
        ...testBooking,
        status: 'PENDING_PAYMENT',
        cancellationPolicy: { type: 'FLEXIBLE', fullRefundHours: 24 },
      };

      const response = await apiClient.post(`/bookings/${booking.id}/cancel`, {
        reason: 'Payment issue',
      });

      expect(response.data.refund.refundAmount).toBe(50000);
      expect(response.data.refund.cancellationFee).toBe(0);
    });

    it('should apply cancellation fee (strict policy)', async () => {
      const booking = {
        ...testBooking,
        status: 'PENDING_PAYMENT',
        cancellationPolicy: { type: 'STRICT', noRefundHours: 48 },
      };

      const response = await apiClient.post(`/bookings/${booking.id}/cancel`);

      expect(response.data.refund.refundAmount).toBe(0);
      expect(response.data.refund.cancellationFee).toBe(50000);
    });
  });

  describe('Cancel After Payment, Before Start', () => {
    it('should process full refund within flexible window', async () => {
      const booking = {
        ...testBooking,
        status: 'CONFIRMED',
        paymentIntentId: 'pi_test_123',
        startDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
        cancellationPolicy: { type: 'FLEXIBLE', fullRefundHours: 24 },
      };

      const response = await apiClient.post(`/bookings/${booking.id}/cancel`, {
        reason: 'Emergency',
      });

      expect(response.data.status).toBe('CANCELLED');
      expect(response.data.refund.refundAmount).toBe(50000);

      // Wait for refund processing
      await waitFor(
        async () => {
          const refund = await apiClient.get(`/refunds?bookingId=${booking.id}`);
          expect(refund.data[0].status).toBe('COMPLETED');
        },
        { timeout: 5000 }
      );
    });

    it('should process partial refund outside flexible window', async () => {
      const booking = {
        ...testBooking,
        status: 'CONFIRMED',
        paymentIntentId: 'pi_test_123',
        startDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
        cancellationPolicy: {
          type: 'MODERATE',
          fullRefundHours: 24,
          partialRefundPercent: 50,
        },
      };

      const response = await apiClient.post(`/bookings/${booking.id}/cancel`);

      expect(response.data.refund.refundAmount).toBe(25000); // 50% of 50000
      expect(response.data.refund.cancellationFee).toBe(25000);
    });

    it('should process no refund for strict policy', async () => {
      const booking = {
        ...testBooking,
        status: 'CONFIRMED',
        paymentIntentId: 'pi_test_123',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        cancellationPolicy: { type: 'STRICT', noRefundHours: 48 },
      };

      const response = await apiClient.post(`/bookings/${booking.id}/cancel`);

      expect(response.data.refund.refundAmount).toBe(0);
      expect(response.data.refund.cancellationFee).toBe(50000);
    });

    it('should handle Stripe refund webhook correctly', async () => {
      const booking = {
        ...testBooking,
        status: 'CONFIRMED',
        paymentIntentId: 'pi_test_123',
      };

      // Cancel booking
      await apiClient.post(`/bookings/${booking.id}/cancel`);

      // Simulate Stripe webhook
      await apiClient.post('/webhooks/stripe', {
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_test_123',
            amount: 5000000, // 50000 in minor units
            amount_refunded: 5000000,
            refunds: {
              data: [
                {
                  id: 're_test_123',
                  amount: 5000000,
                  status: 'succeeded',
                },
              ],
            },
          },
        },
      });

      // Verify booking transitioned to REFUNDED
      const updatedBooking = await apiClient.get(`/bookings/${booking.id}`);
      expect(updatedBooking.data.status).toBe('REFUNDED');
    });
  });

  describe('Cancel During Rental', () => {
    it('should process prorated refund', async () => {
      const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // Started 2 days ago
      const endDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // Ends in 3 days
      const booking = {
        ...testBooking,
        status: 'IN_PROGRESS',
        paymentIntentId: 'pi_test_123',
        startDate,
        endDate,
        basePrice: 50000, // 10000 per day for 5 days
      };

      const response = await apiClient.post(`/bookings/${booking.id}/cancel`, {
        reason: 'Early return',
      });

      // Should refund for unused 3 days
      expect(response.data.refund.refundAmount).toBe(30000);
      expect(response.data.refund.reason).toBe('prorated_refund');
    });

    it('should not refund for past days', async () => {
      const startDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
      const booking = {
        ...testBooking,
        status: 'IN_PROGRESS',
        startDate,
        endDate,
        basePrice: 50000, // 10000 per day for 5 days
      };

      const response = await apiClient.post(`/bookings/${booking.id}/cancel`);

      // Should only refund 1 remaining day
      expect(response.data.refund.refundAmount).toBe(10000);
    });

    it('should handle security deposit correctly', async () => {
      const booking = {
        ...testBooking,
        status: 'IN_PROGRESS',
        securityDeposit: 10000,
      };

      await apiClient.post(`/bookings/${booking.id}/cancel`);

      // Security deposit should be held until inspection
      const depositHolds = await apiClient.get(`/deposit-holds?bookingId=${booking.id}`);
      expect(depositHolds.data[0].status).toBe('HELD');
    });
  });

  describe('Owner Cancellation', () => {
    it('should allow owner to cancel before start', async () => {
      const booking = { ...testBooking, status: 'CONFIRMED' };

      const response = await apiClient.post(
        `/bookings/${booking.id}/cancel`,
        { reason: 'Property unavailable' },
        { headers: { 'X-User-Id': booking.ownerId } }
      );

      expect(response.data.status).toBe('CANCELLED');
    });

    it('should provide full refund for owner cancellation', async () => {
      const booking = {
        ...testBooking,
        status: 'CONFIRMED',
        paymentIntentId: 'pi_test_123',
      };

      const response = await apiClient.post(
        `/bookings/${booking.id}/cancel`,
        { reason: 'Emergency maintenance' },
        { headers: { 'X-User-Id': booking.ownerId } }
      );

      // Owner cancellation always results in full refund
      expect(response.data.refund.refundAmount).toBe(50000);
      expect(response.data.refund.reason).toBe('cancelled_by_owner');
    });

    it('should penalize owner for late cancellation', async () => {
      const booking = {
        ...testBooking,
        status: 'CONFIRMED',
        startDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
      };

      await apiClient.post(
        `/bookings/${booking.id}/cancel`,
        { reason: 'Changed mind' },
        { headers: { 'X-User-Id': booking.ownerId } }
      );

      // Verify owner penalty recorded
      const penalties = await apiClient.get(`/penalties?ownerId=${booking.ownerId}`);
      expect(penalties.data).toContainEqual(
        expect.objectContaining({
          type: 'LATE_CANCELLATION',
          bookingId: booking.id,
        })
      );
    });
  });

  describe('Cancellation Edge Cases', () => {
    it('should handle concurrent cancellation attempts', async () => {
      const booking = { ...testBooking, status: 'CONFIRMED' };

      // Attempt to cancel twice simultaneously
      const [response1, response2] = await Promise.allSettled([
        apiClient.post(`/bookings/${booking.id}/cancel`),
        apiClient.post(`/bookings/${booking.id}/cancel`),
      ]);

      // One should succeed, one should fail
      expect(
        (response1.status === 'fulfilled' && response2.status === 'rejected') ||
          (response1.status === 'rejected' && response2.status === 'fulfilled')
      ).toBe(true);
    });

    it('should handle cancellation with expired payment', async () => {
      const booking = {
        ...testBooking,
        status: 'PAYMENT_FAILED',
      };

      const response = await apiClient.post(`/bookings/${booking.id}/cancel`);

      expect(response.data.status).toBe('CANCELLED');
      expect(response.data.refund).toBeUndefined(); // No refund for failed payment
    });

    it('should handle timezone differences correctly', async () => {
      const booking = {
        ...testBooking,
        status: 'CONFIRMED',
        startDate: new Date('2026-05-01T00:00:00+05:45'), // Nepal timezone
        cancellationPolicy: { type: 'FLEXIBLE', fullRefundHours: 24 },
      };

      // Cancel 23 hours before start in UTC (should still be within 24h window)
      const response = await apiClient.post(`/bookings/${booking.id}/cancel`);

      expect(response.data.refund.refundAmount).toBe(50000); // Full refund
    });

    it('should handle cancellation during webhook processing', async () => {
      const booking = {
        ...testBooking,
        status: 'PENDING_PAYMENT',
      };

      // Start payment processing
      const paymentPromise = apiClient.post(`/payments/${booking.id}/process`);

      // Attempt cancellation during payment
      const cancelPromise = apiClient.post(`/bookings/${booking.id}/cancel`);

      const [paymentResult, cancelResult] = await Promise.allSettled([
        paymentPromise,
        cancelPromise,
      ]);

      // Should handle gracefully - either payment succeeds and then cancels with refund,
      // or cancellation prevents payment
      expect(
        paymentResult.status === 'fulfilled' || cancelResult.status === 'fulfilled'
      ).toBe(true);
    });
  });

  describe('Refund Processing', () => {
    it('should retry failed refunds', async () => {
      const booking = {
        ...testBooking,
        status: 'CONFIRMED',
        paymentIntentId: 'pi_test_123',
      };

      // Cancel booking
      await apiClient.post(`/bookings/${booking.id}/cancel`);

      // Simulate refund failure
      await apiClient.post('/webhooks/stripe', {
        type: 'charge.refund.failed',
        data: {
          object: {
            id: 're_test_123',
            status: 'failed',
          },
        },
      });

      // Verify retry scheduled
      await waitFor(
        async () => {
          const refund = await apiClient.get(`/refunds?bookingId=${booking.id}`);
          expect(refund.data[0].retryCount).toBeGreaterThan(0);
        },
        { timeout: 10000 }
      );
    });

    it('should handle partial refund for ACH payments', async () => {
      const booking = {
        ...testBooking,
        status: 'CONFIRMED',
        paymentMethod: 'ACH',
        paymentIntentId: 'pi_test_ach_123',
      };

      await apiClient.post(`/bookings/${booking.id}/cancel`);

      // ACH refunds take longer
      await waitFor(
        async () => {
          const refund = await apiClient.get(`/refunds?bookingId=${booking.id}`);
          expect(refund.data[0].status).toBe('PENDING');
        },
        { timeout: 2000 }
      );

      // Simulate ACH refund completion
      await apiClient.post('/webhooks/stripe', {
        type: 'refund.updated',
        data: {
          object: {
            id: 're_test_ach_123',
            status: 'succeeded',
          },
        },
      });

      const finalRefund = await apiClient.get(`/refunds?bookingId=${booking.id}`);
      expect(finalRefund.data[0].status).toBe('COMPLETED');
    });
  });
});
