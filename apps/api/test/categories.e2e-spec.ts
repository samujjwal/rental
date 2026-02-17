import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('Categories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let testCategoryId: string;
  let adminEmail: string;
  let userEmail: string;

  const uniqueSuffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const register = async (email: string, firstName: string, lastName: string) => {
    const response = await request(app.getHttpServer()).post('/auth/register').send({
      email,
      password: 'Password123!',
      firstName,
      lastName,
      phoneNumber: '+1234567890',
    });

    expect(response.status).toBe(201);
    return response.body as { accessToken: string };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    const suffix = uniqueSuffix();
    adminEmail = `admin-cat-${suffix}@test.com`;
    userEmail = `testuser-cat-${suffix}@test.com`;

    await register(adminEmail, 'Admin', 'Category');
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } });

    const adminLogin = await request(app.getHttpServer()).post('/auth/login').send({
      email: adminEmail,
      password: 'Password123!',
    });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.accessToken;

    const userSignup = await register(userEmail, 'Test', 'User');
    userToken = userSignup.accessToken;
  });

  afterAll(async () => {
    if (testCategoryId) {
      await prisma.category.delete({ where: { id: testCategoryId } }).catch(() => {});
    }

    await prisma.user
      .deleteMany({
        where: {
          OR: [{ email: adminEmail }, { email: userEmail }],
        },
      })
      .catch(() => {});

    await app.close();
  });

  describe('GET /categories', () => {
    it('should return all active categories', async () => {
      const response = await request(app.getHttpServer()).get('/categories').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach((category: any) => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('slug');
        expect(category.active).toBe(true);
      });
    });

    it('should include all categories when activeOnly=false', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories?activeOnly=false')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should be publicly accessible without authentication', async () => {
      const response = await request(app.getHttpServer()).get('/categories').expect(200);
      expect(response.body).toBeDefined();
    });

    it('should return categories in order', async () => {
      const response = await request(app.getHttpServer()).get('/categories').expect(200);

      for (let i = 1; i < response.body.length; i++) {
        const prev = response.body[i - 1].order;
        const curr = response.body[i].order;

        // Database null ordering can vary; only compare explicit values.
        if (typeof prev === 'number' && typeof curr === 'number') {
          expect(curr).toBeGreaterThanOrEqual(prev);
        }
      }
    });
  });

  describe('GET /categories/templates', () => {
    it('should return all category templates as an object map', async () => {
      const response = await request(app.getHttpServer()).get('/categories/templates').expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(false);
      expect(typeof response.body).toBe('object');
      expect(Object.keys(response.body).length).toBeGreaterThan(0);
    });
  });

  describe('GET /categories/:id', () => {
    it('should return a category by id', async () => {
      const listResponse = await request(app.getHttpServer()).get('/categories').expect(200);
      const categoryId = listResponse.body[0].id;

      const response = await request(app.getHttpServer()).get(`/categories/${categoryId}`).expect(200);

      expect(response.body).toHaveProperty('id', categoryId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('slug');
    });

    it('should return 404 for non-existent category', async () => {
      await request(app.getHttpServer()).get('/categories/non-existent-id').expect(404);
    });
  });

  describe('GET /categories/slug/:slug', () => {
    it('should return a category by slug', async () => {
      const response = await request(app.getHttpServer()).get('/categories/slug/apartment').expect(200);

      expect(response.body).toHaveProperty('slug', 'apartment');
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 for non-existent slug', async () => {
      await request(app.getHttpServer()).get('/categories/slug/non-existent-slug').expect(404);
    });
  });

  describe('GET /categories/:id/stats', () => {
    it('should return category statistics', async () => {
      const listResponse = await request(app.getHttpServer()).get('/categories').expect(200);
      const categoryId = listResponse.body[0].id;

      const response = await request(app.getHttpServer()).get(`/categories/${categoryId}/stats`).expect(200);

      expect(response.body).toHaveProperty('category');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('totalListings');
      expect(response.body.stats).toHaveProperty('activeListings');
      expect(response.body.stats).toHaveProperty('averagePrice');
      expect(typeof response.body.stats.totalListings).toBe('number');
    });
  });

  describe('POST /categories (Admin)', () => {
    it('should create a new category as admin', async () => {
      const createDto = {
        name: 'Test Category E2E',
        slug: `test-category-e2e-${Date.now()}`,
        description: 'E2E test category',
        iconUrl: 'test-icon',
        order: 100,
        templateSchema: { testField: 'string' },
        searchableFields: ['name'],
        requiredFields: [],
      };

      const response = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto)
        .expect(201);

      testCategoryId = response.body.id;

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(createDto.name);
      expect(response.body.slug).toBe(createDto.slug);
    });

    it('should reject creation by non-admin user', async () => {
      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Unauthorized Category',
          slug: `unauthorized-cat-${Date.now()}`,
          templateSchema: {},
        })
        .expect(403);
    });

    it('should reject creation without authentication', async () => {
      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Test', slug: `test-${Date.now()}`, templateSchema: {} })
        .expect(401);
    });

    it('should reject duplicate slug', async () => {
      const duplicateSlug = `duplicate-slug-${Date.now()}`;
      const firstName = `First Duplicate Slug Category ${Date.now()}`;
      const secondName = `Second Duplicate Slug Category ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: firstName,
          slug: duplicateSlug,
          templateSchema: {},
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: secondName,
          slug: duplicateSlug,
          templateSchema: {},
        })
        .expect(400);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Missing name and slug' })
        .expect(400);
    });
  });

  describe('PATCH /categories/:id (Admin)', () => {
    it('should update a category as admin', async () => {
      if (!testCategoryId) {
        const createResponse = await request(app.getHttpServer())
          .post('/categories')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Update Test Category',
            slug: `update-test-${Date.now()}`,
            templateSchema: {},
          })
          .expect(201);
        testCategoryId = createResponse.body.id;
      }

      const updateDto = {
        name: 'Updated Category Name',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .patch(`/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe(updateDto.name);
      expect(response.body.description).toBe(updateDto.description);
    });

    it('should reject update by non-admin user', async () => {
      if (!testCategoryId) return;

      await request(app.getHttpServer())
        .patch(`/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Unauthorized Update' })
        .expect(403);
    });

    it('should toggle active status', async () => {
      if (!testCategoryId) return;

      const response = await request(app.getHttpServer())
        .patch(`/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false })
        .expect(200);

      expect(response.body.active).toBe(false);

      await request(app.getHttpServer())
        .patch(`/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: true })
        .expect(200);
    });
  });

  describe('DELETE /categories/:id (Admin)', () => {
    it('should reject deletion by non-admin user', async () => {
      if (!testCategoryId) return;

      await request(app.getHttpServer())
        .delete(`/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should reject deletion of category with listings', async () => {
      const createdCategory = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Delete Guard Category ${Date.now()}`,
          slug: `delete-guard-${Date.now()}`,
          templateSchema: {},
        })
        .expect(201);

      const adminUser = await prisma.user.findUnique({
        where: { email: adminEmail },
        select: { id: true },
      });
      if (!adminUser?.id) {
        throw new Error('Admin user not found for categories delete guard test');
      }

      await prisma.listing.create({
        data: {
          ownerId: adminUser.id,
          categoryId: createdCategory.body.id,
          title: `Category Delete Guard Listing ${Date.now()}`,
          description: 'Listing to verify category delete guard',
          slug: `category-delete-guard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          address: '123 Category Street',
          city: 'Test City',
          state: 'TS',
          zipCode: '12345',
          country: 'US',
          type: 'APARTMENT',
          basePrice: 100,
          currency: 'USD',
          status: 'AVAILABLE',
          verificationStatus: 'VERIFIED',
          bookingMode: 'REQUEST',
        } as any,
      });

      await request(app.getHttpServer())
        .delete(`/categories/${createdCategory.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      await prisma.listing.deleteMany({ where: { categoryId: createdCategory.body.id } });
      await prisma.category.delete({ where: { id: createdCategory.body.id } });
    });

    it('should delete a category without listings as admin', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Delete Test Category',
          slug: `delete-test-${Date.now()}`,
          templateSchema: {},
        })
        .expect(201);

      const deleteId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/categories/${deleteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer()).get(`/categories/${deleteId}`).expect(404);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in name', async () => {
      const response = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test & Category <Special>',
          slug: `special-chars-${Date.now()}`,
          templateSchema: {},
        })
        .expect(201);

      expect(response.body.name).toBe('Test & Category <Special>');
      await prisma.category.delete({ where: { id: response.body.id } });
    });

    it('should handle very long description', async () => {
      const longDescription = 'A'.repeat(5000);
      const response = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Long Description Test',
          slug: `long-desc-${Date.now()}`,
          description: longDescription,
          templateSchema: {},
        })
        .expect(201);

      expect(response.body.description).toBe(longDescription);
      await prisma.category.delete({ where: { id: response.body.id } });
    });

    it('should handle concurrent reads', async () => {
      const responses = await Promise.all(
        Array(10)
          .fill(null)
          .map(() => request(app.getHttpServer()).get('/categories')),
      );

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });
});
