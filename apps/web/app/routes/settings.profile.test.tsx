import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/* ------------------------------------------------------------------ */
/*  lucide-react — explicit named exports (NO Proxy)                  */
/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));

vi.mock("lucide-react", () => ({
  User: IconStub,
  Mail: IconStub,
  Phone: IconStub,
  Shield: IconStub,
  Bell: IconStub,
  Key: IconStub,
  Save: IconStub,
  Camera: IconStub,
  CreditCard: IconStub,
}));

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  getCurrentUser: vi.fn(),
  getUserStats: vi.fn(),
  updateCurrentUser: vi.fn(),
  deleteAccount: vi.fn(),
  changePassword: vi.fn(),
  uploadImage: vi.fn(),
  redirect: vi.fn((url: string) => {
    const r = new Response(null, { status: 302, headers: { Location: url } });
    return r;
  }),
  useLoaderData: vi.fn(),
  useActionData: vi.fn(),
};

vi.mock("react-router", () => ({
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
  Link: ({ children, to, ...p }: any) => (
    <a href={to} {...p}>
      {children}
    </a>
  ),
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => mocks.useLoaderData(),
  useActionData: () => mocks.useActionData(),
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/users", () => ({
  usersApi: {
    getCurrentUser: (...a: any[]) => mocks.getCurrentUser(...a),
    getUserStats: (...a: any[]) => mocks.getUserStats(...a),
    updateCurrentUser: (...a: any[]) => mocks.updateCurrentUser(...a),
    deleteAccount: (...a: any[]) => mocks.deleteAccount(...a),
  },
}));
vi.mock("~/lib/api/auth", () => ({
  authApi: {
    changePassword: (...a: any[]) => mocks.changePassword(...a),
  },
}));
vi.mock("~/lib/api/upload", () => ({
  uploadApi: {
    uploadImage: (...a: any[]) => mocks.uploadImage(...a),
  },
}));
vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => (
    <button {...p}>{children}</button>
  ),
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    register: () => ({}),
    formState: { errors: {} },
  }),
}));
vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */
function makeFormReq(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

/* ------------------------------------------------------------------ */
/*  Import route under test (after mocks)                              */
/* ------------------------------------------------------------------ */
import { clientLoader, clientAction } from "./settings.profile";
import ProfileSettings from "./settings.profile";

const authUser = { id: "u1", email: "u@test.com", role: "renter" };
const fullUser = {
  id: "u1",
  firstName: "John",
  lastName: "Doe",
  email: "u@test.com",
  phoneNumber: "+1234567890",
  profilePhotoUrl: null,
};
const stats = {
  bookingsAsRenter: 5,
  listingsCount: 2,
  averageRating: 4.5,
};

beforeEach(() => {
  vi.clearAllMocks();
});

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("clientLoader", () => {
  it("redirects unauthenticated users to /auth/login", async () => {
    mocks.getUser.mockResolvedValue(null);
    const result = await clientLoader({
      request: new Request("http://localhost/settings/profile"),
      params: {},
    } as any);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("returns user with stats on success", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getCurrentUser.mockResolvedValue(fullUser);
    mocks.getUserStats.mockResolvedValue(stats);

    const result = await clientLoader({
      request: new Request("http://localhost/settings/profile"),
      params: {},
    } as any);
    expect(result).toEqual({
      user: {
        ...fullUser,
        totalBookings: 5,
        totalListings: 2,
        averageRating: 4.5,
      },
    });
  });

  it("defaults stats to 0/null when missing", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getCurrentUser.mockResolvedValue(fullUser);
    mocks.getUserStats.mockResolvedValue({});

    const result = await clientLoader({
      request: new Request("http://localhost/settings/profile"),
      params: {},
    } as any);
    expect((result as any).user.totalBookings).toBe(0);
    expect((result as any).user.totalListings).toBe(0);
    expect((result as any).user.averageRating).toBeNull();
  });

  it("redirects to /auth/login on API error", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getCurrentUser.mockRejectedValue(new Error("fail"));

    const result = await clientLoader({
      request: new Request("http://localhost/settings/profile"),
      params: {},
    } as any);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe("/auth/login");
  });
});

/* ================================================================== */
/*  clientAction — intent gating                                       */
/* ================================================================== */
describe("clientAction — intent gating", () => {
  it("rejects missing intent", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({}),
      params: {},
    } as any);
    expect(result).toEqual({ success: false, error: "Unsupported action." });
  });

  it("rejects unknown intent", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({ intent: "hack" }),
      params: {},
    } as any);
    expect(result).toEqual({ success: false, error: "Unsupported action." });
  });

  it("redirects unauthenticated action", async () => {
    mocks.getUser.mockResolvedValue(null);
    const result = await clientAction({
      request: makeFormReq({ intent: "update-profile" }),
      params: {},
    } as any);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe("/auth/login");
  });
});

