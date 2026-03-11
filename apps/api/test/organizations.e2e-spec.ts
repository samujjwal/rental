import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { OrganizationRole, OrganizationStatus, UserRole } from '@rental-portal/database';
import { buildTestEmail, cleanupCoreRelationalData, createUserWithRole } from './e2e-helpers';

describe('Organizations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let ownerUserId: string;
  let memberToken: string;
  let memberUserId: string;
  let adminMemberToken: string;
  let adminMemberUserId: string;
  let outsiderToken: string;
  let outsiderUserId: string;

  const ownerEmail = buildTestEmail('org-owner');
  const memberEmail = buildTestEmail('org-member');
  const adminMemberEmail = buildTestEmail('org-admin-member');
  const outsiderEmail = buildTestEmail('org-outsider');

  const createOrganizationPayload = () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      name: `Organization ${suffix}`,
      description: 'Organization flow validation',
      businessType: 'LLC',
      email: `organization-${suffix}@example.com`,
      phoneNumber: '+1234567890',
      city: 'Test City',
      state: 'TS',
      country: 'US',
    };
  };

  const createOrganization = async (token: string, payload = createOrganizationPayload()) => {
    const response = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    return response.body;
  };

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
    await prisma.organizationMember.deleteMany({});
    await prisma.organization.deleteMany({});
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: [ownerEmail, memberEmail, adminMemberEmail, outsiderEmail] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, memberEmail, adminMemberEmail, outsiderEmail] } },
    });
    await app.close();
  });

  beforeEach(async () => {
    await cleanupCoreRelationalData(prisma);
    await prisma.organizationMember.deleteMany({});
    await prisma.organization.deleteMany({});
    await prisma.listing.deleteMany({
      where: { owner: { email: { in: [ownerEmail, memberEmail, adminMemberEmail, outsiderEmail] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, memberEmail, adminMemberEmail, outsiderEmail] } },
    });

    const owner = await createUserWithRole({
      app,
      prisma,
      email: ownerEmail,
      firstName: 'Owner',
      lastName: 'Org',
      role: UserRole.HOST,
    });
    ownerToken = owner.accessToken;
    ownerUserId = owner.userId;

    const member = await createUserWithRole({
      app,
      prisma,
      email: memberEmail,
      firstName: 'Member',
      lastName: 'Org',
      role: UserRole.HOST,
    });
    memberToken = member.accessToken;
    memberUserId = member.userId;

    const adminMember = await createUserWithRole({
      app,
      prisma,
      email: adminMemberEmail,
      firstName: 'Admin',
      lastName: 'Member',
      role: UserRole.HOST,
    });
    adminMemberToken = adminMember.accessToken;
    adminMemberUserId = adminMember.userId;

    const outsider = await createUserWithRole({
      app,
      prisma,
      email: outsiderEmail,
      firstName: 'Outsider',
      lastName: 'Org',
      role: UserRole.HOST,
    });
    outsiderToken = outsider.accessToken;
    outsiderUserId = outsider.userId;
  });

  it('creates an organization and owner membership', async () => {
    const organization = await createOrganization(ownerToken);

    expect(organization.id).toBeDefined();
    expect(organization.ownerId).toBe(ownerUserId);

    const ownerMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: ownerUserId,
        },
      },
    });

    expect(ownerMember?.role).toBe(OrganizationRole.OWNER);
  });

  it('prevents duplicate organization ownership for the same user', async () => {
    await createOrganization(ownerToken);

    await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(createOrganizationPayload())
      .expect(400);
  });

  it('allows owner to invite a member', async () => {
    const organization = await createOrganization(ownerToken);

    const invited = await request(app.getHttpServer())
      .post(`/organizations/${organization.id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: memberEmail,
        role: OrganizationRole.MEMBER,
      })
      .expect(201);

    expect(invited.body.userId).toBe(memberUserId);
    expect(invited.body.role).toBe(OrganizationRole.MEMBER);
  });

  it('allows admin member to invite after owner grants admin role', async () => {
    const organization = await createOrganization(ownerToken);

    await request(app.getHttpServer())
      .post(`/organizations/${organization.id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: adminMemberEmail,
        role: OrganizationRole.ADMIN,
      })
      .expect(201);

    const invited = await request(app.getHttpServer())
      .post(`/organizations/${organization.id}/members`)
      .set('Authorization', `Bearer ${adminMemberToken}`)
      .send({
        email: outsiderEmail,
        role: OrganizationRole.MEMBER,
      })
      .expect(201);

    expect(invited.body.userId).toBe(outsiderUserId);
    expect(invited.body.role).toBe(OrganizationRole.MEMBER);
  });

  it('updates member role as owner', async () => {
    const organization = await createOrganization(ownerToken);

    await request(app.getHttpServer())
      .post(`/organizations/${organization.id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: memberEmail,
        role: OrganizationRole.MEMBER,
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .put(`/organizations/${organization.id}/members/${memberUserId}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: OrganizationRole.ADMIN })
      .expect(200);

    expect(updated.body.role).toBe(OrganizationRole.ADMIN);
  });

  it('returns organization details for members and blocks outsiders', async () => {
    const organization = await createOrganization(ownerToken);

    await request(app.getHttpServer())
      .post(`/organizations/${organization.id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: memberEmail,
        role: OrganizationRole.MEMBER,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/organizations/${organization.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/organizations/${organization.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('returns organization stats for owner', async () => {
    const organization = await createOrganization(ownerToken);

    const stats = await request(app.getHttpServer())
      .get(`/organizations/${organization.id}/stats`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(stats.body).toHaveProperty('totalListings');
    expect(stats.body).toHaveProperty('activeListings');
    expect(stats.body).toHaveProperty('totalBookings');
    expect(stats.body).toHaveProperty('totalRevenue');
  });

  it('deactivates organization for owner', async () => {
    const organization = await createOrganization(ownerToken);

    await request(app.getHttpServer())
      .delete(`/organizations/${organization.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);

    const deactivated = await prisma.organization.findUnique({ where: { id: organization.id } });
    expect(deactivated?.status).toBe(OrganizationStatus.SUSPENDED);
  });
});
