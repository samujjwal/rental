import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const IconStub = vi.hoisted(() => (props: any) => (
  <span data-testid="icon-stub" />
));
const mocks = vi.hoisted(() => ({
  getMyBookings: vi.fn(),
  getOwnerBookings: vi.fn(),
  getAvailableTransitions: vi.fn(),
  getUser: vi.fn(),
  useLoaderData: vi.fn(),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  useNavigation: vi.fn(() => ({ state: "idle" })),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn(), state: "idle" })),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  redirect: vi.fn((url: string) => {
    return new Response(null, { status: 302, headers: { Location: url } });
  }),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  useSearchParams: () => mocks.useSearchParams(),
  useNavigation: () => mocks.useNavigation(),
  useRevalidator: () => mocks.useRevalidator(),
  redirect: mocks.redirect,
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
}));

vi.mock("~/lib/api/bookings", () => ({
  bookingsApi: {
    getMyBookings: (...args: any[]) => mocks.getMyBookings(...args),
    getOwnerBookings: (...args: any[]) => mocks.getOwnerBookings(...args),
    getAvailableTransitions: (...args: any[]) =>
      mocks.getAvailableTransitions(...args),
  },
}));

vi.mock("~/lib/shared-types", () => ({
  BookingStatus: {
    PENDING: "PENDING",
    PENDING_OWNER_APPROVAL: "PENDING_OWNER_APPROVAL",
    PENDING_PAYMENT: "PENDING_PAYMENT",
    CONFIRMED: "CONFIRMED",
    IN_PROGRESS: "IN_PROGRESS",
    AWAITING_RETURN_INSPECTION: "AWAITING_RETURN_INSPECTION",
    COMPLETED: "COMPLETED",
    SETTLED: "SETTLED",
    CANCELLED: "CANCELLED",
    DISPUTED: "DISPUTED",
    PAYMENT_FAILED: "PAYMENT_FAILED",
  },
}));