/* ================================================================== */
/*  clientAction — change-password                                     */
/* ================================================================== */
describe("clientAction — change-password", () => {
  it("rejects empty password fields", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({ intent: "change-password" }),
      params: {},
    } as any);
    expect((result as any).error).toMatch(/fill out all password/i);
  });

  it("rejects short new password", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({
        intent: "change-password",
        currentPassword: "oldpass123",
        newPassword: "short",
        confirmPassword: "short",
      }),
      params: {},
    } as any);
    expect((result as any).error).toMatch(/at least 8 characters/i);
  });

  it("rejects oversized new password (>128)", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({
        intent: "change-password",
        currentPassword: "oldpass123",
        newPassword: "a".repeat(129),
        confirmPassword: "a".repeat(129),
      }),
      params: {},
    } as any);
    expect((result as any).error).toMatch(/128 characters or fewer/i);
  });

  it("rejects oversized current password (>128)", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({
        intent: "change-password",
        currentPassword: "a".repeat(129),
        newPassword: "newpass123",
        confirmPassword: "newpass123",
      }),
      params: {},
    } as any);
    expect((result as any).error).toMatch(/current password must be 128/i);
  });

  it("rejects same old and new password", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({
        intent: "change-password",
        currentPassword: "samepass123",
        newPassword: "samepass123",
        confirmPassword: "samepass123",
      }),
      params: {},
    } as any);
    expect((result as any).error).toMatch(/different from current/i);
  });

  it("rejects mismatched confirmation", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({
        intent: "change-password",
        currentPassword: "oldpass123",
        newPassword: "newpass123",
        confirmPassword: "mismatch99",
      }),
      params: {},
    } as any);
    expect((result as any).error).toMatch(/do not match/i);
  });

  it("calls authApi.changePassword on success", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.changePassword.mockResolvedValue({});
    const result = await clientAction({
      request: makeFormReq({
        intent: "change-password",
        currentPassword: "oldpass123",
        newPassword: "newpass123",
        confirmPassword: "newpass123",
      }),
      params: {},
    } as any);
    expect(mocks.changePassword).toHaveBeenCalledWith({
      currentPassword: "oldpass123",
      newPassword: "newpass123",
    });
    expect((result as any).success).toBe(true);
    expect((result as any).message).toMatch(/password updated/i);
  });

  it("handles API error with nested message", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.changePassword.mockRejectedValue({
      response: { data: { message: "Wrong current password" } },
    });
    const result = await clientAction({
      request: makeFormReq({
        intent: "change-password",
        currentPassword: "wrong",
        newPassword: "newpass123",
        confirmPassword: "newpass123",
      }),
      params: {},
    } as any);
    expect((result as any).error).toBe("Wrong current password");
  });
});

/* ================================================================== */
/*  clientAction — delete-account                                      */
/* ================================================================== */
describe("clientAction — delete-account", () => {
  it("rejects missing DELETE confirmation", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({
        intent: "delete-account",
        deleteConfirmation: "nope",
      }),
      params: {},
    } as any);
    expect((result as any).error).toMatch(/type DELETE/i);
  });

  it("accepts case-insensitive DELETE", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.deleteAccount.mockResolvedValue({});
    const result = await clientAction({
      request: makeFormReq({
        intent: "delete-account",
        deleteConfirmation: "delete",
      }),
      params: {},
    } as any);
    expect((result as any).success).toBe(true);
    expect(mocks.deleteAccount).toHaveBeenCalled();
  });

  it("handles API error on delete", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.deleteAccount.mockRejectedValue(new Error("boom"));
    const result = await clientAction({
      request: makeFormReq({
        intent: "delete-account",
        deleteConfirmation: "DELETE",
      }),
      params: {},
    } as any);
    expect((result as any).success).toBe(false);
    expect((result as any).error).toMatch(/failed to delete/i);
  });
});

/* ================================================================== */
/*  clientAction — update-profile                                      */
/* ================================================================== */
describe("clientAction — update-profile", () => {
  it("rejects invalid profile data (firstName too short)", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({
        intent: "update-profile",
        firstName: "X",
        email: "a@b.com",
      }),
      params: {},
    } as any);
    expect((result as any).success).toBe(false);
    expect((result as any).error).toMatch(/at least 2 characters/i);
  });

  it("rejects invalid email", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({
        intent: "update-profile",
        firstName: "John",
        email: "notanemail",
      }),
      params: {},
    } as any);
    expect((result as any).success).toBe(false);
    expect((result as any).error).toMatch(/invalid email/i);
  });

  it("calls updateCurrentUser on valid data", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.updateCurrentUser.mockResolvedValue({ ...fullUser });
    const result = await clientAction({
      request: makeFormReq({
        intent: "update-profile",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phoneNumber: "+9771234567890",
      }),
      params: {},
    } as any);
    expect((result as any).success).toBe(true);
    expect((result as any).message).toMatch(/profile updated/i);
    expect(mocks.updateCurrentUser).toHaveBeenCalledWith({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phoneNumber: "+9771234567890",
    });
  });

  it("handles API error on profile update", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.updateCurrentUser.mockRejectedValue({
      response: { data: { message: "Email already taken" } },
    });
    const result = await clientAction({
      request: makeFormReq({
        intent: "update-profile",
        firstName: "John",
        email: "taken@example.com",
      }),
      params: {},
    } as any);
    expect((result as any).error).toBe("Email already taken");
  });
});

/* ================================================================== */
/*  Component render                                                   */
/* ================================================================== */
describe("ProfileSettings component", () => {
  it("renders profile settings page", () => {
    mocks.useLoaderData.mockReturnValue({ user: fullUser });
    mocks.useActionData.mockReturnValue(null);
    render(<ProfileSettings />);
    expect(screen.getByText("Profile Settings")).toBeTruthy();
  });
});
