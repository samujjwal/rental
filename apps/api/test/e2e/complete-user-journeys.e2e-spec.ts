import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Complete User Journey E2E Tests', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;
  let listingId: string;
  let bookingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('New User Onboarding Journey', () => {
    it('should complete full registration to first booking flow', async () => {
      // Step 1: User Registration
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'SecurePassword123!',
          firstName: 'John',
          lastName: 'Doe',
        })
        .expect(201);

      const { user, token } = registerResponse.body;
      userId = user.id;
      accessToken = token;

      // Step 2: Email Verification
      await request(app.getHttpServer())
        .post('/api/auth/verify-email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          token: 'verification-token',
        })
        .expect(200);

      // Step 3: Complete Profile Setup
      await request(app.getHttpServer())
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          bio: 'Love traveling and exploring new places',
          addressLine1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'USA',
          preferredLanguage: 'en',
          preferredCurrency: 'USD',
          timezone: 'America/New_York',
        })
        .expect(200);

      // Step 4: Upload Profile Photo
      await request(app.getHttpServer())
        .post('/api/users/profile-photo')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('photo', Buffer.from('fake-image-data'), 'profile.jpg')
        .expect(200);

      // Step 5: Search for Properties
      const searchResponse = await request(app.getHttpServer())
        .get('/api/listings/search')
        .query({
          query: 'apartment in New York',
          minPrice: 50,
          maxPrice: 200,
          page: 1,
          size: 10,
        })
        .expect(200);

      expect(searchResponse.body.results).toBeDefined();
      expect(searchResponse.body.results.length).toBeGreaterThan(0);

      listingId = searchResponse.body.results[0].id;

      // Step 6: View Property Details
      await request(app.getHttpServer()).get(`/api/listings/${listingId}`).expect(200);

      // Step 7: Check Availability
      const availabilityResponse = await request(app.getHttpServer())
        .get(`/api/listings/${listingId}/availability`)
        .query({
          startDate: '2026-05-01',
          endDate: '2026-05-03',
        })
        .expect(200);

      expect(availabilityResponse.body.isAvailable).toBe(true);

      // Step 8: Create Booking Request
      const bookingResponse = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          listingId,
          startDate: '2026-05-01',
          endDate: '2026-05-03',
          guestCount: 2,
          specialRequests: 'Early check-in if possible',
        })
        .expect(201);

      const booking = bookingResponse.body;
      bookingId = booking.id;
      expect(booking.status).toBe('PENDING');

      // Step 9: Process Payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bookingId,
          amount: booking.totalPrice,
          currency: booking.currency,
        })
        .expect(201);

      const { clientSecret, paymentIntentId } = paymentResponse.body;

      // Step 10: Confirm Payment (Mock Stripe webhook)
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: paymentIntentId,
              status: 'succeeded',
              metadata: { bookingId },
            },
          },
        })
        .expect(200);

      // Step 11: Verify Booking Confirmation
      const confirmedBooking = await request(app.getHttpServer())
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(confirmedBooking.body.status).toBe('CONFIRMED');

      // Step 12: Receive Confirmation Email (Mock)
      // This would be verified through email service logs

      // Step 13: Add to Favorites
      await request(app.getHttpServer())
        .post(`/api/users/favorites/${listingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      // Step 14: Leave Review (after booking completion)
      // First complete the booking
      await request(app.getHttpServer())
        .put(`/api/bookings/${bookingId}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Then leave review
      await request(app.getHttpServer())
        .post(`/api/reviews`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bookingId,
          listingId,
          rating: 5,
          comment: 'Amazing place! Would definitely stay again.',
        })
        .expect(201);
    });
  });

  describe('Host Listing Management Journey', () => {
    it('should manage complete listing lifecycle', async () => {
      // Step 1: Upgrade to Host
      await request(app.getHttpServer())
        .post('/api/users/upgrade-to-host')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Step 2: Create New Listing
      const listingResponse = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Cozy Downtown Apartment',
          description: 'Perfect for couples, close to all attractions',
          address: '456 Market St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'USA',
          latitude: 37.7749,
          longitude: -122.4194,
          type: 'APARTMENT',
          bedrooms: 1,
          bathrooms: 1,
          maxGuests: 2,
          basePrice: 150,
          currency: 'USD',
          amenities: ['wifi', 'kitchen', 'parking'],
          features: ['elevator', 'gym'],
          photos: [
            'https://example.com/photo1.jpg',
            'https://example.com/photo2.jpg',
            'https://example.com/photo3.jpg',
          ],
          rules: ['No smoking', 'No parties'],
          instantBookable: true,
          minStayNights: 2,
          checkInTime: '15:00',
          checkOutTime: '11:00',
        })
        .expect(201);

      const newListing = listingResponse.body;
      const hostListingId = newListing.id;

      // Step 3: Set Availability
      await request(app.getHttpServer())
        .post(`/api/listings/${hostListingId}/availability`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          status: 'AVAILABLE',
          price: 150,
        })
        .expect(201);

      // Step 4: Manage Booking Requests
      // Simulate receiving booking requests
      const guestBooking = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`) // Using same token for simplicity
        .send({
          listingId: hostListingId,
          startDate: '2026-06-10',
          endDate: '2026-06-12',
          guestCount: 1,
        })
        .expect(201);

      // Step 5: Accept Booking
      await request(app.getHttpServer())
        .put(`/api/bookings/${guestBooking.body.id}/accept`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Step 6: Handle Check-in/Check-out
      await request(app.getHttpServer())
        .post(`/api/bookings/${guestBooking.body.id}/checkin`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          conditionReport: {
            photos: ['https://example.com/checkin.jpg'],
            notes: 'Property in good condition',
          },
        })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/bookings/${guestBooking.body.id}/checkout`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          conditionReport: {
            photos: ['https://example.com/checkout.jpg'],
            notes: 'Minor wear and tear',
            damages: 'Small scratch on wall',
          },
        })
        .expect(200);

      // Step 7: Process Security Deposit
      await request(app.getHttpServer())
        .post(`/api/bookings/${guestBooking.body.id}/deposit/capture`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 50,
          reason: 'Small scratch repair',
        })
        .expect(200);

      // Step 8: Handle Payout
      await request(app.getHttpServer())
        .post(`/api/payouts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bookingId: guestBooking.body.id,
          amount: 135, // After fees
          currency: 'USD',
        })
        .expect(201);

      // Step 9: Respond to Reviews
      await request(app.getHttpServer())
        .post(`/api/reviews/${guestBooking.body.id}/response`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          response: 'Thank you for staying with us! We appreciate your feedback.',
        })
        .expect(201);

      // Step 10: Update Listing
      await request(app.getHttpServer())
        .put(`/api/listings/${hostListingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Cozy Downtown Apartment - UPDATED',
          basePrice: 160,
          amenities: ['wifi', 'kitchen', 'parking', 'netflix'],
        })
        .expect(200);

      // Step 11: Deactivate Listing
      await request(app.getHttpServer())
        .put(`/api/listings/${hostListingId}/deactivate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe('Dispute Resolution Journey', () => {
    it('should handle complete dispute process', async () => {
      // Step 1: Create Problematic Booking
      const problemBooking = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          listingId,
          startDate: '2026-07-01',
          endDate: '2026-07-03',
          guestCount: 2,
        })
        .expect(201);

      // Step 2: Complete Booking with Issues
      await request(app.getHttpServer())
        .put(`/api/bookings/${problemBooking.body.id}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Step 3: Guest Files Dispute
      const disputeResponse = await request(app.getHttpServer())
        .post('/api/disputes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bookingId: problemBooking.body.id,
          type: 'PROPERTY_DAMAGE',
          title: 'Damaged furniture',
          description: 'The coffee table was broken during the stay',
          amount: 200,
        })
        .expect(201);

      const dispute = disputeResponse.body;

      // Step 4: Upload Evidence
      await request(app.getHttpServer())
        .post(`/api/disputes/${dispute.id}/evidence`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('photo', Buffer.from('damage-photo'), 'damage.jpg')
        .attach('receipt', Buffer.from('repair-receipt'), 'receipt.pdf')
        .expect(201);

      // Step 5: Host Responds
      await request(app.getHttpServer())
        .post(`/api/disputes/${dispute.id}/response`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          response: 'The damage was pre-existing. Here is proof from previous inspection.',
          evidence: ['https://example.com/pre-existing-damage.jpg'],
        })
        .expect(201);

      // Step 6: Mediator Reviews
      // Simulate mediator action
      await request(app.getHttpServer())
        .put(`/api/disputes/${dispute.id}/assign-mediator`)
        .set('Authorization', `Bearer ${accessToken}`) // Admin endpoint
        .send({
          mediatorId: 'mediator-123',
        })
        .expect(200);

      // Step 7: Investigation
      await request(app.getHttpServer())
        .post(`/api/disputes/${dispute.id}/investigation`)
        .set('Authorization', `Bearer ${accessToken}`) // Mediator endpoint
        .send({
          findings: 'Evidence suggests damage occurred during stay',
          recommendation: 'Partial refund to guest',
        })
        .expect(200);

      // Step 8: Resolution
      const resolutionResponse = await request(app.getHttpServer())
        .post(`/api/disputes/${dispute.id}/resolve`)
        .set('Authorization', `Bearer ${accessToken}`) // Mediator endpoint
        .send({
          type: 'PARTIAL_REFUND',
          amount: 100,
          reason: 'Shared responsibility for damage',
          payoutToGuest: true,
        })
        .expect(201);

      expect(resolutionResponse.body.status).toBe('RESOLVED');

      // Step 9: Process Refund
      await request(app.getHttpServer())
        .post(`/api/payments/refund`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bookingId: problemBooking.body.id,
          amount: 100,
          reason: 'Dispute resolution',
        })
        .expect(201);

      // Step 10: Update Host Rating
      await request(app.getHttpServer())
        .put(`/api/users/${userId}/rating`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          rating: 3.5,
          review: 'Dispute handled professionally',
        })
        .expect(200);
    });
  });

  describe('Multi-Platform Integration Journey', () => {
    it('should sync data across platforms', async () => {
      // Step 1: Update Profile on Web
      await request(app.getHttpServer())
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bio: 'Updated bio from web platform',
        })
        .expect(200);

      // Step 2: Verify Mobile Sync
      const mobileProfile = await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Platform', 'mobile')
        .expect(200);

      expect(mobileProfile.body.bio).toBe('Updated bio from web platform');

      // Step 3: Create Booking on Mobile
      const mobileBooking = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Platform', 'mobile')
        .send({
          listingId,
          startDate: '2026-08-01',
          endDate: '2026-08-02',
          guestCount: 1,
        })
        .expect(201);

      // Step 4: Verify on Web Platform
      const webBooking = await request(app.getHttpServer())
        .get(`/api/bookings/${mobileBooking.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Platform', 'web')
        .expect(200);

      expect(webBooking.body.id).toBe(mobileBooking.body.id);

      // Step 5: Cross-Platform Notifications
      // Simulate notification preferences
      await request(app.getHttpServer())
        .put('/api/users/notification-preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          emailNotifications: true,
          pushNotifications: true,
          smsNotifications: false,
          platforms: ['web', 'mobile'],
        })
        .expect(200);
    });
  });

  describe('Data Privacy Journey', () => {
    it('should handle GDPR compliance flow', async () => {
      // Step 1: Request Data Export
      const exportResponse = await request(app.getHttpServer())
        .post('/api/users/data-export')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          format: 'json',
          includeBookings: true,
          includePayments: false,
        })
        .expect(200);

      expect(exportResponse.body.downloadUrl).toBeDefined();

      // Step 2: Download Data Package
      const dataPackage = await request(app.getHttpServer())
        .get(exportResponse.body.downloadUrl)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(dataPackage.body.user).toBeDefined();
      expect(dataPackage.body.bookings).toBeDefined();

      // Step 3: Request Account Deletion
      await request(app.getHttpServer())
        .post('/api/users/request-deletion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          reason: 'No longer using the service',
          confirmIdentity: true,
        })
        .expect(200);

      // Step 4: Confirm Deletion (after grace period)
      // In real scenario, this would happen after 30 days
      await request(app.getHttpServer())
        .delete('/api/users/account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          confirmationCode: 'deletion-code',
        })
        .expect(200);

      // Step 5: Verify Data Anonymization
      const deletedUser = await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      // Verify data is anonymized in database
      // This would be checked through admin endpoints or direct DB access
    });
  });

  describe('KYC Verification Journey', () => {
    it('should complete full host verification flow', async () => {
      // Step 1: Initiate KYC Process
      await request(app.getHttpServer())
        .post('/api/users/kyc/initiate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          verificationType: 'host_verification',
          documentTypes: ['passport', 'utility_bill', 'bank_statement'],
        })
        .expect(200);

      // Step 2: Upload Passport
      await request(app.getHttpServer())
        .post('/api/users/kyc/upload-document')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('document', Buffer.from('passport-data'), 'passport.pdf')
        .field('documentType', 'passport')
        .field('country', 'USA')
        .expect(200);

      // Step 3: Upload Utility Bill
      await request(app.getHttpServer())
        .post('/api/users/kyc/upload-document')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('document', Buffer.from('utility-bill-data'), 'utility_bill.pdf')
        .field('documentType', 'utility_bill')
        .field('address', '123 Main St, New York, NY 10001')
        .expect(200);

      // Step 4: Upload Bank Statement
      await request(app.getHttpServer())
        .post('/api/users/kyc/upload-document')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('document', Buffer.from('bank-statement-data'), 'bank_statement.pdf')
        .field('documentType', 'bank_statement')
        .field('accountHolder', 'John Doe')
        .expect(200);

      // Step 5: Submit for Review
      await request(app.getHttpServer())
        .post('/api/users/kyc/submit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          confirmation: true,
          agreedToTerms: true,
        })
        .expect(200);

      // Step 6: Mock Verification Approval
      await request(app.getHttpServer())
        .post('/api/admin/kyc/approve')
        .set('Authorization', `Bearer ${accessToken}`) // Admin token
        .send({
          userId,
          verificationId: 'kyc-123',
          status: 'APPROVED',
          notes: 'All documents verified successfully',
        })
        .expect(200);

      // Step 7: Verify Host Status
      const profileResponse = await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.verificationStatus).toBe('VERIFIED');
      expect(profileResponse.body.hostStatus).toBe('ACTIVE');
    });
  });

  describe('Advanced Booking Flow Journey', () => {
    it('should handle complex multi-destination booking', async () => {
      // Step 1: Search Multiple Destinations
      const multiSearchResponse = await request(app.getHttpServer())
        .post('/api/listings/multi-search')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          destinations: [
            { city: 'New York', checkIn: '2026-06-01', checkOut: '2026-06-03' },
            { city: 'Boston', checkIn: '2026-06-05', checkOut: '2026-06-07' },
            { city: 'Philadelphia', checkIn: '2026-06-09', checkOut: '2026-06-11' },
          ],
          guests: 2,
          priceRange: { min: 100, max: 300 },
        })
        .expect(200);

      expect(multiSearchResponse.body.searchResults).toHaveLength(3);

      // Step 2: Create Multi-Booking Package
      const packageResponse = await request(app.getHttpServer())
        .post('/api/bookings/create-package')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'East Coast Adventure',
          destinations: multiSearchResponse.body.searchResults.map((r) => ({
            listingId: r.listings[0].id,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
          })),
          guests: 2,
          specialRequests: 'Late check-in preferred for first destination',
        })
        .expect(201);

      const bookingPackage = packageResponse.body;
      expect(bookingPackage.bookings).toHaveLength(3);
      expect(bookingPackage.totalPrice).toBeDefined();

      // Step 3: Apply Group Discount
      const discountResponse = await request(app.getHttpServer())
        .post('/api/bookings/apply-discount')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bookingPackageId: bookingPackage.id,
          discountCode: 'MULTI_DESTINATION_10',
        })
        .expect(200);

      expect(discountResponse.body.discountApplied).toBe(true);
      expect(discountResponse.body.discountAmount).toBeGreaterThan(0);

      // Step 4: Process Package Payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/payments/create-package-intent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bookingPackageId: bookingPackage.id,
          amount: discountResponse.body.finalPrice,
          currency: 'USD',
        })
        .expect(201);

      // Step 5: Confirm All Bookings
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: paymentResponse.body.paymentIntentId,
              status: 'succeeded',
              metadata: { bookingPackageId: bookingPackage.id },
            },
          },
        })
        .expect(200);

      // Step 6: Verify Package Status
      const confirmedPackage = await request(app.getHttpServer())
        .get(`/api/bookings/package/${bookingPackage.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(confirmedPackage.body.status).toBe('CONFIRMED');
      expect(confirmedPackage.body.bookings.every((b) => b.status === 'CONFIRMED')).toBe(true);
    });
  });

  describe('Financial Management Journey', () => {
    it('should handle complete host payout flow', async () => {
      // Step 1: Create Completed Booking for Payout
      const completedBooking = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          listingId,
          startDate: '2026-04-01',
          endDate: '2026-04-03',
          guestCount: 2,
        })
        .expect(201);

      // Complete the booking
      await request(app.getHttpServer())
        .put(`/api/bookings/${completedBooking.body.id}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Step 2: Configure Payout Settings
      await request(app.getHttpServer())
        .put('/api/users/payout-settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          payoutMethod: 'bank_transfer',
          bankAccount: {
            accountNumber: '123456789',
            routingNumber: '110000000',
            accountHolderName: 'John Doe',
            bankName: 'Test Bank',
          },
          payoutFrequency: 'WEEKLY',
          minimumPayoutAmount: 100,
        })
        .expect(200);

      // Step 3: Trigger Payout Processing
      await request(app.getHttpServer())
        .post('/api/payouts/process-scheduled')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Step 4: Verify Payout Creation
      const payoutsResponse = await request(app.getHttpServer())
        .get('/api/payouts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(payoutsResponse.body.payouts).toHaveLength(1);
      const payout = payoutsResponse.body.payouts[0];
      expect(payout.status).toBe('PROCESSING');
      expect(payout.amount).toBeGreaterThan(0);

      // Step 5: Mock Payout Completion
      await request(app.getHttpServer())
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          type: 'payout.created',
          data: {
            object: {
              id: 'po_test',
              amount: payout.amount,
              currency: 'USD',
              destination: 'acct_test',
              status: 'in_transit',
            },
          },
        })
        .expect(200);

      // Step 6: Verify Financial Statement
      const statementResponse = await request(app.getHttpServer())
        .get('/api/users/financial-statement')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          startDate: '2026-04-01',
          endDate: '2026-04-30',
        })
        .expect(200);

      expect(statementResponse.body.totalEarnings).toBeGreaterThan(0);
      expect(statementResponse.body.totalPayouts).toBeGreaterThan(0);
      expect(statementResponse.body.pendingBalance).toBeDefined();
    });
  });

  describe('Customer Support Journey', () => {
    it('should handle complete support ticket lifecycle', async () => {
      // Step 1: Create Support Ticket
      const ticketResponse = await request(app.getHttpServer())
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          subject: 'Issue with booking confirmation',
          category: 'BOOKING',
          priority: 'HIGH',
          description: "I haven't received my booking confirmation email",
          bookingId,
        })
        .expect(201);

      const ticket = ticketResponse.body;
      expect(ticket.status).toBe('OPEN');
      expect(ticket.ticketNumber).toBeDefined();

      // Step 2: Add Attachment to Ticket
      await request(app.getHttpServer())
        .post(`/api/support/tickets/${ticket.id}/attachments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('screenshot-data'), 'booking_screenshot.png')
        .field('description', 'Booking confirmation page screenshot')
        .expect(200);

      // Step 3: Agent Responds to Ticket
      await request(app.getHttpServer())
        .post(`/api/support/tickets/${ticket.id}/responses`)
        .set('Authorization', `Bearer ${accessToken}`) // Agent token
        .send({
          message:
            "I've checked your booking and resent the confirmation email. Please check your spam folder.",
          isInternal: false,
        })
        .expect(200);

      // Step 4: Customer Responds
      await request(app.getHttpServer())
        .post(`/api/support/tickets/${ticket.id}/responses`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          message: 'Found it! Thank you for your help.',
          isInternal: false,
        })
        .expect(200);

      // Step 5: Rate Support Experience
      await request(app.getHttpServer())
        .post(`/api/support/tickets/${ticket.id}/rate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          rating: 5,
          comment: 'Fast and helpful response!',
        })
        .expect(200);

      // Step 6: Close Ticket
      await request(app.getHttpServer())
        .put(`/api/support/tickets/${ticket.id}/close`)
        .set('Authorization', `Bearer ${accessToken}`) // Agent token
        .send({
          resolution: 'Customer confirmed receipt of confirmation email',
          satisfactionRating: 5,
        })
        .expect(200);

      // Step 7: Verify Ticket History
      const ticketHistory = await request(app.getHttpServer())
        .get(`/api/support/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(ticketHistory.body.status).toBe('CLOSED');
      expect(ticketHistory.body.responses).toHaveLength(3);
      expect(ticketHistory.body.attachments).toHaveLength(1);
      expect(ticketHistory.body.rating).toBe(5);
    });
  });

  describe('Insurance & Claims Journey', () => {
    it('should handle complete insurance claim process', async () => {
      // Step 1: Purchase Travel Insurance
      const insuranceResponse = await request(app.getHttpServer())
        .post('/api/insurance/purchase')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bookingId,
          coverageType: 'COMPREHENSIVE',
          coverageAmount: 1000,
          duration: 7,
          travelers: 2,
        })
        .expect(201);

      const insurance = insuranceResponse.body;
      expect(insurance.status).toBe('ACTIVE');
      expect(insurance.policyNumber).toBeDefined();

      // Step 2: File Insurance Claim
      const claimResponse = await request(app.getHttpServer())
        .post('/api/insurance/claims')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          policyId: insurance.id,
          claimType: 'TRIP_CANCELLATION',
          reason: 'Medical emergency',
          claimedAmount: 500,
          incidentDate: '2026-04-15',
          description: 'Had to cancel trip due to sudden illness',
        })
        .expect(201);

      const claim = claimResponse.body;
      expect(claim.status).toBe('SUBMITTED');
      expect(claim.claimNumber).toBeDefined();

      // Step 3: Upload Claim Documentation
      await request(app.getHttpServer())
        .post(`/api/insurance/claims/${claim.id}/documents`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('medical_report', Buffer.from('medical-report-data'), 'medical_report.pdf')
        .attach('receipts', Buffer.from('receipt-data'), 'medical_receipts.pdf')
        .field('documentType', 'MEDICAL_DOCUMENTATION')
        .expect(200);

      // Step 4: Claim Review Process
      await request(app.getHttpServer())
        .put(`/api/insurance/claims/${claim.id}/review`)
        .set('Authorization', `Bearer ${accessToken}`) // Claims adjuster token
        .send({
          status: 'UNDER_REVIEW',
          notes: 'Documentation received, beginning review process',
          estimatedCompletion: '2026-05-01',
        })
        .expect(200);

      // Step 5: Claim Decision
      await request(app.getHttpServer())
        .put(`/api/insurance/claims/${claim.id}/decision`)
        .set('Authorization', `Bearer ${accessToken}`) // Claims adjuster token
        .send({
          status: 'APPROVED',
          approvedAmount: 450,
          reasoning: 'Partial coverage approved based on policy terms',
          payoutMethod: 'BANK_TRANSFER',
        })
        .expect(200);

      // Step 6: Process Claim Payout
      await request(app.getHttpServer())
        .post('/api/insurance/claims/payout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          claimId: claim.id,
          amount: 450,
          method: 'BANK_TRANSFER',
        })
        .expect(200);

      // Step 7: Verify Claim Completion
      const completedClaim = await request(app.getHttpServer())
        .get(`/api/insurance/claims/${claim.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(completedClaim.body.status).toBe('COMPLETED');
      expect(completedClaim.body.approvedAmount).toBe(450);
      expect(completedClaim.body.payoutStatus).toBe('PROCESSED');
    });
  });
});
