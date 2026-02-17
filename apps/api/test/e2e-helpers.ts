import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UserRole } from '@rental-portal/database';

const DEFAULT_PASSWORD = 'SecurePass123!';

type RegisterResponse = {
  accessToken: string;
  refreshToken?: string;
  user?: {
    id?: string;
    email?: string;
  };
};

type RegisterUserInput = {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
};

type CreateUserWithRoleInput = RegisterUserInput & {
  app: INestApplication;
  prisma: PrismaService;
  role?: UserRole;
};

export const uniqueSuffix = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const buildTestEmail = (prefix: string, domain = 'test.com'): string =>
  `${prefix}-${uniqueSuffix()}@${domain}`;

const assertAccessToken = (value: unknown, context: string): string => {
  if (typeof value !== 'string' || !value.length) {
    throw new Error(`${context}: accessToken was not returned`);
  }
  return value;
};

const extractUserId = (responseBody: RegisterResponse, context: string): string => {
  const id = responseBody.user?.id;
  if (typeof id !== 'string' || !id.length) {
    throw new Error(`${context}: user.id was not returned`);
  }
  return id;
};

export const registerUser = async (
  app: INestApplication,
  {
    email,
    password = DEFAULT_PASSWORD,
    firstName = 'Test',
    lastName = 'User',
    phoneNumber = '+1234567890',
  }: RegisterUserInput,
): Promise<RegisterResponse> => {
  const response = await request(app.getHttpServer()).post('/auth/register').send({
    email,
    password,
    firstName,
    lastName,
    phoneNumber,
  });

  if (response.status !== 201) {
    throw new Error(
      `registerUser failed (${email}): status=${response.status}, body=${JSON.stringify(response.body)}`,
    );
  }

  return response.body as RegisterResponse;
};

export const loginUser = async (
  app: INestApplication,
  email: string,
  password = DEFAULT_PASSWORD,
): Promise<RegisterResponse> => {
  const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password });

  if (response.status !== 200) {
    throw new Error(
      `loginUser failed (${email}): status=${response.status}, body=${JSON.stringify(response.body)}`,
    );
  }

  return response.body as RegisterResponse;
};

export const createUserWithRole = async ({
  app,
  prisma,
  email,
  password = DEFAULT_PASSWORD,
  firstName = 'Test',
  lastName = 'User',
  phoneNumber = '+1234567890',
  role = UserRole.USER,
}: CreateUserWithRoleInput): Promise<{ userId: string; accessToken: string; refreshToken?: string }> => {
  const registered = await registerUser(app, {
    email,
    password,
    firstName,
    lastName,
    phoneNumber,
  });

  let userId = registered.user?.id;
  if (!userId) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user?.id) {
      throw new Error(`createUserWithRole failed (${email}): user not found after registration`);
    }
    userId = user.id;
  }

  if (role !== UserRole.USER) {
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    const relogin = await loginUser(app, email, password);
    return {
      userId,
      accessToken: assertAccessToken(relogin.accessToken, `createUserWithRole(${email})`),
      refreshToken: relogin.refreshToken,
    };
  }

  return {
    userId: extractUserId(registered, `createUserWithRole(${email})`),
    accessToken: assertAccessToken(registered.accessToken, `createUserWithRole(${email})`),
    refreshToken: registered.refreshToken,
  };
};

export const cleanupCoreRelationalData = async (prisma: PrismaService): Promise<void> => {
  // Child records first to avoid FK violations during suite setup/teardown.
  await prisma.messageReadReceipt.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.conversationParticipant.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.bookingStateHistory.deleteMany({});
  await prisma.disputeResolution.deleteMany({});
  await prisma.disputeTimelineEvent.deleteMany({});
  await prisma.disputeResponse.deleteMany({});
  await prisma.disputeEvidence.deleteMany({});
  await prisma.dispute.deleteMany({});
  await prisma.insuranceClaim.deleteMany({});
  await prisma.insurancePolicy.deleteMany({});
  await prisma.conditionReport.deleteMany({});
  await prisma.refund.deleteMany({});
  await prisma.depositHold.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.ledgerEntry.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.favoriteListing.deleteMany({});
  await prisma.availability.deleteMany({});
  await prisma.booking.deleteMany({});
};
