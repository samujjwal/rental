import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('~/lib/api-client', () => ({
  api: mockApi,
}));

import { usersApi } from './users';

describe('usersApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getUserById calls GET /users/:id', async () => {
    mockApi.get.mockResolvedValue({ id: '123', firstName: 'Test' });
    const result = await usersApi.getUserById('123');
    expect(mockApi.get).toHaveBeenCalledWith('/users/123');
    expect(result.id).toBe('123');
  });

  it('getCurrentUser calls GET /users/me', async () => {
    mockApi.get.mockResolvedValue({ id: '1', email: 'test@test.com' });
    const result = await usersApi.getCurrentUser();
    expect(mockApi.get).toHaveBeenCalledWith('/users/me');
    expect(result.email).toBe('test@test.com');
  });

  it('getUserStats calls GET /users/me/stats', async () => {
    const stats = { listingsCount: 5, bookingsAsRenter: 3 };
    mockApi.get.mockResolvedValue(stats);
    const result = await usersApi.getUserStats();
    expect(mockApi.get).toHaveBeenCalledWith('/users/me/stats');
    expect(result.listingsCount).toBe(5);
  });

  it('updateCurrentUser calls PATCH /users/me', async () => {
    const updated = { id: '1', firstName: 'Updated' };
    mockApi.patch.mockResolvedValue(updated);
    const result = await usersApi.updateCurrentUser({ firstName: 'Updated' });
    expect(mockApi.patch).toHaveBeenCalledWith('/users/me', { firstName: 'Updated' });
    expect(result.firstName).toBe('Updated');
  });

  it('deleteAccount calls DELETE /users/me', async () => {
    mockApi.delete.mockResolvedValue({ message: 'Account deleted' });
    const result = await usersApi.deleteAccount();
    expect(mockApi.delete).toHaveBeenCalledWith('/users/me');
    expect(result.message).toBe('Account deleted');
  });

  it('upgradeToOwner calls POST /users/upgrade-to-owner', async () => {
    mockApi.post.mockResolvedValue({ id: '1', role: 'OWNER' });
    const result = await usersApi.upgradeToOwner();
    expect(mockApi.post).toHaveBeenCalledWith('/users/upgrade-to-owner');
    expect(result.role).toBe('OWNER');
  });
});
