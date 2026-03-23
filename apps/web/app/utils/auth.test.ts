import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGetSession = vi.fn();
const mockCommitSession = vi.fn();
const mockDestroySession = vi.fn();

vi.mock("react-router", () => ({
  createCookieSessionStorage: () => ({
    getSession: mockGetSession,
    commitSession: mockCommitSession,
    destroySession: mockDestroySession,
  }),
  redirect: (url: string, init?: ResponseInit) => {
    const resp = new Response(null, {
      status: 302,
      headers: {
        ...(init?.headers instanceof Headers
          ? Object.fromEntries(init.headers.entries())
          : (init?.headers as Record<string, string>) ?? {}),
        Location: url,
      },
    });
    return resp;
  },
}));

const mockApiGet = vi.fn();
const mockFetch = vi.fn();
vi.mock("~/lib/api-client", () => ({
  api: { get: (...args: any[]) => mockApiGet(...args) },
}));

const mockClearAuth = vi.fn();
vi.mock("~/lib/store/auth", () => ({
  useAuthStore: {
    getState: () => ({
      accessToken: null,
      refreshToken: null,
      clearAuth: mockClearAuth,
    }),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(data: Record<string, string> = {}) {
  const store = new Map(Object.entries(data));
  return {
    get: (key: string) => store.get(key),
    set: (key: string, val: string) => store.set(key, val),
  };
}

function makeRequest(url = "http://localhost/test", cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  return new Request(url, { headers });
}

async function withoutBrowserGlobals<T>(callback: () => Promise<T>): Promise<T> {
  const descriptors = {
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: undefined,
  });

  try {
    return await callback();
  } finally {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete (globalThis as Record<string, unknown>)[key];
      }
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("auth utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    // Default: getSession returns an empty session
    mockGetSession.mockResolvedValue(makeSession());
    mockCommitSession.mockResolvedValue("session-cookie");
  });

  // We lazily import so mocks are set up first
  async function loadAuth() {
    return import("./auth");
  }

  describe("getSession", () => {
    it("passes Cookie header to session storage", async () => {
      const auth = await loadAuth();
      const req = makeRequest("http://localhost/", "my-cookie");
      await auth.getSession(req);
      expect(mockGetSession).toHaveBeenCalledWith("my-cookie");
    });

    it("passes null when no Cookie header", async () => {
      const auth = await loadAuth();
      const req = makeRequest("http://localhost/");
      await auth.getSession(req);
      expect(mockGetSession).toHaveBeenCalledWith(null);
    });
  });

  describe("getUserId", () => {
    it("returns userId from session", async () => {
      mockGetSession.mockResolvedValue(makeSession({ userId: "u123" }));
      const auth = await loadAuth();
      const id = await auth.getUserId(makeRequest());
      expect(id).toBe("u123");
    });

    it("returns undefined when no userId in session", async () => {
      const auth = await loadAuth();
      const id = await auth.getUserId(makeRequest());
      expect(id).toBeUndefined();
    });
  });

  describe("getUserToken", () => {
    it("returns accessToken from session", async () => {
      mockGetSession.mockResolvedValue(
        makeSession({ accessToken: "tok123" })
      );
      const auth = await loadAuth();
      const token = await auth.getUserToken(makeRequest());
      expect(token).toBe("tok123");
    });

    it("returns undefined when no token", async () => {
      const auth = await loadAuth();
      const token = await auth.getUserToken(makeRequest());
      expect(token).toBeUndefined();
    });
  });

  describe("getUser", () => {
    it("returns null when no token in session", async () => {
      const auth = await loadAuth();
      const user = await auth.getUser(makeRequest());
      expect(user).toBeNull();
    });

    it("fetches user from API and normalizes role", async () => {
      mockGetSession.mockResolvedValue(
        makeSession({ accessToken: "tok", refreshToken: "ref" })
      );
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          id: "u1",
          name: "Test",
          role: "ADMIN",
        }),
      });

      const auth = await loadAuth();
      const user = await withoutBrowserGlobals(() => auth.getUser(makeRequest()));
      expect(user).toMatchObject({ id: "u1", name: "Test", role: "admin" });
      expect(mockFetch).toHaveBeenCalledWith("http://localhost:3400/api/auth/me", {
        headers: {
          Authorization: "Bearer tok",
          "Content-Type": "application/json",
        },
      });
    });

    it("normalizes HOST role to owner", async () => {
      mockGetSession.mockResolvedValue(
        makeSession({ accessToken: "tok" })
      );
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ id: "u2", role: "HOST" }),
      });

      const auth = await loadAuth();
      const user = await withoutBrowserGlobals(() => auth.getUser(makeRequest()));
      expect(user?.role).toBe("owner");
    });

    it("normalizes unknown role to renter", async () => {
      mockGetSession.mockResolvedValue(
        makeSession({ accessToken: "tok" })
      );
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ id: "u3", role: "USER" }),
      });

      const auth = await loadAuth();
      const user = await withoutBrowserGlobals(() => auth.getUser(makeRequest()));
      expect(user?.role).toBe("renter");
    });

    it("returns null on 401 error", async () => {
      mockGetSession.mockResolvedValue(
        makeSession({ accessToken: "tok" })
      );
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const auth = await loadAuth();
      const user = await withoutBrowserGlobals(() => auth.getUser(makeRequest()));
      expect(user).toBeNull();
    });

    it("returns null on generic API error", async () => {
      mockGetSession.mockResolvedValue(
        makeSession({ accessToken: "tok" })
      );
      mockFetch.mockRejectedValue(new Error("network"));

      const auth = await loadAuth();
      const user = await withoutBrowserGlobals(() => auth.getUser(makeRequest()));
      expect(user).toBeNull();
    });
  });

  describe("requireUserId", () => {
    it("returns userId when present in session", async () => {
      mockGetSession.mockResolvedValue(makeSession({ userId: "u99" }));
      const auth = await loadAuth();
      const id = await auth.requireUserId(makeRequest());
      expect(id).toBe("u99");
    });

    it("throws redirect when no userId", async () => {
      const auth = await loadAuth();
      const req = makeRequest("http://localhost/protected");
      try {
        await auth.requireUserId(req);
        expect.fail("should have thrown");
      } catch (e) {
        const resp = e as Response;
        expect(resp.status).toBe(302);
      }
    });
  });

  describe("requireUser", () => {
    it("returns user when authenticated", async () => {
      mockGetSession.mockResolvedValue(
        makeSession({ accessToken: "tok" })
      );
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ id: "u1", role: "OWNER" }),
      });

      const auth = await loadAuth();
      const user = await withoutBrowserGlobals(() => auth.requireUser(makeRequest()));
      expect(user).toMatchObject({ id: "u1", role: "owner" });
    });

    it("throws redirect when no user", async () => {
      const auth = await loadAuth();
      try {
        await auth.requireUser(
          makeRequest("http://localhost/dashboard")
        );
        expect.fail("should have thrown");
      } catch (e) {
        const resp = e as Response;
        expect(resp.status).toBe(302);
      }
    });
  });

  describe("requireAdmin", () => {
    it("returns user when admin", async () => {
      mockGetSession.mockResolvedValue(
        makeSession({ accessToken: "tok" })
      );
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ id: "a1", role: "ADMIN" }),
      });

      const auth = await loadAuth();
      const user = await withoutBrowserGlobals(() => auth.requireAdmin(makeRequest()));
      expect(user.role).toBe("admin");
    });

    it("throws redirect when not admin", async () => {
      mockGetSession.mockResolvedValue(
        makeSession({ accessToken: "tok" })
      );
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ id: "u1", role: "USER" }),
      });

      const auth = await loadAuth();
      try {
        await withoutBrowserGlobals(() => auth.requireAdmin(makeRequest()));
        expect.fail("should have thrown");
      } catch (e) {
        const resp = e as Response;
        expect(resp.status).toBe(302);
      }
    });
  });

  describe("createUserSession", () => {
    it("creates session and returns redirect response", async () => {
      mockGetSession.mockResolvedValue(makeSession());
      const auth = await loadAuth();

      const resp = await auth.createUserSession({
        userId: "u1",
        accessToken: "at",
        refreshToken: "rt",
        remember: true,
        redirectTo: "/dashboard",
      });

      expect(resp.status).toBe(302);
      expect(mockCommitSession).toHaveBeenCalled();
    });

    it("commits session with 30-day maxAge when remember=true", async () => {
      mockGetSession.mockResolvedValue(makeSession());
      const auth = await loadAuth();

      await auth.createUserSession({
        userId: "u1",
        accessToken: "at",
        refreshToken: "rt",
        remember: true,
        redirectTo: "/",
      });

      const commitOptions = mockCommitSession.mock.calls[0][1];
      expect(commitOptions.maxAge).toBe(60 * 60 * 24 * 30);
    });

    it("commits session with undefined maxAge when remember=false", async () => {
      mockGetSession.mockResolvedValue(makeSession());
      const auth = await loadAuth();

      await auth.createUserSession({
        userId: "u1",
        accessToken: "at",
        refreshToken: "rt",
        remember: false,
        redirectTo: "/",
      });

      const commitOptions = mockCommitSession.mock.calls[0][1];
      expect(commitOptions.maxAge).toBeUndefined();
    });
  });

  describe("logout", () => {
    it("destroys session and redirects to /", async () => {
      const session = makeSession();
      mockGetSession.mockResolvedValue(session);
      mockDestroySession.mockResolvedValue("destroyed-cookie");

      const auth = await loadAuth();
      const resp = await auth.logout(makeRequest());

      expect(resp.status).toBe(302);
      expect(mockDestroySession).toHaveBeenCalledWith(session);
    });
  });
});
