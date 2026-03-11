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

import { fraudApi } from './fraud';

describe('fraudApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHighRiskUsers', () => {
    it('calls GET /fraud/high-risk-users with default limit', async () => {
      mockApi.get.mockResolvedValue([]);
      await fraudApi.getHighRiskUsers();
      expect(mockApi.get).toHaveBeenCalledWith('/fraud/high-risk-users?limit=20');
    });

    it('calls GET /fraud/high-risk-users with custom limit', async () => {
      mockApi.get.mockResolvedValue([]);
      await fraudApi.getHighRiskUsers(50);
      expect(mockApi.get).toHaveBeenCalledWith('/fraud/high-risk-users?limit=50');
    });

    it('returns data from API', async () => {
      const users = [{ id: '1', riskScore: 0.9 }];
      mockApi.get.mockResolvedValue(users);
      const result = await fraudApi.getHighRiskUsers();
      expect(result).toEqual(users);
    });

    it('propagates API errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Forbidden'));
      await expect(fraudApi.getHighRiskUsers()).rejects.toThrow('Forbidden');
    });

    it('accepts limit of 0', async () => {
      mockApi.get.mockResolvedValue([]);
      await fraudApi.getHighRiskUsers(0);
      expect(mockApi.get).toHaveBeenCalledWith('/fraud/high-risk-users?limit=0');
    });
  });
});
