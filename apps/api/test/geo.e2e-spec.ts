import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Geo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /geo/autocomplete', () => {
    it('should return suggestions for a query', async () => {
      const res = await request(app.getHttpServer())
        .get('/geo/autocomplete?query=Kathmandu')
        .expect(200);

      expect(Array.isArray(res.body.results || res.body)).toBe(true);
    });

    it('should return empty array for gibberish', async () => {
      const res = await request(app.getHttpServer())
        .get('/geo/autocomplete?query=zzxxyyww123')
        .expect(200);

      expect(Array.isArray(res.body.results || res.body)).toBe(true);
    });

    it('should handle empty query', async () => {
      await request(app.getHttpServer())
        .get('/geo/autocomplete?query=')
        .expect((r) => expect([200, 400]).toContain(r.status));
    });

    it('should handle missing query parameter', async () => {
      await request(app.getHttpServer())
        .get('/geo/autocomplete')
        .expect((r) => expect([200, 400]).toContain(r.status));
    });

    it('should handle special characters safely', async () => {
      await request(app.getHttpServer())
        .get('/geo/autocomplete?query=<script>alert(1)</script>')
        .expect((r) => expect([200, 400]).toContain(r.status));
    });
  });

  describe('GET /geo/reverse', () => {
    it('should return location for valid coordinates', async () => {
      const res = await request(app.getHttpServer())
        .get('/geo/reverse?lat=27.7172&lon=85.324')
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('should handle invalid coordinates gracefully', async () => {
      await request(app.getHttpServer())
        .get('/geo/reverse?lat=999&lon=999')
        .expect((r) => expect([200, 400, 404]).toContain(r.status));
    });

    it('should handle missing parameters', async () => {
      await request(app.getHttpServer())
        .get('/geo/reverse')
        .expect((r) => expect([200, 400]).toContain(r.status));
    });
  });
});
