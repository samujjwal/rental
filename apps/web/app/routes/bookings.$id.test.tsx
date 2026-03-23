import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
const authStoreState = vi.hoisted(() => ({
  user: { id: "user-1", role: "renter", firstName: "Sita", lastName: "Devi" } as {
    id: string;
    role: string;
    firstName: string;
    lastName: string;
  } | null,
  isAuthenticated: true,
}));
const mocks = vi.hoisted(() => ({
  getBookingById: vi.fn(),
  getAvailableTransitions: vi.fn(),
  approveBooking: vi.fn(),
  rejectBooking: vi.fn(),
  cancelBooking: vi.fn(),
  startBooking: vi.fn(),
  requestReturn: vi.fn(),
  approveReturn: vi.fn(),
  createReview: vi.fn(),
  getBookingPaymentStatus: vi.fn(),
  getUser: vi.fn(),
  useLoaderData: vi.fn(),
  useActionData: vi.fn(),
  useNavigate: vi.fn(() => vi.fn()),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn(), state: "idle" })),
  navigate: vi.fn(),
  redirect: vi.fn((url: string) => {
    return new Response("", { status: 302, headers: { Location: url } });
  }),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  useActionData: () => mocks.useActionData(),
  useNavigate: () => mocks.navigate,
  useNavigation: () => ({ state: "idle" }),
  useSearchParams: () => mocks.useSearchParams(),
  useRevalidator: () => mocks.useRevalidator(),
  redirect: (...args: any[]) => (mocks.redirect as any)(...args),
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("~/lib/api/bookings", () => ({
  bookingsApi: {
    getBookingById: (...args: any[]) => mocks.getBookingById(...args),
    getAvailableTransitions: (...args: any[]) =>
      mocks.getAvailableTransitions(...args),
    approveBooking: (...args: any[]) => mocks.approveBooking(...args),
    rejectBooking: (...args: any[]) => mocks.rejectBooking(...args),
    cancelBooking: (...args: any[]) => mocks.cancelBooking(...args),
    startBooking: (...args: any[]) => mocks.startBooking(...args),
    requestReturn: (...args: any[]) => mocks.requestReturn(...args),
    approveReturn: (...args: any[]) => mocks.approveReturn(...args),
  },
}));

vi.mock("~/lib/api/reviews", () => ({
  reviewsApi: {
    createReview: (...args: any[]) => mocks.createReview(...args),
  },
}));

vi.mock("~/lib/api/payments", () => ({
  paymentsApi: {
    getBookingPaymentStatus: (...args: any[]) =>
      mocks.getBookingPaymentStatus(...args),
  },
}));

vi.mock("~/utils/auth", () => ({
  getUser: (...args: any[]) => mocks.getUser(...args),
}));

vi.mock("~/lib/store/auth", () => {
  const useAuthStore: any = (sel?: (s: any) => any) => sel ? sel(authStoreState) : authStoreState;
  useAuthStore.getState = () => authStoreState;
  return { useAuthStore };
});

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
    REFUNDED: "REFUNDED",
  },
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  UnifiedButton: ({ children, loading, ...props }: any) => (
    <button {...props}>{loading ? <span data-testid="loading-spinner" /> : null}{children}</button>
  ),
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
}));

vi.mock("~/components/animations/SuccessCelebration", () => ({
  SuccessCelebration: () => null,
}));