vi.mock("~/utils/auth", () => ({
  getUser: (...args: any[]) => mocks.getUser(...args),
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  formatCurrency: (v: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "NPR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(v),
}));

vi.mock("~/lib/toast", () => ({
  toast: {
    success: (...args: any[]) => mocks.toastSuccess(...args),
    error: (...args: any[]) => mocks.toastError(...args),
  },
}));

vi.mock("date-fns", () => ({
  format: (d: Date, p: string) => "Jan 1, 2025",
}));

vi.mock("~/components/ui", () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  BookingCardSkeleton: () => <div data-testid="booking-skeleton" />,
  EmptyStatePresets: {
    NoBookings: () => <div data-testid="empty">No bookings yet</div>,
    noBookings: () => <div data-testid="empty">No bookings yet</div>,
  },
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  Alert: ({ children, title, message }: any) => (
    <div role="alert">
      {title}
      {message}
      {children}
    </div>
  ),
  UnifiedButton: ({ children, leftIcon, loading, ...props }: any) => (
    <button {...props}>
      {leftIcon}
      {children}
    </button>
  ),
  Pagination: () => <div data-testid="pagination" />,
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogFooter: ({ children }: any) => <div>{children}</div>,
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

vi.mock("lucide-react", () => ({
  Calendar: IconStub,
  Package: IconStub,
  Clock: IconStub,
  Banknote: IconStub,
  MessageSquare: IconStub,
  X: IconStub,
  CheckCircle: IconStub,
  AlertCircle: IconStub,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import BookingsPage, {
  clientLoader,
  getBookingsActionError,
  getBookingsLoadError,
  getBookingsUnavailableActionError,
} from "./bookings";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    status: "CONFIRMED",
    startDate: "2025-01-15",
    endDate: "2025-01-20",
    totalAmount: 5000,
    ownerId: "owner-1",
    renterId: "user-1",
    listing: {
      id: "l-1",
      title: "Camera",
      images: ["img.jpg"],
      location: { city: "Kathmandu" },
    },
    renter: { firstName: "Ram", lastName: "K" },
    owner: { firstName: "Sita", lastName: "G" },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("bookings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAvailableTransitions.mockResolvedValue({ availableTransitions: [] });
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  describe("clientLoader", () => {
    it("redirects to login when not authenticated", async () => {
      mocks.getUser.mockResolvedValue(null);
      const result = await clientLoader({
        request: new Request("http://localhost/bookings"),
      } as any) as any;
      expect(result).toBeInstanceOf(Response);
    });

    it("loads renter bookings by default", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getMyBookings.mockResolvedValue([makeBooking()]);
      mocks.getAvailableTransitions.mockResolvedValue({
        availableTransitions: ["CANCEL"],
      });
      const result = await clientLoader({
        request: new Request("http://localhost/bookings"),
      } as any) as any;
      expect(result.bookings).toHaveLength(1);
      expect(result.view).toBe("renter");
      expect(mocks.getMyBookings).toHaveBeenCalled();
      expect(result.bookings[0].availableTransitions).toEqual(["CANCEL"]);
    });

    it("loads owner bookings for owner view", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getOwnerBookings.mockResolvedValue([makeBooking()]);
      mocks.getAvailableTransitions.mockResolvedValue({
        availableTransitions: ["OWNER_APPROVE"],
      });
      const result = await clientLoader({
        request: new Request("http://localhost/bookings?view=owner"),
      } as any) as any;
      expect(result.view).toBe("owner");
      expect(mocks.getOwnerBookings).toHaveBeenCalled();
      expect(result.bookings[0].availableTransitions).toEqual([
        "OWNER_APPROVE",
      ]);
    });

    it("forces renter view for non-owner requesting owner view", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getMyBookings.mockResolvedValue([]);
      const result = await clientLoader({
        request: new Request("http://localhost/bookings?view=owner"),
      } as any) as any;
      expect(result.view).toBe("renter");
      expect(mocks.getMyBookings).toHaveBeenCalled();
    });

    it("filters by status", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getMyBookings.mockResolvedValue([
        makeBooking({ status: "CONFIRMED" }),
        makeBooking({ id: "b2", status: "CANCELLED" }),
      ]);
      const result = await clientLoader({
        request: new Request("http://localhost/bookings?status=confirmed"),
      } as any) as any;
      expect(result.bookings).toHaveLength(1);
    });

    it("ignores invalid status filter", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getMyBookings.mockResolvedValue([makeBooking()]);
      const result = await clientLoader({
        request: new Request("http://localhost/bookings?status=invalid"),
      } as any) as any;
      expect(result.bookings).toHaveLength(1);
    });

    it("handles API error gracefully", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getMyBookings.mockRejectedValue(new Error("fail"));
      const result = await clientLoader({
        request: new Request("http://localhost/bookings"),
      } as any) as any;
      expect(result.bookings).toEqual([]);
      expect(result.error).toBeTruthy();
    });

    it("uses timeout-specific loader copy", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getMyBookings.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

      const result = await clientLoader({
        request: new Request("http://localhost/bookings"),
      } as any) as any;

      expect(result.error).toBe("Loading bookings timed out. Try again.");
    });

    it("uses offline-specific loader copy", async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getMyBookings.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

      const result = await clientLoader({
        request: new Request("http://localhost/bookings"),
      } as any) as any;

      expect(result.error).toBe(
        "You appear to be offline. Reconnect and try loading bookings again."
      );
    });

    it("preserves backend loader messages", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getMyBookings.mockRejectedValue({
        response: { data: { message: "Booking history is temporarily unavailable" } },
      });

      const result = await clientLoader({
        request: new Request("http://localhost/bookings"),
      } as any) as any;

      expect(result.error).toBe("Booking history is temporarily unavailable");
    });

    it("indicates canViewOwner for owner role", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getMyBookings.mockResolvedValue([]);
      const result = await clientLoader({
        request: new Request("http://localhost/bookings"),
      } as any) as any;
      expect(result.canViewOwner).toBe(true);
    });

    it("indicates !canViewOwner for renter role", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getMyBookings.mockResolvedValue([]);
      const result = await clientLoader({
        request: new Request("http://localhost/bookings"),
      } as any) as any;
      expect(result.canViewOwner).toBe(false);
    });

    it("handles non-array response gracefully", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getMyBookings.mockResolvedValue(null);
      const result = await clientLoader({
        request: new Request("http://localhost/bookings"),
      } as any) as any;
      expect(result.bookings).toEqual([]);
    });
  });

  describe("BookingsPage component", () => {
    beforeEach(() => {
      mocks.useSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
    });

    it("renders bookings list", () => {
      mocks.useLoaderData.mockReturnValue({
        bookings: [makeBooking()],
        view: "renter",
        status: null,
        canViewOwner: false,
        error: null,
      });
      render(<BookingsPage />);
      expect(screen.getByText(/Camera/)).toBeInTheDocument();
    });

    it("renders payment failure guidance and retry action", () => {
      mocks.useLoaderData.mockReturnValue({
        bookings: [
          makeBooking({
            status: "PAYMENT_FAILED",
            paymentStatus: "FAILED",
          }),
        ],
        view: "renter",
        status: null,
        canViewOwner: false,
        error: null,
      });
      render(<BookingsPage />);
      expect(
        screen.getByText(/Retry payment to keep the booking active before it expires/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Retry Payment/i })
      ).toBeInTheDocument();
    });

    it("renders error alert", () => {
      mocks.useLoaderData.mockReturnValue({
        bookings: [],
        view: "renter",
        status: null,
        canViewOwner: false,
        error: "Failed to load bookings.",
      });
      render(<BookingsPage />);
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });

    it("revalidates when the loader error retry action is clicked", () => {
      const revalidate = vi.fn();
      mocks.useRevalidator.mockReturnValue({ revalidate, state: "idle" });
      mocks.useLoaderData.mockReturnValue({
        bookings: [],
        view: "renter",
        status: null,
        canViewOwner: false,
        error: "Loading bookings timed out. Try again.",
      });

      render(<BookingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));
      expect(revalidate).toHaveBeenCalledTimes(1);
    });

    it("renders empty state", () => {
      mocks.useLoaderData.mockReturnValue({
        bookings: [],
        view: "renter",
        status: null,
        canViewOwner: false,
        error: null,
      });
      render(<BookingsPage />);
      expect(
        screen.queryByTestId("empty") || screen.queryByText(/no booking/i)
      ).toBeTruthy();
    });

    it("renders view toggle for owners", () => {
      mocks.useLoaderData.mockReturnValue({
        bookings: [makeBooking()],
        view: "renter",
        status: null,
        canViewOwner: true,
        error: null,
      });
      render(<BookingsPage />);
      // Should show "My Listings" toggle for owners
      expect(screen.getByText("My Listings")).toBeInTheDocument();
    });

    it("shows owner return-inspection guidance", () => {
      mocks.useLoaderData.mockReturnValue({
        bookings: [
          makeBooking({
            status: "AWAITING_RETURN_INSPECTION",
            ownerId: "user-1",
            renterId: "renter-2",
            paymentStatus: "PAID",
            availableTransitions: ["APPROVE_RETURN", "REJECT_RETURN"],
          }),
        ],
        view: "owner",
        status: null,
        canViewOwner: true,
        error: null,
      });
      render(<BookingsPage />);
      expect(screen.getByText(/Inspect the return/i)).toBeInTheDocument();
    });

    it("shows contextual recovery copy when a decline action is no longer available", () => {
      mocks.useLoaderData.mockReturnValue({
        bookings: [
          makeBooking({
            status: "PENDING_OWNER_APPROVAL",
            ownerId: "user-1",
            renterId: "renter-2",
            availableTransitions: ["OWNER_APPROVE"],
          }),
        ],
        view: "owner",
        status: null,
        canViewOwner: true,
        error: null,
      });

      render(<BookingsPage />);

      fireEvent.click(screen.getByRole("button", { name: /Decline/i }));
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "No longer needed" },
      });
      fireEvent.click(screen.getAllByRole("button", { name: /Decline/i })[1]);

      expect(mocks.toastError).toHaveBeenCalledWith(
        "This booking request no longer needs a decline action. Refresh and review the latest booking status."
      );
    });
  });

  describe("error helpers", () => {
    it("preserves backend loader errors", () => {
      expect(
        getBookingsLoadError({
          response: { data: { message: "Booking history is temporarily unavailable" } },
        })
      ).toBe("Booking history is temporarily unavailable");
    });

    it("uses timeout-specific loader copy", () => {
      expect(getBookingsLoadError(new AxiosError("timeout", "ECONNABORTED"))).toBe(
        "Loading bookings timed out. Try again."
      );
    });

    it("uses offline-specific loader copy", () => {
      const previousOnline = navigator.onLine;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });

      expect(getBookingsLoadError(new AxiosError("Network Error", "ERR_NETWORK"))).toBe(
        "You appear to be offline. Reconnect and try loading bookings again."
      );

      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: previousOnline,
      });
    });

    it("preserves backend action errors", () => {
      expect(
        getBookingsActionError(
          { response: { data: { message: "Booking was already cancelled" } } },
          "fallback"
        )
      ).toBe("Booking was already cancelled");
    });

    it("uses conflict-specific action copy", () => {
      expect(
        getBookingsActionError(
          new AxiosError("Conflict", undefined, undefined, undefined, {
            status: 409,
            statusText: "Conflict",
            headers: {},
            config: { headers: {} } as any,
            data: {},
          } as any),
          "fallback"
        )
      ).toBe(
        "This booking changed while you were working. Refresh and review the latest status before trying again."
      );
    });

    it("uses timeout-specific action copy", () => {
      expect(
        getBookingsActionError(new AxiosError("timeout", "ECONNABORTED"), "fallback")
      ).toBe("The booking request timed out. Refresh and try again.");
    });

    it("uses offline-specific action copy", () => {
      const previousOnline = navigator.onLine;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });

      expect(
        getBookingsActionError(
          new AxiosError("Network Error", "ERR_NETWORK"),
          "fallback"
        )
      ).toBe("You appear to be offline. Reconnect and try again.");

      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: previousOnline,
      });
    });

    it("uses contextual unavailable-action copy for cancel", () => {
      expect(getBookingsUnavailableActionError("cancel")).toBe(
        "This booking can no longer be cancelled from the list. Refresh and review the latest booking status."
      );
    });

    it("uses contextual unavailable-action copy for decline", () => {
      expect(getBookingsUnavailableActionError("reject")).toBe(
        "This booking request no longer needs a decline action. Refresh and review the latest booking status."
      );
    });
  });
});
