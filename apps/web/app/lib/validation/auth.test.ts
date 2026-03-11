import { describe, it, expect } from "vitest";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "~/lib/validation/auth";

describe("loginSchema", () => {
  it("accepts valid login", () => {
    const result = loginSchema.safeParse({ email: "ram@test.np", password: "password123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({ email: "", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "notanemail", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = loginSchema.safeParse({ email: "ram@test.np", password: "short" });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  const valid = {
    email: "ram@test.np",
    password: "Password1!",
    confirmPassword: "Password1!",
    firstName: "Ram",
  };

  it("accepts valid signup", () => {
    const result = signupSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = signupSchema.safeParse({ ...valid, confirmPassword: "Other1!" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("confirmPassword");
    }
  });

  it("rejects weak password (no uppercase)", () => {
    const result = signupSchema.safeParse({ ...valid, password: "password1!", confirmPassword: "password1!" });
    expect(result.success).toBe(false);
  });

  it("rejects weak password (no number)", () => {
    const result = signupSchema.safeParse({ ...valid, password: "Password!", confirmPassword: "Password!" });
    expect(result.success).toBe(false);
  });

  it("rejects weak password (no special char)", () => {
    const result = signupSchema.safeParse({ ...valid, password: "Password1", confirmPassword: "Password1" });
    expect(result.success).toBe(false);
  });

  it("rejects short firstName", () => {
    const result = signupSchema.safeParse({ ...valid, firstName: "R" });
    expect(result.success).toBe(false);
  });

  it("accepts optional phone", () => {
    const result = signupSchema.safeParse({ ...valid, phone: "+9779800000000" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid phone", () => {
    const result = signupSchema.safeParse({ ...valid, phone: "abc" });
    expect(result.success).toBe(false);
  });

  it("accepts empty string phone", () => {
    const result = signupSchema.safeParse({ ...valid, phone: "" });
    expect(result.success).toBe(true);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "ram@test.np" }).success).toBe(true);
  });

  it("rejects empty email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "NewPass1!",
      confirmPassword: "NewPass1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "NewPass1!",
      confirmPassword: "Different1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects weak password", () => {
    const result = resetPasswordSchema.safeParse({
      password: "weak",
      confirmPassword: "weak",
    });
    expect(result.success).toBe(false);
  });
});
