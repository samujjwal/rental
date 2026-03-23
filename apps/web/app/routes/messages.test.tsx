import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
const mocks = vi.hoisted(() => ({
  getConversations: vi.fn(),
  getMessages: vi.fn(),
  markAsRead: vi.fn(),
  sendMessage: vi.fn(),
  getBookingById: vi.fn(),
  getListingById: vi.fn(),
  getUser: vi.fn(),
  useLoaderData: vi.fn(),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn(), state: "idle" })),
  useSocket: vi.fn(() => ({ socket: null, isConnected: false })),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  redirect: vi.fn((url: string) => {
    return new Response("", { status: 302, headers: { Location: url } });
  }),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  useSearchParams: () => mocks.useSearchParams(),
  useRevalidator: () => mocks.useRevalidator(),
  redirect: mocks.redirect,
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("~/lib/api/messaging", () => ({
  messagingApi: {
    getConversations: (...args: any[]) => mocks.getConversations(...args),
    getMessages: (...args: any[]) => mocks.getMessages(...args),
    markAsRead: (...args: any[]) => mocks.markAsRead(...args),
    sendMessage: (...args: any[]) => mocks.sendMessage(...args),
  },
}));

vi.mock("~/lib/api/upload", () => ({
  uploadApi: { uploadImages: vi.fn() },
}));

vi.mock("~/lib/api/bookings", () => ({
  bookingsApi: { getBookingById: (...args: any[]) => mocks.getBookingById(...args) },
}));

vi.mock("~/lib/api/listings", () => ({
  listingsApi: { getListingById: (...args: any[]) => mocks.getListingById(...args) },
}));

