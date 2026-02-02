import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('Categories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let testCategoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Get admin token
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@rental-portal.com', password: 'password123' });
    adminToken = adminLogin.body.accessToken;

    // Create a test user and get token
    const userSignup = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'testuser-cat@test.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      });
    userToken = userSignup.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testCategoryId) {
      await prisma.category.delete({ where: { id: testCategoryId } }).catch(() => {});
    }
    await prisma.user.delete({ where: { email: 'testuser-cat@test.com' } }).catch(() => {});
    await app.close();
  });

  describe('GET /categories', () => {
    it('should return all active categories', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach((category: any) => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('slug');
        expect(category.active).toBe(true);
      });
    });

    it('should include all categories when activeOnly=false (admin)', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories?activeOnly=false')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should be publicly accessible without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should return categories in order', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      // Check if ordered
      for (let i = 1; i < response.body.length; i++) {
        const prev = response.body[i - 1].order ?? 0;
        const curr = response.body[i].order ?? 0;
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });
  });

  describe('GET /categories/templates', () => {
    it('should return all category templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories/templates')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /categories/:id', () => {
    it('should return a category by id', async () => {
      // First get list of categories
      const listResponse = await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      const categoryId = listResponse.body[0].id;

      const response = await request(app.getHttpServer())
        .get(`/categories/${categoryId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', categoryId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('slug');
    });

    it('should return 404 for non-existent category', async () => {
      await request(app.getHttpServer())
        .get('/categories/non-existent-id')
        .expect(404);
    });
  });

  describe('GET /categories/slug/:slug', () => {
    it('should return a category by slug', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories/slug/apartment')
        .expect(200);

      expect(response.body).toHaveProperty('slug', 'apartment');
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 for non-existent slug', async () => {
      await request(app.getHttpServer())
        .get('/categories/slug/non-existent-slug')
        .expect(404);
    });
  });

  describe('GET /categories/:id/stats', () => {
    it('should return category statistics', async () => {
      const listResponse = await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      const categoryId = listResponse.body[0].id;

      const response = await request(app.getHttpServer())
        .get(`/categories/${categoryId}/stats`)
        .expect(200);

      expect(response.body).toHaveProperty('propertyCount');
      expect(response.body).toHaveProperty('totalBookings');
      expect(typeof response.body.propertyCount).toBe('number');
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
      const createDto = {
        name: 'Unauthorized Category',
        slug: 'unauthorized-cat',
        templateSchema: {},
      };

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .send(createDto)
        .expect(403);
    });

    it('should reject creation without authentication', async () => {
      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Test', slug: 'test', templateSchema: {} })
        .expect(401);
    });

    it('should reject duplicate slug', async () => {
      const createDto = {
        name: 'Duplicate Slug Category',
        slug: 'apartment', // Already exists
        templateSchema: {},
      };

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto)
        .expect(400);
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        description: 'Missing name and slug',
      };

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('PATCH /categories/:id (Admin)', () => {
    it('should update a category as admin', async () => {
      if (!testCategoryId) {
        // Create one first
        const createResponse = await request(app.getHttpServer())
          .post('/categories')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Update Test Category',
            slug: `update-test-${Date.now()}`,
            templateSchema: {},
          });
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

      // Re-enable for other tests
      await request(app.getHttpServer())
        .patch(`/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: true });
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

    it('should reject deletion of category with properties', async () => {
      // Get a category that has properties (apartment usually has)
      const categories = await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      const categoryWithProps = categories.body.find((c: any) => c.name === 'Apartment');
      if (categoryWithProps) {
        await request(app.getHttpServer())
          .delete(`/categories/${categoryWithProps.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      }
    });

    it('should delete a category without properties as admin', async () => {
      // Create a fresh category for deletion
      const createResponse = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Delete Test Category',
          slug: `delete-test-${Date.now()}`,
          templateSchema: {},
        });

      const deleteId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/categories/${deleteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify deletion
      await request(app.getHttpServer())
        .get(`/categories/${deleteId}`)
        .expect(404);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in name', async () => {
      const createDto = {
        name: 'Test & Category <Special>',
        slug: `special-chars-${Date.now()}`,
        templateSchema: {},
      };

      const response = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.name).toBe(createDto.name);

      // Cleanup
      await prisma.category.delete({ where: { id: response.body.id } });
    });

    it('should handle very long description', async () => {
      const longDescription = 'A'.repeat(5000);
      const createDto = {
        name: 'Long Description Test',
        slug: `long-desc-${Date.now()}`,
        description: longDescription,
        templateSchema: {},
      };

      const response = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body.description).toBe(longDescription);

      // Cleanup
      await prisma.category.delete({ where: { id: response.body.id } });
    });

    it('should handle concurrent reads', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app.getHttpServer()).get('/categories'));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });
});
