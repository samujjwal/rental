import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

// Must use vi.hoisted for variables referenced in vi.mock factories
const { mockGetState } = vi.hoisted(() => ({
  mockGetState: vi.fn(),
}));

vi.mock("./store/auth", () => ({
  useAuthStore: { getState: mockGetState },
}));

vi.mock("~/lib/navigation", () => ({
  requestNavigation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("ApiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetState.mockReturnValue({
      accessToken: "test-token",
      refreshToken: "refresh-token",
      setTokens: vi.fn(),
      clearAuth: vi.fn(),
    });
  });

  // Since the module creates a singleton on import, we test the exported instance
  it("exports api and apiClient", async () => {
    const mod = await import("./api-client");
    expect(mod.api).toBeDefined();
    expect(mod.apiClient).toBeDefined();
    expect(mod.api).toBe(mod.apiClient);
  });

  it("api has get, post, put, patch, delete methods", async () => {
    const { api } = await import("./api-client");
    expect(typeof api.get).toBe("function");
    expect(typeof api.post).toBe("function");
    expect(typeof api.put).toBe("function");
    expect(typeof api.patch).toBe("function");
    expect(typeof api.delete).toBe("function");
  });
});

describe("Validation schemas: auth", () => {
  it("loginSchema validates correct input", async () => {
    const { loginSchema } = await import("./validation/auth");
    const result = loginSchema.safeParse({
      email: "test@test.np",
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("loginSchema rejects empty email", async () => {
    const { loginSchema } = await import("./validation/auth");
    const result = loginSchema.safeParse({ email: "", password: "12345678" });
    expect(result.success).toBe(false);
  });

  it("loginSchema rejects invalid email", async () => {
    const { loginSchema } = await import("./validation/auth");
    const result = loginSchema.safeParse({
      email: "not-email",
      password: "12345678",
    });
    expect(result.success).toBe(false);
  });

  it("loginSchema rejects short password", async () => {
    const { loginSchema } = await import("./validation/auth");
    const result = loginSchema.safeParse({
      email: "test@test.np",
      password: "123",
    });
    expect(result.success).toBe(false);
  });
});

describe("Validation schemas: signup", () => {
  const validSignup = {
    email: "user@test.np",
    password: "Password1!",
    confirmPassword: "Password1!",
    firstName: "Ram",
    lastName: "Sharma",
  };

  it("signupSchema validates correct input", async () => {
    const { signupSchema } = await import("./validation/auth");
    const result = signupSchema.safeParse(validSignup);
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", async () => {
    const { signupSchema } = await import("./validation/auth");
    const result = signupSchema.safeParse({
      ...validSignup,
      confirmPassword: "Different1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("confirmPassword");
    }
  });

  it("rejects weak password without uppercase", async () => {
    const { signupSchema } = await import("./validation/auth");
    const result = signupSchema.safeParse({
      ...validSignup,
      password: "password1!",
      confirmPassword: "password1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects weak password without special char", async () => {
    const { signupSchema } = await import("./validation/auth");
    const result = signupSchema.safeParse({
      ...validSignup,
      password: "Password1",
      confirmPassword: "Password1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short first name", async () => {
    const { signupSchema } = await import("./validation/auth");
    const result = signupSchema.safeParse({
      ...validSignup,
      firstName: "R",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional phone in E.164 format", async () => {
    const { signupSchema } = await import("./validation/auth");
    const result = signupSchema.safeParse({
      ...validSignup,
      phone: "+9779801234567",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty phone string", async () => {
    const { signupSchema } = await import("./validation/auth");
    const result = signupSchema.safeParse({
      ...validSignup,
      phone: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid phone format", async () => {
    const { signupSchema } = await import("./validation/auth");
    const result = signupSchema.safeParse({
      ...validSignup,
      phone: "abc123",
    });
    expect(result.success).toBe(false);
  });
});

describe("Validation schemas: forgotPassword", () => {
  it("validates correct email", async () => {
    const { forgotPasswordSchema } = await import("./validation/auth");
    const result = forgotPasswordSchema.safeParse({ email: "user@test.np" });
    expect(result.success).toBe(true);
  });

  it("rejects empty email", async () => {
    const { forgotPasswordSchema } = await import("./validation/auth");
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });
});

describe("Validation schemas: resetPassword", () => {
  it("validates matching strong passwords", async () => {
    const { resetPasswordSchema } = await import("./validation/auth");
    const result = resetPasswordSchema.safeParse({
      password: "NewPass1!",
      confirmPassword: "NewPass1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", async () => {
    const { resetPasswordSchema } = await import("./validation/auth");
    const result = resetPasswordSchema.safeParse({
      password: "NewPass1!",
      confirmPassword: "Different1!",
    });
    expect(result.success).toBe(false);
  });
});