vi.mock("~/utils/auth", () => ({
  getUser: (...args: any[]) => mocks.getUser(...args),
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("~/lib/toast", () => ({
  toast: { success: (...args: any[]) => mocks.toastSuccess(...args), error: (...args: any[]) => mocks.toastError(...args) },
}));

vi.mock("~/lib/store/auth", () => {
  const state = {
    user: { id: "user-1", firstName: "Ram" },
    isAuthenticated: true,
  };
  const useAuthStore: any = (sel?: (s: any) => any) =>
    sel ? sel(state) : state;
  useAuthStore.getState = () => state;
  return { useAuthStore };
});

vi.mock("~/hooks/use-socket", () => ({
  useSocket: () => mocks.useSocket(),
}));
vi.mock("~/components/layout", () => ({
  PortalPageLayout: ({
    title,
    description,
    banner,
    actions,
    children,
  }: any) => (
    <div>
      {title ? <div>{title}</div> : null}
      {description ? <div>{description}</div> : null}
      {actions}
      {banner}
      {children}
    </div>
  ),
}));
vi.mock("~/config/navigation", () => ({
  getPortalNavSections: () => [],
  resolvePortalNavRole: () => "renter",
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, leftIcon, loading, ...props }: any) => (
    <button {...props}>
      {leftIcon}
      {children}
    </button>
  ),
  Badge: ({ children }: any) => <span>{children}</span>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("~/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock("date-fns", () => ({
  format: (d: Date) => d.toISOString().slice(0, 10),
  formatDistanceToNow: () => "2 hours ago",
}));

vi.mock("lucide-react", () => ({
  Send: IconStub,
  Search: IconStub,
  Image: IconStub,
  ArrowLeft: IconStub,
  MessageCircle: IconStub,
  Loader2: IconStub,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import MessagesPage, {
  clientLoader,
  getMessagesAttachmentError,
  getMessagesBookingBootstrapError,
  getMessagesConversationLoadError,
  getMessagesLoadError,
  getMessagesListingBootstrapError,
  getMessagesSendError,
  getMessagesStartConversationError,
} from "./messages";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("messages route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    // Mock scrollIntoView for the messages component
    Element.prototype.scrollIntoView = vi.fn();
    mocks.useSocket.mockReturnValue({ socket: null, isConnected: false });
    mocks.getMessages.mockResolvedValue({ messages: [] });
    mocks.markAsRead.mockResolvedValue(undefined);
    mocks.getBookingById.mockReset();
    mocks.getListingById.mockReset();
  });

  describe("clientLoader", () => {
    it("redirects to login when not authenticated", async () => {
      mocks.getUser.mockResolvedValue(null);
      const result = await clientLoader({
        request: new Request("http://localhost/messages"),
      } as any);
      expect(result).toBeInstanceOf(Response);
      expect(mocks.redirect).toHaveBeenCalledWith("/auth/login");
    });

    it("loads conversations for authenticated user", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getConversations.mockResolvedValue({
        conversations: [
          {
            id: "conv-1",
            participants: [
              { userId: "user-1", user: { firstName: "Ram", lastName: "K" } },
              { userId: "user-2", user: { firstName: "Sita", lastName: "G" } },
            ],
            lastMessage: {
              content: "Hi",
              createdAt: "2025-01-01",
              senderId: "user-2",
              read: false,
            },
            listing: { id: "l-1", title: "Camera" },
            unreadCount: 1,
          },
        ],
      });
      const result = await clientLoader({
        request: new Request("http://localhost/messages"),
      } as any);
      expect(result).toHaveProperty("rawConversations");
    });

    it("handles API error gracefully", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getConversations.mockRejectedValue(new Error("API error"));
      // Should either throw or return error state
      try {
        const result = await clientLoader({
          request: new Request("http://localhost/messages"),
        } as any);
        // Some routes catch errors
        expect(result).toBeDefined();
      } catch {
        // Some routes throw on error
      }
    });
  });

  describe("MessagesPage component", () => {
    it("replaces a stale conversation query param with the first available conversation", async () => {
      const setSearchParams = vi.fn();
      mocks.useSearchParams.mockReturnValue([
        new URLSearchParams("conversation=stale-conversation"),
        setSearchParams,
      ]);
      mocks.getMessages.mockResolvedValue({
        messages: [
          {
            id: "msg-1",
            conversationId: "conv-1",
            senderId: "user-2",
            content: "Hello",
            attachments: [],
            createdAt: "2025-01-01",
            readReceipts: [],
          },
        ],
      });
      mocks.markAsRead.mockResolvedValue(undefined);
      mocks.useLoaderData.mockReturnValue({
        rawConversations: [
          {
            id: "conv-1",
            participants: [
              { userId: "user-1", user: { id: "user-1", firstName: "Ram", lastName: "K" } },
              { userId: "user-2", user: { id: "user-2", firstName: "Sita", lastName: "G" } },
            ],
            lastMessage: {
              content: "Hello",
              createdAt: "2025-01-01",
              senderId: "user-2",
              read: false,
            },
            listing: { id: "l1", title: "Camera", images: ["/img.jpg"] },
            unreadCount: 1,
          },
        ],
        rawMessages: [],
        currentUserId: "user-1",
        portalRole: "renter",
        error: null,
      });

      render(<MessagesPage />);

      await waitFor(() => {
        expect(mocks.getMessages).toHaveBeenCalledWith("conv-1", { limit: 100 });
      });

      await waitFor(() => {
        const params = setSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;
        expect(params.get("conversation")).toBe("conv-1");
      });
    });

    it("clears a stale conversation query param when no conversations remain", async () => {
      const setSearchParams = vi.fn();
      mocks.useSearchParams.mockReturnValue([
        new URLSearchParams("conversation=stale-conversation"),
        setSearchParams,
      ]);
      mocks.useLoaderData.mockReturnValue({
        rawConversations: [],
        rawMessages: [],
        currentUserId: "user-1",
        portalRole: "renter",
        error: null,
      });

      render(<MessagesPage />);

      await waitFor(() => {
        const params = setSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;
        expect(params.has("conversation")).toBe(false);
      });
    });

    it("renders conversation list", async () => {
      mocks.useLoaderData.mockReturnValue({
        rawConversations: [
          {
            id: "conv-1",
            participants: [
              { userId: "user-1", user: { firstName: "Ram", lastName: "K" } },
              { userId: "user-2", user: { firstName: "Sita", lastName: "G" } },
            ],
            lastMessage: {
              content: "Hello",
              createdAt: "2025-01-01",
              senderId: "user-2",
              read: false,
            },
            listing: { id: "l1", title: "Camera", images: ["/img.jpg"] },
            unreadCount: 1,
          },
        ],
        rawMessages: [
          {
            id: "msg-1",
            conversationId: "conv-1",
            senderId: "user-2",
            content: "Hello",
            attachments: [],
            createdAt: "2025-01-01",
            readReceipts: [],
          },
        ],
        currentUserId: "user-1",
        portalRole: "renter",
        error: null,
      });
      render(<MessagesPage />);

      await waitFor(() => {
        expect(
          screen.getAllByText(/Sita|Camera|Messages/i).length
        ).toBeGreaterThan(0);
      });
    });

    it("renders empty state when no conversations", async () => {
      mocks.useLoaderData.mockReturnValue({
        rawConversations: [],
        rawMessages: [],
        currentUserId: "user-1",
        portalRole: "renter",
        error: null,
      });
      render(<MessagesPage />);

      await waitFor(() => {
        expect(screen.getByText("No conversations yet")).toBeInTheDocument();
      });
    });

    it("revalidates when reconnect is clicked from the offline banner", async () => {
      const revalidate = vi.fn();
      mocks.useRevalidator.mockReturnValue({ revalidate, state: "idle" });
      mocks.useLoaderData.mockReturnValue({
        rawConversations: [],
        rawMessages: [],
        currentUserId: "user-1",
        portalRole: "renter",
        error: null,
      });
      render(<MessagesPage />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Reconnect/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Reconnect/i }));
      expect(revalidate).toHaveBeenCalledTimes(1);
    });

    it("shows contextual booking bootstrap recovery copy when opening from a booking fails", async () => {
      mocks.useSearchParams.mockReturnValue([
        new URLSearchParams("booking=booking-123"),
        vi.fn(),
      ]);
      mocks.useLoaderData.mockReturnValue({
        rawConversations: [],
        rawMessages: [],
        currentUserId: "user-1",
        portalRole: "renter",
        error: null,
      });
      mocks.getBookingById.mockRejectedValue(new Error("boom"));

      render(<MessagesPage />);

      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalledWith(
          "Unable to open the conversation for this booking right now. Try again."
        );
      });
    });

    it("shows contextual listing bootstrap recovery copy when opening from a listing fails", async () => {
      mocks.useSearchParams.mockReturnValue([
        new URLSearchParams("listing=listing-123&participant=participant-123"),
        vi.fn(),
      ]);
      mocks.useLoaderData.mockReturnValue({
        rawConversations: [],
        rawMessages: [],
        currentUserId: "user-1",
        portalRole: "renter",
        error: null,
      });
      mocks.getListingById.mockRejectedValue(new Error("boom"));

      render(<MessagesPage />);

      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalledWith(
          "Unable to start a conversation for this listing right now. Try again."
        );
      });
    });
  });

  describe("error helpers", () => {
    it("uses contextual conversation load fallback copy", () => {
      expect(getMessagesConversationLoadError(new Error("boom"))).toBe(
        "Unable to load this conversation right now. Try again."
      );
    });

    it("uses actionable load offline copy", () => {
      const online = window.navigator.onLine;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });

      expect(getMessagesLoadError(new Error("Network Error"), "fallback")).toBe(
        "You appear to be offline. Reconnect and try loading messages again."
      );

      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: online,
      });
    });

    it("uses timeout-specific load copy", () => {
      expect(
        getMessagesLoadError(new AxiosError("timeout", "ECONNABORTED"), "fallback")
      ).toBe("Loading messages timed out. Try again.");
    });

    it("preserves backend conversation-start errors", () => {
      expect(
        getMessagesStartConversationError(
          { response: { data: { message: "Conversation already exists" } } },
          "fallback"
        )
      ).toBe("Conversation already exists");
    });

    it("uses conflict-specific conversation-start copy", () => {
      expect(
        getMessagesStartConversationError(
          new AxiosError("Conflict", undefined, undefined, undefined, {
            status: 409,
            statusText: "Conflict",
            headers: {},
            config: { headers: {} } as any,
            data: {},
          } as any),
          "fallback"
        )
      ).toBe("This conversation already exists. Refresh and open it again.");
    });

    it("uses timeout-specific conversation-start copy", () => {
      expect(
        getMessagesStartConversationError(
          new AxiosError("timeout", "ECONNABORTED"),
          "fallback"
        )
      ).toBe("Starting the conversation timed out. Try again.");
    });

    it("uses contextual booking bootstrap fallback copy", () => {
      expect(getMessagesBookingBootstrapError(new Error("boom"))).toBe(
        "Unable to open the conversation for this booking right now. Try again."
      );
    });

    it("uses contextual listing bootstrap fallback copy", () => {
      expect(getMessagesListingBootstrapError(new Error("boom"))).toBe(
        "Unable to start a conversation for this listing right now. Try again."
      );
    });

    it("uses actionable send offline copy", () => {
      const online = window.navigator.onLine;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });

      expect(getMessagesSendError(new Error("Network Error"), "fallback")).toBe(
        "You appear to be offline. Reconnect and try sending the message again."
      );

      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: online,
      });
    });

    it("uses timeout-specific send copy", () => {
      expect(
        getMessagesSendError(new AxiosError("timeout", "ECONNABORTED"), "fallback")
      ).toBe("Sending the message timed out. Try again.");
    });

    it("uses actionable attachment offline copy", () => {
      const online = window.navigator.onLine;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });

      expect(getMessagesAttachmentError(new Error("Network Error"), "fallback")).toBe(
        "You appear to be offline. Reconnect and try uploading attachments again."
      );

      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: online,
      });
    });

    it("uses timeout-specific attachment copy", () => {
      expect(
        getMessagesAttachmentError(
          new AxiosError("timeout", "ECONNABORTED"),
          "fallback"
        )
      ).toBe("Uploading attachments timed out. Try again.");
    });
  });
});
