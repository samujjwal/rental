import { api } from "~/lib/api-client";
import type { User, PublicUser } from "~/types/user";

function normalizeUser<T extends Record<string, unknown>>(user: T): T & { phoneNumber?: string } {
  const phoneNumber =
    typeof user.phoneNumber === "string"
      ? user.phoneNumber
      : typeof user.phone === "string"
        ? user.phone
        : undefined;

  return {
    ...user,
    ...(phoneNumber ? { phoneNumber } : {}),
  };
}

export const usersApi = {
  async getUserById(userId: string): Promise<PublicUser> {
    return normalizeUser(await api.get<PublicUser>(`/users/${userId}`));
  },

  async getCurrentUser(): Promise<User> {
    return normalizeUser(await api.get<User>("/users/me")) as User;
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
    return normalizeUser(await api.patch<User>("/users/me", data)) as User;
  },

  async deleteAccount(): Promise<{ message: string }> {
    return api.delete<{ message: string }>("/users/me");
  },

  async upgradeToOwner(): Promise<User> {
    return normalizeUser(await api.post<User>("/users/upgrade-to-owner")) as User;
  },
};
