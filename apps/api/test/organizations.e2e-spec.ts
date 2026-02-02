import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { OrganizationRole } from '@rental-portal/database';

describe('Organizations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  // Test user tokens
  let ownerToken: string;
  let ownerUserId: string;
  let memberToken: string;
  let memberUserId: string;
  let adminToken: string;
  let adminUserId: string;
  let outsiderToken: string;
  let outsiderUserId: string;

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
    await prisma.organizationMember.deleteMany({});
    await prisma.organization.deleteMany({});
    await prisma.listing.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'org_owner@test.com',
            'org_member@test.com',
            'org_admin@test.com',
            'org_outsider@test.com',
          ],
        },
      },
    });

    // Create test users
    const ownerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'org_owner@test.com',
        password: 'TestPass123!',
        firstName: 'Org',
        lastName: 'Owner',
        role: 'HOST',
      });
    ownerToken = ownerRes.body.accessToken;
    ownerUserId = ownerRes.body.user.id;

    const memberRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'org_member@test.com',
        password: 'TestPass123!',
        firstName: 'Org',
        lastName: 'Member',
        role: 'HOST',
      });
    memberToken = memberRes.body.accessToken;
    memberUserId = memberRes.body.user.id;

    const adminRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'org_admin@test.com',
        password: 'TestPass123!',
        firstName: 'Org',
        lastName: 'Admin',
        role: 'HOST',
      });
    adminToken = adminRes.body.accessToken;
    adminUserId = adminRes.body.user.id;

    const outsiderRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'org_outsider@test.com',
        password: 'TestPass123!',
        firstName: 'Org',
        lastName: 'Outsider',
        role: 'HOST',
      });
    outsiderToken = outsiderRes.body.accessToken;
    outsiderUserId = outsiderRes.body.user.id;
  });

  describe('POST /organizations', () => {
    it('should create organization', async () => {
      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Property Management Co',
          description: 'A test property management organization',
          website: 'https://testproperties.com',
          contactEmail: 'contact@testproperties.com',
          contactPhone: '+1234567890',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Test Property Management Co');
      expect(res.body.slug).toBeDefined();
      expect(res.body.ownerId).toBe(ownerUserId);

      // Verify owner is added as OWNER member
      const org = await prisma.organization.findUnique({
        where: { id: res.body.id },
        include: { members: true },
      });
      expect(org?.members).toHaveLength(1);
      expect(org?.members[0].userId).toBe(ownerUserId);
      expect(org?.members[0].role).toBe(OrganizationRole.OWNER);
    });

    it('should generate unique slug from name', async () => {
      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Great Properties Ltd',
          description: 'Test',
        })
        .expect(201);

      expect(res.body.slug).toMatch(/^great-properties-ltd/);
    });

    it('should prevent duplicate organization for same user', async () => {
      // Create first organization
      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'First Organization',
          description: 'Test',
        })
        .expect(201);

      // Try to create second organization as OWNER
      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Second Organization',
          description: 'Test',
        })
        .expect(400); // User can only own one organization
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          // Missing name
          description: 'Test',
        })
        .expect(400);
    });

    it('should validate email format', async () => {
      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Org',
          description: 'Test',
          contactEmail: 'invalid-email',
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/organizations')
        .send({
          name: 'Test Org',
          description: 'Test',
        })
        .expect(401);
    });
  });

  describe('POST /organizations/:id/members', () => {
    let organizationId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Organization',
          description: 'Test',
        });
      organizationId = res.body.id;
    });

    it('should invite member to organization as OWNER', async () => {
      const res = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.MEMBER,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.userId).toBe(memberUserId);
      expect(res.body.role).toBe(OrganizationRole.MEMBER);
      expect(res.body.organizationId).toBe(organizationId);
    });

    it('should invite ADMIN to organization as OWNER', async () => {
      const res = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_admin@test.com',
          role: OrganizationRole.ADMIN,
        })
        .expect(201);

      expect(res.body.role).toBe(OrganizationRole.ADMIN);
    });

    it('should allow ADMIN to invite MEMBER', async () => {
      // First, add adminUser as ADMIN
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_admin@test.com',
          role: OrganizationRole.ADMIN,
        })
        .expect(201);

      // Admin invites member
      const res = await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.MEMBER,
        })
        .expect(201);

      expect(res.body.role).toBe(OrganizationRole.MEMBER);
    });

    it('should reject invitation from MEMBER', async () => {
      // First, add memberUser as MEMBER
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.MEMBER,
        });

      // Member tries to invite someone
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          email: 'org_outsider@test.com',
          role: OrganizationRole.MEMBER,
        })
        .expect(403);
    });

    it('should reject invitation from non-member', async () => {
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.MEMBER,
        })
        .expect(403);
    });

    it('should prevent duplicate member', async () => {
      // Add member first time
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.MEMBER,
        })
        .expect(201);

      // Try to add again
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.MEMBER,
        })
        .expect(400);
    });

    it('should prevent adding another OWNER', async () => {
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.OWNER,
        })
        .expect(400); // Only one owner allowed
    });

    it('should validate email exists in system', async () => {
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'nonexistent@test.com',
          role: OrganizationRole.MEMBER,
        })
        .expect(404);
    });
  });

  describe('PATCH /organizations/:id/members/:userId/role', () => {
    let organizationId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Organization',
          description: 'Test',
        });
      organizationId = res.body.id;

      // Add member
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.MEMBER,
        });
    });

    it('should update member role as OWNER', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/organizations/${organizationId}/members/${memberUserId}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: OrganizationRole.ADMIN,
        })
        .expect(200);

      expect(res.body.role).toBe(OrganizationRole.ADMIN);
    });

    it('should allow ADMIN to promote MEMBER to ADMIN', async () => {
      // Add admin first
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_admin@test.com',
          role: OrganizationRole.ADMIN,
        });

      // Admin promotes member
      const res = await request(app.getHttpServer())
        .patch(`/organizations/${organizationId}/members/${memberUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: OrganizationRole.ADMIN,
        })
        .expect(200);

      expect(res.body.role).toBe(OrganizationRole.ADMIN);
    });

    it('should prevent changing OWNER role', async () => {
      await request(app.getHttpServer())
        .patch(`/organizations/${organizationId}/members/${ownerUserId}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: OrganizationRole.MEMBER,
        })
        .expect(400);
    });

    it('should prevent MEMBER from changing roles', async () => {
      await request(app.getHttpServer())
        .patch(`/organizations/${organizationId}/members/${memberUserId}/role`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          role: OrganizationRole.ADMIN,
        })
        .expect(403);
    });

    it('should prevent non-member from changing roles', async () => {
      await request(app.getHttpServer())
        .patch(`/organizations/${organizationId}/members/${memberUserId}/role`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          role: OrganizationRole.ADMIN,
        })
        .expect(403);
    });
  });

  describe('DELETE /organizations/:id/members/:userId', () => {
    let organizationId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Organization',
          description: 'Test',
        });
      organizationId = res.body.id;

      // Add members
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.MEMBER,
        });

      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_admin@test.com',
          role: OrganizationRole.ADMIN,
        });
    });

    it('should remove member as OWNER', async () => {
      await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}/members/${memberUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);

      const member = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: memberUserId,
        },
      });
      expect(member).toBeNull();
    });

    it('should allow ADMIN to remove MEMBER', async () => {
      await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}/members/${memberUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should prevent ADMIN from removing another ADMIN', async () => {
      // Add another admin
      const anotherAdminRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'another_admin@test.com',
          password: 'TestPass123!',
          firstName: 'Another',
          lastName: 'Admin',
          role: 'HOST',
        });

      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'another_admin@test.com',
          role: OrganizationRole.ADMIN,
        });

      // Admin tries to remove another admin
      await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}/members/${anotherAdminRes.body.user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('should prevent removing OWNER', async () => {
      await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}/members/${ownerUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
    });

    it('should allow member to leave (remove themselves)', async () => {
      await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}/members/${memberUserId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(204);
    });

    it('should prevent non-member from removing members', async () => {
      await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}/members/${memberUserId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    it('should check for orphaned properties when removing member', async () => {
      // Create property owned by the organization but managed by member
      const categoryId = (await prisma.category.findFirst())?.id || 'default-category';
      await prisma.listing.create({
        data: {
          title: 'Test Property',
          description: 'Test',
          ownerId: memberUserId,
          organizationId: organizationId,
          categoryId,
          basePrice: 100,
          currency: 'USD',
          status: 'AVAILABLE',
          bookingMode: 'INSTANT_BOOK',
        },
      });

      // Should warn or prevent removal if member has properties
      const res = await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}/members/${memberUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);

      expect(res.body.message).toContain('properties');
    });
  });

  describe('GET /organizations/:id', () => {
    let organizationId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Organization',
          description: 'Test description',
          website: 'https://test.com',
        });
      organizationId = res.body.id;

      // Add members
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.MEMBER,
        });
    });

    it('should get organization details as member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.id).toBe(organizationId);
      expect(res.body.name).toBe('Test Organization');
      expect(res.body).toHaveProperty('members');
      expect(res.body.members.length).toBeGreaterThan(0);
    });

    it('should include statistics', async () => {
      const res = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('statistics');
      expect(res.body.statistics).toHaveProperty('memberCount');
      expect(res.body.statistics).toHaveProperty('listingCount');
    });

    it('should reject access from non-member', async () => {
      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent organization', async () => {
      await request(app.getHttpServer())
        .get('/organizations/non-existent-id')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });
  });

  describe('GET /organizations/:id/statistics', () => {
    let organizationId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Organization',
          description: 'Test',
        });
      organizationId = res.body.id;

      // Add member
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.MEMBER,
        });
    });

    it('should get statistics as OWNER', async () => {
      const res = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/statistics`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('memberCount');
      expect(res.body).toHaveProperty('listingCount');
      expect(res.body).toHaveProperty('totalRevenue');
      expect(res.body).toHaveProperty('bookingCount');
    });

    it('should allow MEMBER to view basic statistics', async () => {
      const res = await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/statistics`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('memberCount');
      expect(res.body).toHaveProperty('listingCount');
    });

    it('should reject non-member access', async () => {
      await request(app.getHttpServer())
        .get(`/organizations/${organizationId}/statistics`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });
  });

  describe('DELETE /organizations/:id', () => {
    let organizationId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Organization',
          description: 'Test',
        });
      organizationId = res.body.id;
    });

    it('should delete organization as OWNER', async () => {
      await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);

      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      expect(org).toBeNull();
    });

    it('should prevent deletion if organization has active listings', async () => {
      const categoryId = (await prisma.category.findFirst())?.id || 'default-category';
      await prisma.listing.create({
        data: {
          title: 'Test Property',
          description: 'Test',
          ownerId: ownerUserId,
          organizationId: organizationId,
          categoryId,
          basePrice: 100,
          currency: 'USD',
          status: 'AVAILABLE',
          bookingMode: 'INSTANT_BOOK',
        },
      });

      await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
    });

    it('should prevent deletion by non-OWNER', async () => {
      // Add member
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.MEMBER,
        });

      await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('should cascade delete members on organization deletion', async () => {
      // Add member
      await request(app.getHttpServer())
        .post(`/organizations/${organizationId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'org_member@test.com',
          role: OrganizationRole.MEMBER,
        });

      await request(app.getHttpServer())
        .delete(`/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(204);

      const members = await prisma.organizationMember.findMany({
        where: { organizationId },
      });
      expect(members).toHaveLength(0);
    });
  });
});
