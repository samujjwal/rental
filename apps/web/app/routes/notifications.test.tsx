import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError } from "axios";

/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
vi.mock("lucide-react", () => ({
  Bell: IconStub,
  Check: IconStub,
  CheckCheck: IconStub,
  Trash2: IconStub,
  Calendar: IconStub,
  Banknote: IconStub,
  MessageCircle: IconStub,
  Star: IconStub,
  AlertTriangle: IconStub,
  Shield: IconStub,
  Megaphone: IconStub,
  Package: IconStub,
  Settings: IconStub,
}));

/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  redirect: vi.fn(
    (url: string) =>
      new Response(null, { status: 302, headers: { Location: url } })
  ),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn() })),
};

vi.mock("react-router", () => ({
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => ({
    notifications: [],
    totalPages: 1,
    page: 1,
    unreadCount: 0,
    error: null,
  }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useRevalidator: () => mocks.useRevalidator(),
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/notifications", () => ({
  notificationsApi: {
    getNotifications: (...a: any[]) => mocks.getNotifications(...a),
    getUnreadCount: (...a: any[]) => mocks.getUnreadCount(...a),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  },
}));
vi.mock("date-fns", () => ({ format: () => "2024-01-01" }));
vi.mock("~/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/lib/utils", () => ({
  cn: (...a: string[]) => a.filter(Boolean).join(" "),
}));
vi.mock("~/components/ui", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
  UnifiedButton: ({ children, ...p }: any) => (
    <button {...p}>{children}</button>
  ),
  Pagination: () => <nav />,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/components/ui/empty-state", () => ({
  EmptyStatePresets: {
    NoNotificationsFiltered: () => <div data-testid="empty-notifications-filtered" />,
  },
}));
vi.mock("~/components/ui/skeleton", () => ({ Skeleton: () => <div /> }));
vi.mock("~/components/layout", () => ({
  PortalPageLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("~/config/navigation", () => ({
  getPortalNavSections: () => [],
  resolvePortalNavRole: () => "renter",
}));

import {
  clientLoader,
  getNotificationsActionError,
  getNotificationsLoadError,
} from "./notifications";

const authUser = { id: "u1", role: "renter" };

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

describe("clientLoader", () => {
  it("redirects unauthenticated", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request("http://localhost/notifications"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("loads notifications and unread count", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getNotifications.mockResolvedValue({
      notifications: [{ id: "n1", message: "Hello" }],
      total: 1,
    });
    mocks.getUnreadCount.mockResolvedValue(3);

    const r = (await clientLoader({
      request: new Request("http://localhost/notifications"),
    } as any)) as any;
    expect(r.notifications).toHaveLength(1);
    expect(r.unreadCount).toBe(3);
    expect(r.error).toBeNull();
  });

  it("handles unreadCount as {count} object", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getNotifications.mockResolvedValue({ notifications: [], total: 0 });
    mocks.getUnreadCount.mockResolvedValue({ count: 7 });

    const r = (await clientLoader({
      request: new Request("http://localhost/notifications"),
    } as any)) as any;
    expect(r.unreadCount).toBe(7);
  });

  it("passes page, type, and unread filters", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getNotifications.mockResolvedValue({ notifications: [], total: 0 });
    mocks.getUnreadCount.mockResolvedValue(0);

    await clientLoader({
      request: new Request(
        "http://localhost/notifications?page=3&type=BOOKING&unread=true"
      ),
    } as any);
    expect(mocks.getNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 3,
        limit: 15,
        type: "BOOKING",
        unreadOnly: true,
      })
    );
  });

  it("clamps page ≥ 1", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getNotifications.mockResolvedValue({ notifications: [], total: 0 });
    mocks.getUnreadCount.mockResolvedValue(0);

    await clientLoader({
      request: new Request("http://localhost/notifications?page=-5"),
    } as any);
    expect(mocks.getNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    );
  });

  it("returns empty state on API error", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getNotifications.mockRejectedValue(new Error("fail"));
    mocks.getUnreadCount.mockRejectedValue(new Error("fail"));

    const r = (await clientLoader({
      request: new Request("http://localhost/notifications"),
    } as any)) as any;
    expect(r.notifications).toEqual([]);
    expect(r.unreadCount).toBe(0);
    expect(r.error).toBeTruthy();
  });

  it("returns actionable offline loader copy", async () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getNotifications.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const r = (await clientLoader({
      request: new Request("http://localhost/notifications"),
    } as any)) as any;

    expect(r.error).toBe("You appear to be offline. Reconnect and try again.");

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: previousOnline,
    });
  });

  it("returns timeout-specific loader copy", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getNotifications.mockRejectedValue(
      new AxiosError("timeout", "ECONNABORTED")
    );

    const r = (await clientLoader({
      request: new Request("http://localhost/notifications"),
    } as any)) as any;

    expect(r.error).toBe("Loading notifications timed out. Try again.");
  });
});

describe("notifications error helpers", () => {
  it("preserves backend action messages", () => {
    expect(
      getNotificationsActionError(
        { response: { data: { message: "Notification already deleted" } } },
        "fallback"
      )
    ).toBe("Notification already deleted");
  });

  it("returns actionable offline copy for action failures", () => {
    const previousOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    expect(getNotificationsActionError(new AxiosError("Network Error", "ERR_NETWORK"), "fallback")).toBe(
      "You appear to be offline. Reconnect and try again."
    );

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: previousOnline,
    });
  });

  it("returns timeout-specific copy for action failures", () => {
    expect(
      getNotificationsActionError(
        new AxiosError("timeout", "ECONNABORTED"),
        "fallback"
      )
    ).toBe("The notification request timed out. Try again.");
  });

  it("keeps plain thrown load errors when provided", () => {
    expect(getNotificationsLoadError(new Error("notifications unavailable"))).toBe(
      "notifications unavailable"
    );
  });

  it("returns timeout-specific copy for load helper", () => {
    expect(getNotificationsLoadError(new AxiosError("timeout", "ECONNABORTED"))).toBe(
      "Loading notifications timed out. Try again."
    );
  });
});