vi.mock("date-fns", () => ({
  format: (date: Date, pattern: string) => date?.toISOString?.()?.slice(0, 10) ?? "N/A",
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: IconStub, Calendar: IconStub, MapPin: IconStub, Package: IconStub,
  Clock: IconStub, CheckCircle: IconStub, XCircle: IconStub, MessageCircle: IconStub,
  AlertCircle: IconStub, FileText: IconStub, Star: IconStub, Loader2: IconStub, RefreshCw: IconStub,
  CreditCard: IconStub, ArrowRight: IconStub,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import BookingDetail, { clientLoader, clientAction } from "./bookings.$id";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_UUID = "a1b2c3d4-e5f6-1234-abcd-1234567890ab";
const VALID_CUID = "ckx1234567890abcdefghijkl";

const makeBooking = (overrides: Record<string, any> = {}) => ({
  id: VALID_UUID,
  ownerId: "owner-1",
  renterId: "user-1",
  status: "CONFIRMED",
  listing: { id: "listing-1", title: "Test Item", images: ["/img1.jpg"], location: { city: "Kathmandu" } },
  totalPrice: 5000,
  startDate: new Date("2025-01-10").toISOString(),
  endDate: new Date("2025-01-15").toISOString(),
  createdAt: new Date("2025-01-01").toISOString(),
  owner: { id: "owner-1", firstName: "Ram", lastName: "Bahadur" },
  renter: { id: "user-1", firstName: "Sita", lastName: "Devi" },
  review: null,
  ...overrides,
});

const makeRequest = (url = "http://localhost/bookings/a1b2c3d4-e5f6-1234-abcd-1234567890ab") =>
  new Request(url);

const makeFormData = (fields: Record<string, string>) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
  return new Request("http://localhost/bookings/" + VALID_UUID, {
    method: "POST",
    body: fd,
  });
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("bookings.$id route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStoreState.user = { id: "user-1", role: "renter", firstName: "Sita", lastName: "Devi" };
    authStoreState.isAuthenticated = true;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    mocks.useLoaderData.mockReturnValue({
      booking: makeBooking(),
      viewerRole: "renter",
      availableTransitions: [],
    });
    mocks.useActionData.mockReturnValue(null);
    mocks.useSearchParams.mockReturnValue([new URLSearchParams(), vi.fn()]);
    mocks.getAvailableTransitions.mockResolvedValue({ availableTransitions: [] });
    mocks.getBookingPaymentStatus.mockResolvedValue({
      confirmationState: "pending",
      paymentStatus: "PENDING",
      providerStatus: null,
      failureReason: null,
      actionRequired: false,
    });
  });

  // ─── clientLoader ────────────────────────────────────────────────────────

  describe("clientLoader", () => {
    describe("isUuid validation", () => {
      it("rejects non-UUID booking ID", async () => {
        mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
        await expect(
          clientLoader({ params: { id: "not-a-uuid" }, request: makeRequest() } as any)
        ).rejects.toBeInstanceOf(Response);
      });

      it("rejects empty booking ID", async () => {
        mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
        await expect(
          clientLoader({ params: { id: "" }, request: makeRequest() } as any)
        ).rejects.toBeInstanceOf(Response);
      });

      it("rejects undefined booking ID", async () => {
        mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
        await expect(
          clientLoader({ params: {}, request: makeRequest() } as any)
        ).rejects.toBeInstanceOf(Response);
      });

      it("accepts valid UUID booking ID", async () => {
        mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
        mocks.getBookingById.mockResolvedValue(makeBooking());
        const result = await clientLoader({
          params: { id: VALID_UUID },
          request: makeRequest(),
        } as any);
        expect(result).toEqual(
          expect.objectContaining({
            booking: expect.objectContaining({ id: VALID_UUID }),
            availableTransitions: [],
          })
        );
      });

      it("accepts valid CUID booking ID", async () => {
        mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
        mocks.getBookingById.mockResolvedValue(makeBooking({ id: VALID_CUID }));
        const result = await clientLoader({
          params: { id: VALID_CUID },
          request: makeRequest(`http://localhost/bookings/${VALID_CUID}`),
        } as any);
        expect(result).toEqual(
          expect.objectContaining({
            booking: expect.objectContaining({ id: VALID_CUID }),
            availableTransitions: [],
          })
        );
      });
    });

    it("throws redirect to login when user is not authenticated", async () => {
      mocks.getUser.mockResolvedValue(null);
      authStoreState.user = null;
      authStoreState.isAuthenticated = false;
      await expect(
        clientLoader({ params: { id: VALID_UUID }, request: makeRequest() } as any)
      ).rejects.toBeInstanceOf(Response);
      expect(mocks.redirect).toHaveBeenCalledWith("/auth/login");
    });

    it("throws redirect for non-participant", async () => {
      mocks.getUser.mockResolvedValue({ id: "other-user", role: "renter" });
      authStoreState.user = null;
      authStoreState.isAuthenticated = false;
      mocks.getBookingById.mockResolvedValue(makeBooking());
      await expect(
        clientLoader({ params: { id: VALID_UUID }, request: makeRequest() } as any)
      ).rejects.toBeInstanceOf(Response);
      expect(mocks.redirect).toHaveBeenCalledWith("/bookings");
    });

    it("allows admin to view any booking", async () => {
      mocks.getUser.mockResolvedValue({ id: "admin-x", role: "admin" });
      mocks.getBookingById.mockResolvedValue(makeBooking());
      const result = await clientLoader({
        params: { id: VALID_UUID }, request: makeRequest(),
      } as any);
      expect(result).toEqual(
        expect.objectContaining({
          booking: expect.objectContaining({ id: VALID_UUID }),
          availableTransitions: [],
        })
      );
    });

    it("allows owner to view their booking", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockResolvedValue(makeBooking());
      const result = await clientLoader({
        params: { id: VALID_UUID }, request: makeRequest(),
      } as any);
      expect(result).toEqual(
        expect.objectContaining({
          booking: expect.objectContaining({ id: VALID_UUID }),
          availableTransitions: [],
        })
      );
    });

    it("allows renter to view their booking", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking());
      const result = await clientLoader({
        params: { id: VALID_UUID }, request: makeRequest(),
      } as any);
      expect(result).toEqual(
        expect.objectContaining({
          booking: expect.objectContaining({ id: VALID_UUID }),
          availableTransitions: [],
        })
      );
    });

    it("redirects on API error", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockRejectedValue(new Error("Network"));
      const result = await clientLoader({
        params: { id: VALID_UUID },
        request: makeRequest(),
      } as any);

      expect(result).toEqual(
        expect.objectContaining({
          booking: null,
          availableTransitions: [],
          error: "Network",
        })
      );
    });

    it("returns timeout-specific fallback state for recoverable loader failures", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

      const result = await clientLoader({
        params: { id: VALID_UUID },
        request: makeRequest(),
      } as any);

      expect(result).toEqual(
        expect.objectContaining({
          booking: null,
          availableTransitions: [],
          error: "Loading this booking timed out. Try again.",
        })
      );
    });
  });

  // ─── clientAction ────────────────────────────────────────────────────────

  describe("clientAction", () => {
    it("returns redirect for unauthenticated user", async () => {
      mocks.getUser.mockResolvedValue(null);
      const result = await clientAction({
        request: makeFormData({ intent: "confirm" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toBeInstanceOf(Response);
    });

    it("returns error for invalid booking id", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      const result = await clientAction({
        request: makeFormData({ intent: "confirm" }), params: { id: "bad" },
      } as any);
      expect(result).toEqual({ error: "Booking ID is required" });
    });

    it("returns error for invalid intent", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking());
      const result = await clientAction({
        request: makeFormData({ intent: "invalid" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Invalid action" });
    });

    it("returns error for unauthorized (non-participant)", async () => {
      mocks.getUser.mockResolvedValue({ id: "nobody", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking());
      const result = await clientAction({
        request: makeFormData({ intent: "confirm" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "You are not authorized to modify this booking." });
    });

    it("confirms booking when owner and pending_owner_approval", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "PENDING_OWNER_APPROVAL" }));
      mocks.getAvailableTransitions.mockResolvedValue({
        availableTransitions: ["OWNER_APPROVE", "OWNER_REJECT"],
      });
      mocks.approveBooking.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({ intent: "confirm" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ success: "Booking confirmed successfully" });
      expect(mocks.approveBooking).toHaveBeenCalledWith(VALID_UUID);
    });

    it("rejects confirm when not owner", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "PENDING_OWNER_APPROVAL" }));
      mocks.getAvailableTransitions.mockResolvedValue({ availableTransitions: [] });
      const result = await clientAction({
        request: makeFormData({ intent: "confirm" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Booking cannot be confirmed in its current state." });
    });

    it("rejects confirm when status is wrong", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "CONFIRMED" }));
      const result = await clientAction({
        request: makeFormData({ intent: "confirm" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Booking cannot be confirmed in its current state." });
    });

    it("rejects booking with reason", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "PENDING_OWNER_APPROVAL" }));
      mocks.getAvailableTransitions.mockResolvedValue({
        availableTransitions: ["OWNER_REJECT"],
      });
      mocks.rejectBooking.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({ intent: "reject", reason: "Not available" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ success: "Booking declined successfully" });
      expect(mocks.rejectBooking).toHaveBeenCalledWith(VALID_UUID, "Not available");
    });

    it("requires reason for rejection", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "PENDING_OWNER_APPROVAL" }));
      mocks.getAvailableTransitions.mockResolvedValue({
        availableTransitions: ["OWNER_REJECT"],
      });
      const result = await clientAction({
        request: makeFormData({ intent: "reject" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Rejection reason is required" });
    });

    it("cancels and redirects with reason", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "CONFIRMED" }));
      mocks.getAvailableTransitions.mockResolvedValue({
        availableTransitions: ["CANCEL"],
      });
      mocks.cancelBooking.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({ intent: "cancel", reason: "Changed plans" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toBeInstanceOf(Response);
      expect(mocks.cancelBooking).toHaveBeenCalledWith(VALID_UUID, "Changed plans");
    });

    it("requires reason for cancellation", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "CONFIRMED" }));
      mocks.getAvailableTransitions.mockResolvedValue({
        availableTransitions: ["CANCEL"],
      });
      const result = await clientAction({
        request: makeFormData({ intent: "cancel" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Cancellation reason is required" });
    });

    it("rejects cancel for wrong status", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "COMPLETED" }));
      const result = await clientAction({
        request: makeFormData({ intent: "cancel", reason: "X" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Booking cannot be cancelled in its current state." });
    });

    it("starts confirmed booking as owner", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "CONFIRMED" }));
      mocks.getAvailableTransitions.mockResolvedValue({
        availableTransitions: ["START_RENTAL"],
      });
      mocks.startBooking.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({ intent: "start" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ success: "Booking started" });
    });

    it("rejects start from renter", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "CONFIRMED" }));
      const result = await clientAction({
        request: makeFormData({ intent: "start" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Booking cannot be started in its current state." });
    });

    it("requests return as renter when active", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "IN_PROGRESS" }));
      mocks.getAvailableTransitions.mockResolvedValue({
        availableTransitions: ["REQUEST_RETURN"],
      });
      mocks.requestReturn.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({ intent: "request_return" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ success: "Return requested" });
    });

    it("rejects return request from owner", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "IN_PROGRESS" }));
      const result = await clientAction({
        request: makeFormData({ intent: "request_return" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Return cannot be requested in current booking state." });
    });

    it("completes booking as owner when return requested", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "AWAITING_RETURN_INSPECTION" }));
      mocks.getAvailableTransitions.mockResolvedValue({
        availableTransitions: ["APPROVE_RETURN", "REJECT_RETURN"],
      });
      mocks.approveReturn.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({ intent: "complete" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ success: "Booking marked as complete" });
    });

    it("rejects complete for wrong status", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "CONFIRMED" }));
      const result = await clientAction({
        request: makeFormData({ intent: "complete" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Booking cannot be completed in its current state." });
    });

    it("submits renter-to-owner review", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "COMPLETED", review: null }));
      mocks.createReview.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({ intent: "review", rating: "5", comment: "Great item!" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ success: "Review submitted successfully" });
      expect(mocks.createReview).toHaveBeenCalledWith({
        bookingId: VALID_UUID, reviewType: "RENTER_TO_OWNER", overallRating: 5, comment: "Great item!",
      });
    });

    it("submits owner-to-renter review", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "COMPLETED", review: null }));
      mocks.createReview.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({ intent: "review", rating: "4", comment: "Good renter" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ success: "Review submitted successfully" });
      expect(mocks.createReview).toHaveBeenCalledWith(
        expect.objectContaining({ reviewType: "OWNER_TO_RENTER" })
      );
    });

    it("rejects review for wrong status", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "CONFIRMED" }));
      const result = await clientAction({
        request: makeFormData({ intent: "review", rating: "5", comment: "Nice" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Reviews can only be submitted after completion." });
    });

    it("rejects review if already reviewed", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({
        status: "COMPLETED", review: { id: "rev-1", rating: 5, reviewerId: "user-1" },
      }));
      const result = await clientAction({
        request: makeFormData({ intent: "review", rating: "5", comment: "Nice" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "You have already submitted a review for this booking." });
    });

    it("requires valid rating 1-5", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "COMPLETED", review: null }));
      const result = await clientAction({
        request: makeFormData({ intent: "review", rating: "0", comment: "Bad" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Rating must be between 1 and 5" });
    });

    it("rejects rating > 5", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "COMPLETED", review: null }));
      const result = await clientAction({
        request: makeFormData({ intent: "review", rating: "6", comment: "Great" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Rating must be between 1 and 5" });
    });

    it("rejects non-numeric rating", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "COMPLETED", review: null }));
      const result = await clientAction({
        request: makeFormData({ intent: "review", rating: "abc", comment: "Fine" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Rating must be between 1 and 5" });
    });

    it("requires review comment", async () => {
      mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
      mocks.getBookingById.mockResolvedValue(makeBooking({ status: "COMPLETED", review: null }));
      const result = await clientAction({
        request: makeFormData({ intent: "review", rating: "5" }),
        params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Review comment is required" });
    });

    it("catches API errors with message", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockRejectedValue({ response: { data: { message: "Server error" } } });
      const result = await clientAction({
        request: makeFormData({ intent: "confirm" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Server error" });
    });

    it("returns fallback error when no message", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockRejectedValue(new Error("oops"));
      const result = await clientAction({
        request: makeFormData({ intent: "confirm" }), params: { id: VALID_UUID },
      } as any);
      expect(result).toEqual({ error: "Action failed" });
    });

    it("returns timeout-specific action copy", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockRejectedValue(
        new AxiosError("timeout", "ECONNABORTED")
      );

      const result = await clientAction({
        request: makeFormData({ intent: "confirm" }), params: { id: VALID_UUID },
      } as any);

      expect(result).toEqual({
        error:
          "This action is taking longer than expected. Refresh the booking to confirm the latest state before retrying.",
      });
    });

    it("returns conflict-specific action copy", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockRejectedValue(
        new AxiosError("Conflict", undefined, undefined, undefined, {
          status: 409,
          statusText: "Conflict",
          headers: {},
          config: { headers: {} } as any,
          data: {},
        } as any)
      );

      const result = await clientAction({
        request: makeFormData({ intent: "confirm" }), params: { id: VALID_UUID },
      } as any);

      expect(result).toEqual({
        error:
          "This booking changed while you were working. We refreshed the state. Please review the latest status and try again.",
      });
    });

    it("returns offline-specific action copy", async () => {
      const previousOnline = navigator.onLine;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getBookingById.mockRejectedValue(
        new AxiosError("Network Error", "ERR_NETWORK")
      );

      const result = await clientAction({
        request: makeFormData({ intent: "confirm" }), params: { id: VALID_UUID },
      } as any);

      expect(result).toEqual({
        error: "You are offline. Reconnect and try the booking action again.",
      });

      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: previousOnline,
      });
    });
  });

  // ─── Component rendering ────────────────────────────────────────────────

  describe("component rendering", () => {
    it("renders booking details", () => {
      mocks.useLoaderData.mockReturnValue({
        booking: makeBooking(),
        viewerRole: "renter",
        availableTransitions: [],
      });
      mocks.useActionData.mockReturnValue(null);
      render(<BookingDetail />);
      expect(screen.getByText("Test Item")).toBeInTheDocument();
    });

    it("shows success message from action", () => {
      mocks.useLoaderData.mockReturnValue({
        booking: makeBooking(),
        viewerRole: "renter",
        availableTransitions: [],
      });
      mocks.useActionData.mockReturnValue({ success: "Done!" });
      render(<BookingDetail />);
      expect(screen.getByText("Done!")).toBeInTheDocument();
    });

    it("shows error message from action", () => {
      mocks.useLoaderData.mockReturnValue({
        booking: makeBooking(),
        viewerRole: "renter",
        availableTransitions: [],
      });
      mocks.useActionData.mockReturnValue({ error: "Oops!" });
      render(<BookingDetail />);
      expect(screen.getByText("Oops!")).toBeInTheDocument();
    });

    it("hides Leave Review CTA when booking.review is non-null (regression: canReview bug)", () => {
      // booking.review truthy → canReview must be false → no review form rendered
      mocks.useLoaderData.mockReturnValue({
        booking: makeBooking({
          status: "COMPLETED",
          review: { id: "rev-1", rating: 5, comment: "Excellent", createdAt: new Date().toISOString() },
        }),
        viewerRole: "renter",
        availableTransitions: [],
      });
      mocks.useActionData.mockReturnValue(null);
      render(<BookingDetail />);
      // The review textarea / rating input must NOT be present
      expect(screen.queryByLabelText(/rating/i)).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/share your experience/i)).not.toBeInTheDocument();
    });

    it("shows Leave Review CTA when booking.review is null and status is COMPLETED", () => {
      mocks.useLoaderData.mockReturnValue({
        booking: makeBooking({ status: "COMPLETED", review: null }),
        viewerRole: "renter",
        availableTransitions: [],
      });
      mocks.useActionData.mockReturnValue(null);
      render(<BookingDetail />);
      // The review section heading should be present (multiple elements match — at least one must exist)
      expect(screen.getAllByText(/leave a review/i).length).toBeGreaterThan(0);
    });

    it("shows payment recovery guidance when checkout comes back requiring action", async () => {
      mocks.useLoaderData.mockReturnValue({
        booking: makeBooking({
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
        }),
        viewerRole: "renter",
        availableTransitions: [],
      });
      mocks.useSearchParams.mockReturnValue([
        new URLSearchParams("payment=success&redirect_status=failed"),
        vi.fn(),
      ]);
      mocks.getBookingPaymentStatus.mockResolvedValue({
        confirmationState: "action_required",
        paymentStatus: "PROCESSING",
        providerStatus: "requires_action",
        failureReason: null,
        actionRequired: true,
      });

      render(<BookingDetail />);

      await waitFor(() => {
        expect(
          screen.getByText(/Additional payment verification is still required/i)
        ).toBeInTheDocument();
      });
    });

    it("shows dispute guidance when owner is inspecting a return", () => {
      mocks.useLoaderData.mockReturnValue({
        booking: makeBooking({
          status: "AWAITING_RETURN_INSPECTION",
          ownerId: "user-1",
          renterId: "renter-2",
        }),
        viewerRole: "owner",
        availableTransitions: ["APPROVE_RETURN", "REJECT_RETURN"],
      });
      render(<BookingDetail />);
      expect(
        screen.getByText(/Report Damage vs File a Dispute/i)
      ).toBeInTheDocument();
    });

    it("shows retryable fallback UI when booking data is unavailable", () => {
      const revalidate = vi.fn();
      mocks.useRevalidator.mockReturnValue({ revalidate, state: "idle" });
      mocks.useLoaderData.mockReturnValue({
        booking: null,
        viewerRole: "renter",
        availableTransitions: [],
        error: "Loading this booking timed out. Try again.",
      });

      render(<BookingDetail />);

      expect(screen.getByText("Booking unavailable")).toBeInTheDocument();
      expect(screen.getByText("Loading this booking timed out. Try again.")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
      expect(revalidate).toHaveBeenCalledTimes(1);
    });
  });
});
