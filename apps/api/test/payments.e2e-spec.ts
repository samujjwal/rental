import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { buildTestEmail, cleanupCoreRelationalData, createUserWithRole } from './e2e-helpers';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let renterToken: string;
  const ownerEmail = buildTestEmail('payment-owner');
  const renterEmail = buildTestEmail('payment-renter');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, renterEmail] } },
    });
    await app.close();
  });

  beforeEach(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, renterEmail] } },
    });

    const owner = await createUserWithRole({
      app,
      prisma,
      email: ownerEmail,
      firstName: 'Test',
      lastName: 'Owner',
      role: UserRole.HOST,
    });
    ownerToken = owner.accessToken;

    const renter = await createUserWithRole({
      app,
      prisma,
      email: renterEmail,
      firstName: 'Test',
      lastName: 'Renter',
      role: UserRole.USER,
    });
    renterToken = renter.accessToken;
  });

  describe('GET /payments/connect/status', () => {
    it('should return not connected by default', async () => {
      const response = await request(app.getHttpServer())
        .get('/payments/connect/status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.connected).toBe(false);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/payments/connect/status').expect(401);
    });
  });

  describe('GET /payments/balance', () => {
    it('should return renter balance payload', async () => {
      const response = await request(app.getHttpServer())
        .get('/payments/balance')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('balance');
      expect(response.body.currency).toBeDefined();
    });
  });

  describe('GET /payments/transactions', () => {
    it('should return transaction list payload', async () => {
      const response = await request(app.getHttpServer())
        .get('/payments/transactions')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);

      expect(Array.isArray(response.body.transactions)).toBe(true);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
    });
  });

  describe('GET /payments/earnings', () => {
    it('should return earnings payload for owner', async () => {
      const response = await request(app.getHttpServer())
        .get('/payments/earnings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('amount');
      expect(response.body.currency).toBeDefined();
    });
  });
});
