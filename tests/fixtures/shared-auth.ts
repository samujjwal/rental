/**
 * Task 4.4: Shared auth fixtures used by both Playwright E2E and API integration tests.
 *
 * Usage:
 *   import { testUsers, mockTokens, mockLoginResponse, mockUserProfile } from '../../tests/fixtures/shared-auth';
 */

export const testUsers = {
  renter: {
    id: 'test-renter-id',
    email: 'renter@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'Renter',
    role: 'renter' as const,
    phoneNumber: '+9779800000001',
  },
  owner: {
    id: 'test-owner-id',
    email: 'owner@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'Owner',
    role: 'owner' as const,
    phoneNumber: '+9779800000002',
  },
  admin: {
    id: 'test-admin-id',
    email: 'admin@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'admin' as const,
    phoneNumber: '+9779800000003',
  },
} as const;

export type TestUserRole = keyof typeof testUsers;

export const mockTokens = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
} as const;

export function mockLoginResponse(role: TestUserRole = 'renter') {
  const user = testUsers[role];
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: 'ACTIVE',
      emailVerified: true,
      phoneVerified: false,
    },
    accessToken: mockTokens.accessToken,
    refreshToken: mockTokens.refreshToken,
  };
}

export function mockUserProfile(role: TestUserRole = 'renter') {
  const user = testUsers[role];
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: 'ACTIVE',
    emailVerified: true,
    phoneVerified: false,
  };
}

export function authHeader(token: string = mockTokens.accessToken) {
  return { Authorization: `Bearer ${token}` };
}
