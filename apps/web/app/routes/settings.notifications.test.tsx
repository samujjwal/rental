import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/* ------------------------------------------------------------------ */
/*  lucide-react — explicit named exports (NO Proxy)                  */
/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
vi.mock("lucide-react", () => ({
  Bell: IconStub,
  Check: IconStub,
  Settings: IconStub,
  User: IconStub,
  Shield: IconStub,
  CreditCard: IconStub,
}));

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  redirect: vi.fn((url: string) => {
    return new Response(null, { status: 302, headers: { Location: url } });
  }),
  useLoaderData: vi.fn(),
  useActionData: vi.fn(),
  useNavigation: vi.fn(() => ({ state: "idle" })),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn() })),
};

vi.mock("react-router", () => ({
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => mocks.useLoaderData(),
  useActionData: () => mocks.useActionData(),
  useNavigation: () => mocks.useNavigation(),
  useRevalidator: () => mocks.useRevalidator(),
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/notifications", () => ({
  notificationsApi: {
    getPreferences: (...a: any[]) => mocks.getPreferences(...a),
    updatePreferences: (...a: any[]) => mocks.updatePreferences(...a),
  },
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  UnifiedButton: ({ children, loading, ...p }: any) => (
    <button {...p}>{loading ? <span data-testid="loading-spinner" /> : null}{children}</button>
  ),
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
/*  Import route under test                                            */
/* ------------------------------------------------------------------ */
import { clientLoader, clientAction, getSettingsNotificationsError } from "./settings.notifications";
import NotificationSettings from "./settings.notifications";

const authUser = { id: "u1", email: "u@test.com", role: "renter" };
const defaultPrefs = {
  email: true,
  sms: false,
  push: true,
  inApp: true,
  bookingUpdates: true,
  paymentUpdates: true,
  reviewAlerts: true,
  messageAlerts: true,
  marketingEmails: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("clientLoader", () => {
  it("redirects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const result = await clientLoader({
      request: new Request("http://localhost/settings/notifications"),
      params: {},
    } as any);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("returns preferences from API", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getPreferences.mockResolvedValue({ ...defaultPrefs, sms: true });
    const result = await clientLoader({
      request: new Request("http://localhost/settings/notifications"),
      params: {},
    } as any);
    expect(result).toEqual({
      preferences: { ...defaultPrefs, sms: true },
      error: null,
    });
  });

  it("returns default preferences on API error", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getPreferences.mockRejectedValue(new Error("Network error"));
    const result = await clientLoader({
      request: new Request("http://localhost/settings/notifications"),
      params: {},
    } as any);
    expect((result as any).preferences).toEqual(defaultPrefs);
    expect((result as any).error).toBeTruthy();
  });

  it("uses actionable offline copy on loader failure", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getPreferences.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const result = await clientLoader({
      request: new Request("http://localhost/settings/notifications"),
      params: {},
    } as any);

    expect((result as any).error).toBe("You appear to be offline. Reconnect and try again.");

    Object.defineProperty(navigator, "onLine", { configurable: true, value: previousOnline });
  });

  it("uses timeout-specific copy on loader failure", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getPreferences.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const result = await clientLoader({
      request: new Request("http://localhost/settings/notifications"),
      params: {},
    } as any);

    expect((result as any).error).toBe("Saving preferences timed out. Try again.");
  });
});

