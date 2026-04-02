import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/**
 * Comprehensive E2E tests for dispute flows with evidence upload
 */
describe('Dispute Flows with Evidence E2E', () => {
  let apiClient: any;
  let testBooking: any;
  let testUser: any;

  beforeEach(async () => {
    testUser = {
      id: 'user-1',
      role: 'RENTER',
    };

    testBooking = {
      id: 'booking-dispute-1',
      renterId: 'user-1',
      ownerId: 'owner-1',
      listingId: 'listing-1',
      status: 'IN_PROGRESS',
      totalPrice: 50000,
      securityDeposit: 10000,
    };
  });

  describe('Initiate Dispute', () => {
    it('should allow renter to initiate dispute during rental', async () => {
      const response = await apiClient.post(`/disputes`, {
        bookingId: testBooking.id,
        type: 'PROPERTY_DAMAGE',
        description: 'Item not as described',
        requestedAmount: 5000,
      });

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        bookingId: testBooking.id,
        initiatorId: testUser.id,
        type: 'PROPERTY_DAMAGE',
        status: 'OPEN',
      });
    });

    it('should allow owner to initiate dispute after return', async () => {
      const booking = {
        ...testBooking,
        status: 'AWAITING_RETURN_INSPECTION',
      };

      const response = await apiClient.post(
        `/disputes`,
        {
          bookingId: booking.id,
          type: 'PROPERTY_DAMAGE',
          description: 'Item damaged during rental',
          requestedAmount: 8000,
        },
        { headers: { 'X-User-Id': booking.ownerId } }
      );

      expect(response.data.initiatorId).toBe(booking.ownerId);
      expect(response.data.type).toBe('PROPERTY_DAMAGE');
    });

    it('should transition booking to DISPUTED status', async () => {
      await apiClient.post(`/disputes`, {
        bookingId: testBooking.id,
        type: 'PROPERTY_DAMAGE',
        description: 'Issue found',
      });

      const booking = await apiClient.get(`/bookings/${testBooking.id}`);
      expect(booking.data.status).toBe('DISPUTED');
    });

    it('should hold security deposit when dispute initiated', async () => {
      await apiClient.post(`/disputes`, {
        bookingId: testBooking.id,
        type: 'PROPERTY_DAMAGE',
        description: 'Damage found',
      });

      const depositHolds = await apiClient.get(
        `/deposit-holds?bookingId=${testBooking.id}`
      );
      expect(depositHolds.data[0].status).toBe('DISPUTED');
    });
  });

  describe('Evidence Upload', () => {
    let disputeId: string;

    beforeEach(async () => {
      const dispute = await apiClient.post(`/disputes`, {
        bookingId: testBooking.id,
        type: 'PROPERTY_DAMAGE',
        description: 'Damage claim',
      });
      disputeId = dispute.data.id;
    });

    it('should upload photo evidence', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['fake image'], { type: 'image/jpeg' }), 'damage.jpg');
      formData.append('description', 'Photo of damage');

      const response = await apiClient.post(
        `/disputes/${disputeId}/evidence`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        disputeId,
        type: 'PHOTO',
        description: 'Photo of damage',
      });
    });

    it('should upload multiple photos', async () => {
      const photos = [
        { name: 'damage1.jpg', content: 'photo1' },
        { name: 'damage2.jpg', content: 'photo2' },
        { name: 'damage3.jpg', content: 'photo3' },
      ];

      for (const photo of photos) {
        const formData = new FormData();
        formData.append('file', new Blob([photo.content], { type: 'image/jpeg' }), photo.name);

        await apiClient.post(`/disputes/${disputeId}/evidence`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      const evidence = await apiClient.get(`/disputes/${disputeId}/evidence`);
      expect(evidence.data).toHaveLength(3);
    });

    it('should upload document evidence', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob(['receipt content'], { type: 'application/pdf' }),
        'receipt.pdf'
      );
      formData.append('description', 'Repair receipt');

      const response = await apiClient.post(`/disputes/${disputeId}/evidence`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      expect(response.data.type).toBe('DOCUMENT');
    });

    it('should validate file size limits', async () => {
      const largeFile = new Blob([new Array(11 * 1024 * 1024).join('x')], {
        type: 'image/jpeg',
      }); // 11MB

      const formData = new FormData();
      formData.append('file', largeFile, 'large.jpg');

      await expect(
        apiClient.post(`/disputes/${disputeId}/evidence`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).rejects.toThrow(/file size/i);
    });

    it('should validate file types', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob(['executable'], { type: 'application/x-executable' }),
        'virus.exe'
      );

      await expect(
        apiClient.post(`/disputes/${disputeId}/evidence`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).rejects.toThrow(/file type/i);
    });

    it('should add text evidence', async () => {
      const response = await apiClient.post(`/disputes/${disputeId}/evidence`, {
        type: 'TEXT',
        content: 'Detailed description of the damage and timeline of events',
        description: 'Incident report',
      });

      expect(response.data.type).toBe('TEXT');
      expect(response.data.content).toContain('Detailed description');
    });

    it('should add communication evidence', async () => {
      const response = await apiClient.post(`/disputes/${disputeId}/evidence`, {
        type: 'COMMUNICATION',
        content: 'Message thread showing agreement',
        description: 'Chat history',
      });

      expect(response.data.type).toBe('COMMUNICATION');
    });
  });

  describe('Dispute Response', () => {
    let disputeId: string;

    beforeEach(async () => {
      const dispute = await apiClient.post(`/disputes`, {
        bookingId: testBooking.id,
        type: 'PROPERTY_DAMAGE',
        description: 'Renter claim',
      });
      disputeId = dispute.data.id;
    });

    it('should allow respondent to add response', async () => {
      const response = await apiClient.post(
        `/disputes/${disputeId}/responses`,
        {
          message: 'I disagree with this claim',
          counterAmount: 0,
        },
        { headers: { 'X-User-Id': testBooking.ownerId } }
      );

      expect(response.status).toBe(201);
      expect(response.data.respondentId).toBe(testBooking.ownerId);
    });

    it('should allow respondent to upload counter-evidence', async () => {
      // Add response
      await apiClient.post(
        `/disputes/${disputeId}/responses`,
        { message: 'Counter claim' },
        { headers: { 'X-User-Id': testBooking.ownerId } }
      );

      // Upload counter-evidence
      const formData = new FormData();
      formData.append(
        'file',
        new Blob(['counter photo'], { type: 'image/jpeg' }),
        'before.jpg'
      );

      const evidence = await apiClient.post(
        `/disputes/${disputeId}/evidence`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-User-Id': testBooking.ownerId,
          },
        }
      );

      expect(evidence.data.uploadedBy).toBe(testBooking.ownerId);
    });

    it('should update dispute status to UNDER_REVIEW', async () => {
      await apiClient.post(
        `/disputes/${disputeId}/responses`,
        { message: 'Response' },
        { headers: { 'X-User-Id': testBooking.ownerId } }
      );

      const dispute = await apiClient.get(`/disputes/${disputeId}`);
      expect(dispute.data.status).toBe('UNDER_REVIEW');
    });
  });

  describe('Admin Review', () => {
    let disputeId: string;

    beforeEach(async () => {
      const dispute = await apiClient.post(`/disputes`, {
        bookingId: testBooking.id,
        type: 'PROPERTY_DAMAGE',
        description: 'Damage claim',
        requestedAmount: 5000,
      });
      disputeId = dispute.data.id;

      // Add response
      await apiClient.post(
        `/disputes/${disputeId}/responses`,
        { message: 'Counter' },
        { headers: { 'X-User-Id': testBooking.ownerId } }
      );
    });

    it('should allow admin to review evidence', async () => {
      const evidence = await apiClient.get(`/disputes/${disputeId}/evidence`, {
        headers: { 'X-User-Id': 'admin-1', 'X-User-Role': 'ADMIN' },
      });

      expect(evidence.status).toBe(200);
      expect(Array.isArray(evidence.data)).toBe(true);
    });

    it('should allow admin to add internal notes', async () => {
      const response = await apiClient.post(
        `/disputes/${disputeId}/notes`,
        {
          content: 'Evidence appears legitimate',
          visibility: 'INTERNAL',
        },
        { headers: { 'X-User-Id': 'admin-1', 'X-User-Role': 'ADMIN' } }
      );

      expect(response.data.visibility).toBe('INTERNAL');
    });

    it('should allow admin to request additional evidence', async () => {
      const response = await apiClient.post(
        `/disputes/${disputeId}/evidence-requests`,
        {
          requestedFrom: testBooking.renterId,
          description: 'Please provide photos from before rental',
        },
        { headers: { 'X-User-Id': 'admin-1', 'X-User-Role': 'ADMIN' } }
      );

      expect(response.status).toBe(201);

      // Verify notification sent
      const notifications = await apiClient.get(
        `/notifications?userId=${testBooking.renterId}`
      );
      expect(notifications.data).toContainEqual(
        expect.objectContaining({
          type: 'EVIDENCE_REQUESTED',
          disputeId,
        })
      );
    });
  });

  describe('Dispute Resolution', () => {
    let disputeId: string;

    beforeEach(async () => {
      const dispute = await apiClient.post(`/disputes`, {
        bookingId: testBooking.id,
        type: 'PROPERTY_DAMAGE',
        description: 'Damage claim',
        requestedAmount: 5000,
      });
      disputeId = dispute.data.id;
    });

    it('should resolve in favor of owner', async () => {
      const response = await apiClient.post(
        `/disputes/${disputeId}/resolve`,
        {
          decision: 'OWNER_FAVOR',
          awardedAmount: 5000,
          reasoning: 'Evidence supports owner claim',
        },
        { headers: { 'X-User-Id': 'admin-1', 'X-User-Role': 'ADMIN' } }
      );

      expect(response.data.status).toBe('RESOLVED');
      expect(response.data.resolution.decision).toBe('OWNER_FAVOR');

      // Verify booking transitioned
      const booking = await apiClient.get(`/bookings/${testBooking.id}`);
      expect(booking.data.status).toBe('COMPLETED');

      // Verify deposit captured
      const depositHolds = await apiClient.get(
        `/deposit-holds?bookingId=${testBooking.id}`
      );
      expect(depositHolds.data[0].status).toBe('CAPTURED');
    });

    it('should resolve in favor of renter', async () => {
      const response = await apiClient.post(
        `/disputes/${disputeId}/resolve`,
        {
          decision: 'RENTER_FAVOR',
          awardedAmount: 0,
          reasoning: 'Insufficient evidence',
        },
        { headers: { 'X-User-Id': 'admin-1', 'X-User-Role': 'ADMIN' } }
      );

      expect(response.data.resolution.decision).toBe('RENTER_FAVOR');

      // Verify booking transitioned to REFUNDED
      const booking = await apiClient.get(`/bookings/${testBooking.id}`);
      expect(booking.data.status).toBe('REFUNDED');

      // Verify deposit released
      const depositHolds = await apiClient.get(
        `/deposit-holds?bookingId=${testBooking.id}`
      );
      expect(depositHolds.data[0].status).toBe('RELEASED');
    });

    it('should resolve with partial award', async () => {
      const response = await apiClient.post(
        `/disputes/${disputeId}/resolve`,
        {
          decision: 'PARTIAL',
          awardedAmount: 2500,
          reasoning: 'Shared responsibility',
        },
        { headers: { 'X-User-Id': 'admin-1', 'X-User-Role': 'ADMIN' } }
      );

      expect(response.data.resolution.awardedAmount).toBe(2500);

      // Verify partial refund processed
      await waitFor(
        async () => {
          const refunds = await apiClient.get(`/refunds?bookingId=${testBooking.id}`);
          expect(refunds.data[0].amount).toBe(2500);
        },
        { timeout: 5000 }
      );
    });

    it('should send resolution notifications to both parties', async () => {
      await apiClient.post(
        `/disputes/${disputeId}/resolve`,
        {
          decision: 'OWNER_FAVOR',
          awardedAmount: 5000,
        },
        { headers: { 'X-User-Id': 'admin-1', 'X-User-Role': 'ADMIN' } }
      );

      const renterNotifications = await apiClient.get(
        `/notifications?userId=${testBooking.renterId}`
      );
      const ownerNotifications = await apiClient.get(
        `/notifications?userId=${testBooking.ownerId}`
      );

      expect(renterNotifications.data).toContainEqual(
        expect.objectContaining({
          type: 'DISPUTE_RESOLVED',
          disputeId,
        })
      );
      expect(ownerNotifications.data).toContainEqual(
        expect.objectContaining({
          type: 'DISPUTE_RESOLVED',
          disputeId,
        })
      );
    });
  });

  describe('Dispute Timeline', () => {
    it('should track all dispute events', async () => {
      // Create dispute
      const dispute = await apiClient.post(`/disputes`, {
        bookingId: testBooking.id,
        type: 'PROPERTY_DAMAGE',
        description: 'Claim',
      });

      // Add evidence
      await apiClient.post(`/disputes/${dispute.data.id}/evidence`, {
        type: 'TEXT',
        content: 'Evidence',
      });

      // Add response
      await apiClient.post(
        `/disputes/${dispute.data.id}/responses`,
        { message: 'Response' },
        { headers: { 'X-User-Id': testBooking.ownerId } }
      );

      // Get timeline
      const timeline = await apiClient.get(`/disputes/${dispute.data.id}/timeline`);

      expect(timeline.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ event: 'DISPUTE_CREATED' }),
          expect.objectContaining({ event: 'EVIDENCE_ADDED' }),
          expect.objectContaining({ event: 'RESPONSE_ADDED' }),
        ])
      );
    });
  });

  describe('Edge Cases', () => {
    it('should prevent duplicate disputes for same booking', async () => {
      await apiClient.post(`/disputes`, {
        bookingId: testBooking.id,
        type: 'PROPERTY_DAMAGE',
        description: 'First dispute',
      });

      await expect(
        apiClient.post(`/disputes`, {
          bookingId: testBooking.id,
          type: 'PAYMENT_ISSUE',
          description: 'Second dispute',
        })
      ).rejects.toThrow(/active dispute/i);
    });

    it('should handle evidence upload failures gracefully', async () => {
      const dispute = await apiClient.post(`/disputes`, {
        bookingId: testBooking.id,
        type: 'PROPERTY_DAMAGE',
        description: 'Claim',
      });

      // Simulate upload failure
      const formData = new FormData();
      formData.append('file', new Blob(['corrupted'], { type: 'image/jpeg' }), 'bad.jpg');

      await expect(
        apiClient.post(`/disputes/${dispute.data.id}/evidence`, formData)
      ).rejects.toThrow();

      // Dispute should still be accessible
      const disputeData = await apiClient.get(`/disputes/${dispute.data.id}`);
      expect(disputeData.data.status).toBe('OPEN');
    });

    it('should handle concurrent evidence uploads', async () => {
      const dispute = await apiClient.post(`/disputes`, {
        bookingId: testBooking.id,
        type: 'PROPERTY_DAMAGE',
        description: 'Claim',
      });

      const uploads = Array(5)
        .fill(null)
        .map((_, i) => {
          const formData = new FormData();
          formData.append(
            'file',
            new Blob([`photo${i}`], { type: 'image/jpeg' }),
            `photo${i}.jpg`
          );
          return apiClient.post(`/disputes/${dispute.data.id}/evidence`, formData);
        });

      const results = await Promise.allSettled(uploads);
      const successful = results.filter((r) => r.status === 'fulfilled');

      expect(successful.length).toBe(5);
    });
  });
});
