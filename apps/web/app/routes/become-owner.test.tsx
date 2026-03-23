import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  Banknote: IconStub, TrendingUp: IconStub, Users: IconStub, Shield: IconStub,
  CheckCircle: IconStub, Star: IconStub, Package: IconStub, Calendar: IconStub,
  ArrowRight: IconStub, Loader2: IconStub,
}));

/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  upgradeToOwner: vi.fn(),
  updateUser: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
};

vi.mock("react-router", () => ({
  Form: ({ children, ...p }: any) => <form {...p}>{children}</form>,
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
  redirect: (...a: any[]) => mocks.redirect(...a),
  useActionData: () => null,
  useNavigation: () => ({ state: "idle" }),
}));
vi.mock("~/utils/auth", () => ({ getUser: (...a: any[]) => mocks.getUser(...a) }));
vi.mock("~/lib/api/users", () => ({
  usersApi: { upgradeToOwner: (...a: any[]) => mocks.upgradeToOwner(...a) },
}));
vi.mock("~/lib/store/auth", () => {
  const state = {
    user: { id: "u1", role: "renter" },
    isAuthenticated: true,
    updateUser: (...a: any[]) => mocks.updateUser(...a),
  };
  const useAuthStore: any = (sel?: (s: any) => any) => sel ? sel(state) : state;
  useAuthStore.getState = () => state;
  return { useAuthStore };
});
vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

function makeFormReq(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

import { clientAction, getBecomeOwnerError } from "./become-owner";

const authUser = { id: "u1", role: "renter" };

beforeEach(() => vi.clearAllMocks());

describe("clientAction", () => {
  it("redirects unauthenticated", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientAction({ request: makeFormReq({ intent: "upgrade-owner" }) } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("returns already-owner message for existing owners", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const r = await clientAction({ request: makeFormReq({ intent: "upgrade-owner", agreement: "true" }) } as any);
    expect((r as any).success).toBe(true);
    expect((r as any).message).toMatch(/already/i);
  });

  it("rejects wrong intent", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({ request: makeFormReq({ intent: "hack" }) } as any);
    expect((r as any).success).toBe(false);
  });

  it("rejects missing agreement", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({ request: makeFormReq({ intent: "upgrade-owner" }) } as any);
    expect((r as any).success).toBe(false);
    expect((r as any).message).toMatch(/accept the terms/i);
  });

  it("upgrades to owner successfully", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.upgradeToOwner.mockResolvedValue({ id: "u1", role: "owner" });
    const r = await clientAction({
      request: makeFormReq({ intent: "upgrade-owner", agreement: "true" }),
    } as any);
    expect((r as any).success).toBe(true);
    expect(mocks.upgradeToOwner).toHaveBeenCalled();
  });

  it("handles API error", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.upgradeToOwner.mockRejectedValue(new Error("Server error"));
    const r = await clientAction({
      request: makeFormReq({ intent: "upgrade-owner", agreement: "true" }),
    } as any);
    expect((r as any).success).toBe(false);
  });

  it("uses actionable offline copy when upgrade fails offline", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mocks.getUser.mockResolvedValue(authUser);
    mocks.upgradeToOwner.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const r = await clientAction({
      request: makeFormReq({ intent: "upgrade-owner", agreement: "true" }),
    } as any);

    expect((r as any).success).toBe(false);
    expect((r as any).message).toBe("You appear to be offline. Reconnect and try again.");

    Object.defineProperty(navigator, "onLine", { configurable: true, value: previousOnline });
  });

  it("uses timeout-specific copy when the owner upgrade stalls", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.upgradeToOwner.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const r = await clientAction({
      request: makeFormReq({ intent: "upgrade-owner", agreement: "true" }),
    } as any);

    expect((r as any).success).toBe(false);
    expect((r as any).message).toBe("Upgrade request timed out. Try again.");
  });

  it("preserves plain thrown error messages in helper", () => {
    expect(getBecomeOwnerError(new Error("upgrade unavailable"))).toBe("upgrade unavailable");
  });
});