/* ================================================================== */
/*  clientAction                                                       */
/* ================================================================== */
describe("clientAction", () => {
  it("redirects unauthenticated action", async () => {
    mocks.getUser.mockResolvedValue(null);
    const result = await clientAction({
      request: makeFormReq({ intent: "save" }),
      params: {},
    } as any);
    expect(result).toBeInstanceOf(Response);
  });

  it("rejects invalid intent", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({ intent: "hack" }),
      params: {},
    } as any);
    expect(result).toEqual({ success: false, message: "Invalid action" });
  });

  it("rejects missing preferences field", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({ intent: "save" }),
      params: {},
    } as any);
    expect((result as any).message).toMatch(/invalid preferences/i);
  });

  it("rejects oversized preferences payload", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({
        intent: "save",
        preferences: "x".repeat(21000),
      }),
      params: {},
    } as any);
    expect((result as any).message).toMatch(/too large/i);
  });

  it("rejects invalid JSON in preferences", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const result = await clientAction({
      request: makeFormReq({ intent: "save", preferences: "not-json{" }),
      params: {},
    } as any);
    expect((result as any).message).toMatch(/invalid preferences/i);
  });

  it("normalizes boolean prefs and calls updatePreferences", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.updatePreferences.mockResolvedValue({});
    const prefs = { email: false, sms: true, push: 0, inApp: 1 };
    const result = await clientAction({
      request: makeFormReq({
        intent: "save",
        preferences: JSON.stringify(prefs),
      }),
      params: {},
    } as any);
    expect(result).toEqual({
      success: true,
      message: "Preferences updated successfully",
    });
    const sentPrefs = mocks.updatePreferences.mock.calls[0][0];
    expect(sentPrefs.email).toBe(false);
    expect(sentPrefs.sms).toBe(true);
    expect(sentPrefs.push).toBe(false); // Boolean(0)
    expect(sentPrefs.inApp).toBe(true); // Boolean(1)
    // defaults for missing fields
    expect(sentPrefs.bookingUpdates).toBe(true);
    expect(sentPrefs.marketingEmails).toBe(false);
  });

  it("handles API error", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.updatePreferences.mockRejectedValue({
      response: { data: { message: "Server down" } },
    });
    const result = await clientAction({
      request: makeFormReq({
        intent: "save",
        preferences: JSON.stringify(defaultPrefs),
      }),
      params: {},
    } as any);
    expect((result as any).success).toBe(false);
    expect((result as any).message).toBe("Server down");
  });

  it("uses actionable offline copy on save failure", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mocks.getUser.mockResolvedValue(authUser);
    mocks.updatePreferences.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const result = await clientAction({
      request: makeFormReq({
        intent: "save",
        preferences: JSON.stringify(defaultPrefs),
      }),
      params: {},
    } as any);

    expect((result as any).success).toBe(false);
    expect((result as any).message).toBe("You appear to be offline. Reconnect and try again.");

    Object.defineProperty(navigator, "onLine", { configurable: true, value: previousOnline });
  });

  it("uses timeout-specific copy on save failure", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.updatePreferences.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const result = await clientAction({
      request: makeFormReq({
        intent: "save",
        preferences: JSON.stringify(defaultPrefs),
      }),
      params: {},
    } as any);

    expect((result as any).success).toBe(false);
    expect((result as any).message).toBe("Saving preferences timed out. Try again.");
  });

  it("uses conflict-specific copy on save failure without a backend message", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.updatePreferences.mockRejectedValue(new AxiosError("Conflict", undefined, undefined, undefined, {
      status: 409,
      statusText: "Conflict",
      headers: {},
      config: { headers: {} } as any,
      data: {},
    } as any));

    const result = await clientAction({
      request: makeFormReq({
        intent: "save",
        preferences: JSON.stringify(defaultPrefs),
      }),
      params: {},
    } as any);

    expect((result as any).success).toBe(false);
    expect((result as any).message).toBe(
      "Your notification settings changed elsewhere. Refresh and try again."
    );
  });

  it("preserves backend response messages in helper", () => {
    expect(
      getSettingsNotificationsError({ response: { data: { message: "Validation failed" } } }, "fallback")
    ).toBe("Validation failed");
  });
});

/* ================================================================== */
/*  Component render                                                   */
/* ================================================================== */
describe("NotificationSettings component", () => {
  it("renders notification preferences page", () => {
    mocks.useLoaderData.mockReturnValue({
      preferences: defaultPrefs,
      error: null,
    });
    mocks.useActionData.mockReturnValue(null);
    render(<NotificationSettings />);
    expect(screen.getByText("Notification Preferences")).toBeTruthy();
  });
});
