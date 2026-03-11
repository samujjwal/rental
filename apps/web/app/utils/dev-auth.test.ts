import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the dependencies
const mockPost = vi.fn();
const mockGetSession = vi.fn();
const mockSessionSet = vi.fn();

vi.mock("./auth.server", () => ({
  sessionStorage: {
    getSession: vi.fn(),
  },
}));

vi.mock("~/lib/api-client.server", () => ({
  serverApi: {
    post: vi.fn(),
  },
}));

// Must import after mocks
import { createDevSession, DEV_USERS } from "./dev-auth";
import { sessionStorage } from "./auth.server";
import { serverApi } from "~/lib/api-client.server";

describe("dev-auth", () => {
  const mockSession = {
    set: vi.fn(),
    get: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessionStorage.getSession).mockResolvedValue(mockSession as any);
  });

  describe("createDevSession", () => {
    const mockRequest = new Request("http://localhost:3000");

    it("returns null in production", async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const result = await createDevSession("admin@test.com", mockRequest);
      expect(result).toBeNull();

      process.env.NODE_ENV = origEnv;
    });

    it("returns session in development", async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      vi.mocked(serverApi.post).mockResolvedValue({
        user: { id: "user-1", email: "admin@test.com" },
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });

      const result = await createDevSession("admin@test.com", mockRequest);
      expect(result).toBe(mockSession);

      process.env.NODE_ENV = origEnv;
    });

    it("calls API with email and default password", async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      vi.mocked(serverApi.post).mockResolvedValue({
        user: { id: "u1" },
        accessToken: "at",
        refreshToken: "rt",
      });

      await createDevSession("test@test.com", mockRequest);

      expect(serverApi.post).toHaveBeenCalledWith("/auth/login", {
        email: "test@test.com",
        password: "password123",
      });

      process.env.NODE_ENV = origEnv;
    });

    it("sets session values correctly", async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const userData = {
        user: { id: "user-42", email: "owner@test.com", role: "OWNER" },
        accessToken: "my-access-token",
        refreshToken: "my-refresh-token",
      };
      vi.mocked(serverApi.post).mockResolvedValue(userData);

      await createDevSession("owner@test.com", mockRequest);

      expect(mockSession.set).toHaveBeenCalledWith("userId", "user-42");
      expect(mockSession.set).toHaveBeenCalledWith(
        "accessToken",
        "my-access-token"
      );
      expect(mockSession.set).toHaveBeenCalledWith(
        "refreshToken",
        "my-refresh-token"
      );
      expect(mockSession.set).toHaveBeenCalledWith("user", userData.user);

      process.env.NODE_ENV = origEnv;
    });

    it("returns null on API error", async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      vi.mocked(serverApi.post).mockRejectedValue(new Error("API down"));

      const result = await createDevSession("test@test.com", mockRequest);
      expect(result).toBeNull();

      process.env.NODE_ENV = origEnv;
    });

    it("reads Cookie header from request", async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      vi.mocked(serverApi.post).mockResolvedValue({
        user: { id: "u1" },
        accessToken: "at",
        refreshToken: "rt",
      });

      const reqWithCookie = new Request("http://localhost:3000", {
        headers: { Cookie: "session=abc123" },
      });
      await createDevSession("test@test.com", reqWithCookie);

      expect(sessionStorage.getSession).toHaveBeenCalledWith("session=abc123");

      process.env.NODE_ENV = origEnv;
    });
  });

  describe("DEV_USERS", () => {
    it("has admin email", () => {
      expect(DEV_USERS.admin).toBe("admin@rental-portal.com");
    });

    it("has support email", () => {
      expect(DEV_USERS.support).toBe("support@rental.local");
    });

    it("has owner1 and owner2 emails", () => {
      expect(DEV_USERS.owner1).toBe("john.owner@rental.local");
      expect(DEV_USERS.owner2).toBe("emily.tools@rental.local");
    });

    it("has customer1 and customer2 emails", () => {
      expect(DEV_USERS.customer1).toBe("mike.customer@rental.local");
      expect(DEV_USERS.customer2).toBe("lisa.renter@rental.local");
    });

    it("has 6 dev users", () => {
      expect(Object.keys(DEV_USERS).length).toBe(6);
    });
  });
});
