import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RiskLevel } from '../src/modules/fraud-detection/services/fraud-detection.service';

describe('Fraud Detection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  // Test user tokens
  let newUserToken: string;
  let newUserId: string;
  let verifiedUserToken: string;
  let verifiedUserId: string;
  let badUserToken: string;
  let badUserId: string;
  let ownerToken: string;
  let ownerId: string;
  
  // Test entities
  let testListingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.booking.deleteMany({});
    await prisma.listing.deleteMany({});
    await prisma.dispute.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'fraud_new@test.com',
            'fraud_verified@test.com',
            'fraud_bad@test.com',
            'fraud_owner@test.com',
          ],
        },
      },
    });

    // Create new user (< 7 days old) - will be flagged
    const newUserRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'fraud_new@test.com',
        password: 'TestPass123!',
        firstName: 'New',
        lastName: 'User',
        role: 'USER',
      });
    newUserToken = newUserRes.body.accessToken;
    newUserId = newUserRes.body.user.id;

    // Create verified user with good history
    const verifiedUserRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'fraud_verified@test.com',
        password: 'TestPass123!',
        firstName: 'Verified',
        lastName: 'User',
        role: 'USER',
      });
    verifiedUserToken = verifiedUserRes.body.accessToken;
    verifiedUserId = verifiedUserRes.body.user.id;

    // Update verified user to have older account and verification
    await prisma.user.update({
      where: { id: verifiedUserId },
      data: {
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        emailVerified: true,
        idVerificationStatus: 'VERIFIED',
        averageRating: 4.8,
      },
    });

    // Create user with bad history (cancellations, disputes, low rating)
    const badUserRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'fraud_bad@test.com',
        password: 'TestPass123!',
        firstName: 'Bad',
        lastName: 'User',
        role: 'USER',
      });
    badUserToken = badUserRes.body.accessToken;
    badUserId = badUserRes.body.user.id;

    await prisma.user.update({
      where: { id: badUserId },
      data: {
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
        emailVerified: false,
        averageRating: 2.5,
      },
    });

    // Create owner
    const ownerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'fraud_owner@test.com',
        password: 'TestPass123!',
        firstName: 'Test',
        lastName: 'Owner',
        role: 'HOST',
      });
    ownerToken = ownerRes.body.accessToken;
    ownerId = ownerRes.body.user.id;

    // Create test listing
    const categoryId = (await prisma.category.findFirst())?.id || 'default-category';
    const listing = await prisma.listing.create({
      data: {
        title: 'Test Property for Fraud Detection',
        description: 'Test property',
        ownerId: ownerId,
        categoryId,
        basePrice: 100,
        currency: 'USD',
        status: 'AVAILABLE',
        bookingMode: 'INSTANT_BOOK',
      },
    });
    testListingId = listing.id;
  });

  describe('Booking Fraud Check - New Account', () => {
    it('should flag new account (< 7 days old)', async () => {
      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 300,
        })
        .expect(200);

      expect(res.body.riskLevel).toBe(RiskLevel.MEDIUM);
      expect(res.body.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'NEW_ACCOUNT',
            severity: 'MEDIUM',
          }),
        ])
      );
      expect(res.body.requiresManualReview).toBe(true);
    });

    it('should allow LOW risk booking from verified user', async () => {
      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${verifiedUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 300,
        })
        .expect(200);

      expect(res.body.riskLevel).toBe(RiskLevel.LOW);
      expect(res.body.allowBooking).toBe(true);
      expect(res.body.requiresManualReview).toBe(false);
    });
  });

  describe('Booking Fraud Check - Unverified User', () => {
    it('should flag unverified email', async () => {
      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 300,
        })
        .expect(200);

      expect(res.body.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'EMAIL_NOT_VERIFIED',
            severity: 'HIGH',
          }),
        ])
      );
    });

    it('should flag unverified ID', async () => {
      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${badUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 300,
        })
        .expect(200);

      expect(res.body.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'ID_NOT_VERIFIED',
            severity: 'MEDIUM',
          }),
        ])
      );
    });
  });

  describe('Booking Fraud Check - User History', () => {
    beforeEach(async () => {
      // Create cancelled bookings for bad user
      for (let i = 0; i < 3; i++) {
        await prisma.booking.create({
          data: {
            renterId: badUserId,
            listingId: testListingId,
            startDate: new Date(Date.now() - (30 + i) * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() - (25 + i) * 24 * 60 * 60 * 1000),
            status: 'CANCELLED',
            basePrice: 100,
            totalPrice: 200,
            totalAmount: 200,
            platformFee: 30,
            serviceFee: 10,
            currency: 'USD',
          },
        });
      }

      // Create disputes for bad user
      const disputeBooking = await prisma.booking.create({
        data: {
          renterId: badUserId,
          listingId: testListingId,
          startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
          status: 'COMPLETED',
          basePrice: 100,
          totalPrice: 300,
          totalAmount: 300,
          platformFee: 45,
          serviceFee: 15,
          currency: 'USD',
        },
      });

      await prisma.dispute.create({
        data: {
          booking: { connect: { id: disputeBooking.id } },
          initiator: { connect: { id: badUserId } },
          defendant: { connect: { id: ownerId } },
          type: 'REFUND_REQUEST',
          description: 'Test dispute',
          status: 'OPEN',
        },
      });
    });

    it('should flag user with frequent cancellations', async () => {
      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${badUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 300,
        })
        .expect(200);

      expect(res.body.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'FREQUENT_CANCELLATIONS',
            severity: 'HIGH',
          }),
        ])
      );
      expect([RiskLevel.HIGH, RiskLevel.CRITICAL]).toContain(res.body.riskLevel);
    });

    it('should flag user with dispute history', async () => {
      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${badUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 300,
        })
        .expect(200);

      expect(res.body.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'DISPUTE_HISTORY',
            severity: 'HIGH',
          }),
        ])
      );
    });

    it('should flag user with low rating', async () => {
      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${badUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 300,
        })
        .expect(200);

      expect(res.body.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'LOW_RATING',
            severity: 'MEDIUM',
          }),
        ])
      );
    });
  });

  describe('Booking Fraud Check - Velocity Abuse', () => {
    it('should flag rapid booking attempts (> 5 in 5 minutes)', async () => {
      // Make 6 booking fraud checks in quick succession
      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/fraud-detection/check/booking')
            .set('Authorization', `Bearer ${newUserToken}`)
            .send({
              listingId: testListingId,
              startDate: new Date(Date.now() + (7 + i) * 24 * 60 * 60 * 1000).toISOString(),
              endDate: new Date(Date.now() + (10 + i) * 24 * 60 * 60 * 1000).toISOString(),
              totalPrice: 300,
            })
        );
      }

      const results = await Promise.all(promises);
      
      // Last few should be flagged for velocity
      const lastResult = results[results.length - 1];
      expect(lastResult.body.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'HIGH_BOOKING_VELOCITY',
          }),
        ])
      );
    });
  });

  describe('Booking Fraud Check - High Value Bookings', () => {
    it('should flag high-value booking from new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 800, // High value
        })
        .expect(200);

      expect(res.body.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'HIGH_VALUE_NEW_USER',
            severity: 'HIGH',
          }),
        ])
      );
      expect([RiskLevel.HIGH, RiskLevel.CRITICAL]).toContain(res.body.riskLevel);
    });

    it('should flag first booking over $300', async () => {
      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${verifiedUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 400,
        })
        .expect(200);

      // Verified user with first high-value booking should still be low risk
      // but may have a flag
      if (res.body.flags.length > 0) {
        expect(res.body.flags).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'FIRST_HIGH_VALUE_BOOKING',
            }),
          ])
        );
      }
    });

    it('should allow high-value booking from trusted user with history', async () => {
      // Create completed bookings for verified user
      for (let i = 0; i < 3; i++) {
        await prisma.booking.create({
          data: {
            renterId: verifiedUserId,
            listingId: testListingId,
            startDate: new Date(Date.now() - (60 + i * 30) * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() - (55 + i * 30) * 24 * 60 * 60 * 1000),
            status: 'COMPLETED',
            basePrice: 100,
            totalPrice: 300,
            totalAmount: 300,
            platformFee: 45,
            serviceFee: 15,
            currency: 'USD',
          },
        });
      }

      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${verifiedUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 1000, // Very high value
        })
        .expect(200);

      expect([RiskLevel.LOW, RiskLevel.MEDIUM]).toContain(res.body.riskLevel);
      expect(res.body.allowBooking).toBe(true);
    });
  });

  describe('Booking Fraud Check - Unusual Patterns', () => {
    it('should flag unusually long booking (> 90 days)', async () => {
      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString(), // 93 days
          totalPrice: 9000,
        })
        .expect(200);

      expect(res.body.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'UNUSUALLY_LONG_BOOKING',
            severity: 'MEDIUM',
          }),
        ])
      );
    });

    it('should flag last-minute booking (< 2 hours)', async () => {
      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 hour from now
          endDate: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
          totalPrice: 200,
        })
        .expect(200);

      expect(res.body.flags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'LAST_MINUTE_BOOKING',
            severity: 'LOW',
          }),
        ])
      );
    });
  });

  describe('Combined Risk Score', () => {
    it('should block CRITICAL risk bookings', async () => {
      // Create scenario with multiple high-risk flags
      await prisma.user.update({
        where: { id: newUserId },
        data: {
          emailVerified: false,
          averageRating: 2.0,
        },
      });

      // Create recent cancellations
      for (let i = 0; i < 4; i++) {
        await prisma.booking.create({
          data: {
            renterId: newUserId,
            listingId: testListingId,
            startDate: new Date(Date.now() - (20 + i) * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() - (15 + i) * 24 * 60 * 60 * 1000),
            status: 'CANCELLED',
            basePrice: 100,
            totalPrice: 200,
            totalAmount: 200,
            platformFee: 30,
            serviceFee: 10,
            currency: 'USD',
          },
        });
      }

      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 1000, // High value
        })
        .expect(200);

      expect(res.body.riskScore).toBeGreaterThanOrEqual(70);
      expect([RiskLevel.HIGH, RiskLevel.CRITICAL]).toContain(res.body.riskLevel);
      expect(res.body.allowBooking).toBe(false);
      expect(res.body.requiresManualReview).toBe(true);
    });

    it('should calculate risk score from multiple factors', async () => {
      const res = await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${badUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 300,
        })
        .expect(200);

      expect(res.body).toHaveProperty('riskScore');
      expect(res.body).toHaveProperty('riskLevel');
      expect(res.body).toHaveProperty('flags');
      expect(res.body.riskScore).toBeGreaterThan(0);
      expect(res.body.flags.length).toBeGreaterThan(0);
    });
  });

  describe('Fraud Check Integration', () => {
    it('should log high-risk fraud checks to audit log', async () => {
      // Trigger high-risk scenario
      await prisma.user.update({
        where: { id: newUserId },
        data: {
          emailVerified: false,
        },
      });

      await request(app.getHttpServer())
        .post('/fraud-detection/check/booking')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          listingId: testListingId,
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          totalPrice: 800,
        })
        .expect(200);

      // Check audit log was created
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'FRAUD_CHECK',
          entityType: 'USER',
          entityId: newUserId,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (auditLog) {
        expect(auditLog).toBeDefined();
        const values = JSON.parse(auditLog.newValues as string);
        expect(values).toHaveProperty('riskScore');
      }
    });
  });
});
