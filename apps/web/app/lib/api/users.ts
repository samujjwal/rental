import { api } from '~/lib/api-client';
import type { User } from '~/types/user';

export const usersApi = {
  async getUserById(userId: string): Promise<User> {
    return api.get<User>(`/users/${userId}`);
  },

  async getCurrentUser(): Promise<User> {
    return api.get<User>('/users/me');
  },

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    return api.put<User>(`/users/${userId}`, data);
  },

  async uploadAvatar(userId: string, file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post<{ avatarUrl: string }>(`/users/${userId}/avatar`, formData);
  },
};
