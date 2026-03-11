import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("~/lib/api-client", () => ({
  api: mockApi,
  apiClient: mockApi,
}));

import { authApi } from "~/lib/api/auth";

describe("authApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("login posts credentials to /auth/login", async () => {
    const creds = { email: "a@test.np", password: "pass1234" };
    mockApi.post.mockResolvedValue({ accessToken: "t" });
    const result = await authApi.login(creds);
    expect(mockApi.post).toHaveBeenCalledWith("/auth/login", creds);
    expect(result).toEqual({ accessToken: "t" });
  });

  it("devLogin posts to /auth/dev-login", async () => {
    mockApi.post.mockResolvedValue({ accessToken: "dev" });
    await authApi.devLogin({ email: "a@test.np", role: "admin" });
    expect(mockApi.post).toHaveBeenCalledWith("/auth/dev-login", { email: "a@test.np", role: "admin" });
  });

  it("signup posts to /auth/register", async () => {
    const data = { email: "a@a.np", password: "P@ss1234", firstName: "A", lastName: "B" };
    mockApi.post.mockResolvedValue({ accessToken: "t" });
    await authApi.signup(data as any);
    expect(mockApi.post).toHaveBeenCalledWith("/auth/register", data);
  });

  it("logout posts refreshToken to /auth/logout", async () => {
    mockApi.post.mockResolvedValue(undefined);
    await authApi.logout("rt");
    expect(mockApi.post).toHaveBeenCalledWith("/auth/logout", { refreshToken: "rt" });
  });

  it("refreshToken posts to /auth/refresh", async () => {
    mockApi.post.mockResolvedValue({ accessToken: "new" });
    await authApi.refreshToken("rt");
    expect(mockApi.post).toHaveBeenCalledWith("/auth/refresh", { refreshToken: "rt" });
  });

  it("forgotPassword posts to /auth/password/reset-request", async () => {
    mockApi.post.mockResolvedValue({ message: "sent" });
    await authApi.forgotPassword({ email: "e@t.np" } as any);
    expect(mockApi.post).toHaveBeenCalledWith("/auth/password/reset-request", { email: "e@t.np" });
  });

  it("resetPassword posts to /auth/password/reset", async () => {
    mockApi.post.mockResolvedValue({ message: "ok" });
    await authApi.resetPassword({ token: "tok", password: "P@ss1234" } as any);
    expect(mockApi.post).toHaveBeenCalledWith("/auth/password/reset", { token: "tok", password: "P@ss1234" });
  });

  it("changePassword posts to /auth/password/change", async () => {
    mockApi.post.mockResolvedValue(undefined);
    await authApi.changePassword({ currentPassword: "old", newPassword: "new" });
    expect(mockApi.post).toHaveBeenCalledWith("/auth/password/change", {
      currentPassword: "old",
      newPassword: "new",
    });
  });

  it("getCurrentUser calls GET /auth/me", async () => {
    mockApi.get.mockResolvedValue({ id: "u1" });
    const result = await authApi.getCurrentUser();
    expect(mockApi.get).toHaveBeenCalledWith("/auth/me");
    expect(result).toEqual({ id: "u1" });
  });
});
