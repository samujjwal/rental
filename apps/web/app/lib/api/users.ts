import { api } from "~/lib/api-client";
import type { User, PublicUser } from "~/types/user";

export const usersApi = {
  async getUserById(userId: string): Promise<PublicUser> {
    return api.get<PublicUser>(`/users/${userId}`);
  },

  async getCurrentUser(): Promise<User> {
    return api.get<User>("/users/me");
  },

  async getUserStats(): Promise<{
    listingsCount: number;
    bookingsAsRenter: number;
    bookingsAsOwner: number;
    reviewsGiven: number;
    reviewsReceived: number;
    averageRating: number | null;
    totalReviews: number | null;
    responseRate: number | null;
    responseTime: number | null;
    memberSince: string;
  }> {
    return api.get("/users/me/stats");
  },

  async updateCurrentUser(data: Partial<User>): Promise<User> {
    return api.patch<User>("/users/me", data);
  },

  async deleteAccount(): Promise<{ message: string }> {
    return api.delete<{ message: string }>("/users/me");
  },

  async upgradeToOwner(): Promise<User> {
    return api.post<User>("/users/upgrade-to-owner");
  },
};
