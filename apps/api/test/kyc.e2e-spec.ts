import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';
import { buildTestEmail, createUserWithRole } from './e2e-helpers';

describe('KYC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let userId: string;
  let adminToken: string;
  let documentId: string;

  const userEmail = buildTestEmail('kyc-user');
  const adminEmail = buildTestEmail('kyc-admin');

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
    await prisma.identityDocument.deleteMany({
      where: { user: { email: { in: [userEmail, adminEmail] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [userEmail, adminEmail] } },
    });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.identityDocument.deleteMany({
      where: { user: { email: { in: [userEmail, adminEmail] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [userEmail, adminEmail] } },
    });

    const user = await createUserWithRole({
      app,
      prisma,
      email: userEmail,
      password: 'Password123!',
      firstName: 'KYC',
      lastName: 'User',
      role: UserRole.USER,
    });
    userToken = user.accessToken;
    userId = user.userId;

    const admin = await createUserWithRole({
      app,
      prisma,
      email: adminEmail,
      password: 'Password123!',
      firstName: 'KYC',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    });
    adminToken = admin.accessToken;
  });

  /* ─── Positive flows ─── */

  describe('POST /kyc/documents', () => {
    it('should upload an identity document', async () => {
      const response = await request(app.getHttpServer())
        .post('/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'PASSPORT',
          documentUrl: 'https://storage.test/doc.pdf',
          expiresAt: '2030-12-31',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.documentType).toBe('PASSPORT');
      expect(response.body.userId).toBe(userId);
      documentId = response.body.id;
    });

    it('should upload without optional expiresAt', async () => {
      const response = await request(app.getHttpServer())
        .post('/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'NATIONAL_ID',
          documentUrl: 'https://storage.test/id-card.pdf',
        })
        .expect(201);

      expect(response.body.documentType).toBe('NATIONAL_ID');
    });
  });

  describe('GET /kyc/documents', () => {
    it('should return user documents', async () => {
      // Upload first
      await request(app.getHttpServer())
        .post('/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'PASSPORT',
          documentUrl: 'https://storage.test/passport.pdf',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /kyc/documents/pending (admin)', () => {
    it('should return pending documents for admin', async () => {
      await request(app.getHttpServer())
        .post('/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'PASSPORT',
          documentUrl: 'https://storage.test/pending.pdf',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/kyc/documents/pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('documents');
    });
  });

  describe('PATCH /kyc/documents/:id/review (admin)', () => {
    it('should approve a document', async () => {
      const upload = await request(app.getHttpServer())
        .post('/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'PASSPORT',
          documentUrl: 'https://storage.test/approve.pdf',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/kyc/documents/${upload.body.id}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);

      expect(response.body.verificationStatus).toBe('APPROVED');
    });

    it('should reject a document with reason', async () => {
      const upload = await request(app.getHttpServer())
        .post('/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'DRIVING_LICENSE',
          documentUrl: 'https://storage.test/reject.pdf',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/kyc/documents/${upload.body.id}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'REJECTED', rejectionReason: 'Blurry image' })
        .expect(200);

      expect(response.body.verificationStatus).toBe('REJECTED');
    });
  });

  /* ─── Negative / auth flows ─── */

  describe('Negative cases', () => {
    it('should 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/kyc/documents')
        .send({
          documentType: 'PASSPORT',
          documentUrl: 'https://test/doc.pdf',
        })
        .expect(401);
    });

    it('should 401 for GET documents without token', async () => {
      await request(app.getHttpServer())
        .get('/kyc/documents')
        .expect(401);
    });

    it('should 403 for non-admin accessing pending documents', async () => {
      await request(app.getHttpServer())
        .get('/kyc/documents/pending')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should 403 for non-admin reviewing a document', async () => {
      const upload = await request(app.getHttpServer())
        .post('/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'PASSPORT',
          documentUrl: 'https://storage.test/noadmin.pdf',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/kyc/documents/${upload.body.id}/review`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'APPROVED' })
        .expect(403);
    });

    it('should 400 for invalid document type', async () => {
      await request(app.getHttpServer())
        .post('/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          documentType: 'INVALID_TYPE',
          documentUrl: 'https://storage.test/bad.pdf',
        })
        .expect(400);
    });

    it('should 400 for missing documentUrl', async () => {
      await request(app.getHttpServer())
        .post('/kyc/documents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ documentType: 'PASSPORT' })
        .expect(400);
    });
  });
});
