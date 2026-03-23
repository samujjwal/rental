import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getBookingById: vi.fn(),
  getConditionReports: vi.fn(),
  updateConditionReport: vi.fn(),
  useLoaderData: vi.fn(),
  useActionData: vi.fn(),
  useNavigation: vi.fn(() => ({ state: "idle" })),
  revalidate: vi.fn(),
}));

vi.mock("react-router", () => ({
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
  useLoaderData: () => mocks.useLoaderData(),
  useActionData: () => mocks.useActionData(),
  useNavigation: () => mocks.useNavigation(),
  useRevalidator: () => ({ revalidate: mocks.revalidate }),
}));

vi.mock("~/utils/auth", () => ({
  getUser: (...args: any[]) => mocks.getUser(...args),
}));

vi.mock("~/lib/api/bookings", () => ({
  bookingsApi: {
    getBookingById: (...args: any[]) => mocks.getBookingById(...args),
    getConditionReports: (...args: any[]) => mocks.getConditionReports(...args),
    updateConditionReport: (...args: any[]) => mocks.updateConditionReport(...args),
  },
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  UnifiedButton: ({ children, loading, ...props }: any) => <button {...props}>{children}</button>,
}));

import ConditionReportPage, {
  clientAction,
  clientLoader,
  getConditionReportLoadError,
  getConditionReportUpdateError,
} from "./bookings.$id.condition-report";

const VALID_BOOKING_ID = "123e4567-e89b-12d3-a456-426614174000";
const VALID_REPORT_ID = "123e4567-e89b-12d3-a456-426614174001";
const booking = {
  id: VALID_BOOKING_ID,
  ownerId: "owner-1",
  renterId: "user-1",
  listing: { title: "City Apartment" },
};
const report = {
  id: VALID_REPORT_ID,
  reportType: "CHECK_IN",
  creator: { firstName: "Sam", lastName: "Owner" },
  createdAt: "2026-03-18T00:00:00.000Z",
  signature: null,
  photos: [],
  notes: null,
  damages: null,
  createdBy: "user-1",
};

describe("bookings.$id.condition-report clientLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
    mocks.useActionData.mockReturnValue(null);
    mocks.useLoaderData.mockReturnValue({ booking, reports: [report], userId: "user-1", error: null });
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("returns booking and reports for participants", async () => {
    mocks.getBookingById.mockResolvedValue(booking);
    mocks.getConditionReports.mockResolvedValue([report]);

    const result = await clientLoader({
      params: { id: VALID_BOOKING_ID },
      request: new Request(`http://localhost/bookings/${VALID_BOOKING_ID}/condition-report`),
    } as any);

    expect(result).toEqual({ booking, reports: [report], userId: "user-1" });
  });

  it("returns actionable fallback loader state on timeout", async () => {
    mocks.getBookingById.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const result = await clientLoader({
      params: { id: VALID_BOOKING_ID },
      request: new Request(`http://localhost/bookings/${VALID_BOOKING_ID}/condition-report`),
    } as any);

    expect(result).toEqual({
      booking: null,
      reports: [],
      userId: "user-1",
      error: "Loading the condition reports timed out. Try again.",
    });
  });

  it("maps offline loader failures to actionable copy", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    expect(getConditionReportLoadError(new AxiosError("Network Error", "ERR_NETWORK"))).toBe(
      "You appear to be offline. Reconnect and try again."
    );
  });
});

describe("bookings.$id.condition-report component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useNavigation.mockReturnValue({ state: "idle" });
    mocks.useActionData.mockReturnValue(null);
  });

  it("renders retryable fallback UI when loader data has no booking", () => {
    mocks.useLoaderData.mockReturnValue({
      booking: null,
      reports: [],
      userId: "user-1",
      error: "Loading the condition reports timed out. Try again.",
    });

    render(<ConditionReportPage />);

    expect(screen.getByText("Condition reports unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });
});

describe("bookings.$id.condition-report clientAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: "user-1", role: "renter" });
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("preserves backend response messages", async () => {
    mocks.updateConditionReport.mockRejectedValue({
      response: { data: { message: "Report already finalized" } },
    });

    const formData = new FormData();
    formData.set("reportId", VALID_REPORT_ID);
    formData.set("notes", "Updated notes");

    const request = new Request("http://localhost/bookings/test/condition-report", {
      method: "POST",
      body: formData,
    });

    const result = await clientAction({ params: { id: VALID_BOOKING_ID }, request } as any);
    expect(result).toEqual({ error: "Report already finalized" });
  });

  it("falls back to actionable offline copy", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    mocks.updateConditionReport.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

    const formData = new FormData();
    formData.set("reportId", VALID_REPORT_ID);

    const request = new Request("http://localhost/bookings/test/condition-report", {
      method: "POST",
      body: formData,
    });

    const result = await clientAction({ params: { id: VALID_BOOKING_ID }, request } as any);
    expect(result).toEqual({ error: "You appear to be offline. Reconnect and try updating the report again." });
  });

  it("falls back to timeout-specific copy", async () => {
    mocks.updateConditionReport.mockRejectedValue(
      new AxiosError("timeout", "ECONNABORTED")
    );

    const formData = new FormData();
    formData.set("reportId", VALID_REPORT_ID);

    const request = new Request("http://localhost/bookings/test/condition-report", {
      method: "POST",
      body: formData,
    });

    const result = await clientAction({ params: { id: VALID_BOOKING_ID }, request } as any);
    expect(result).toEqual({ error: "Updating the report timed out. Try again." });
  });

  it("falls back to conflict-specific copy", async () => {
    mocks.updateConditionReport.mockRejectedValue(
      new AxiosError("Conflict", undefined, undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        headers: {},
        config: { headers: {} } as any,
        data: {},
      } as any)
    );

    const formData = new FormData();
    formData.set("reportId", VALID_REPORT_ID);

    const request = new Request("http://localhost/bookings/test/condition-report", {
      method: "POST",
      body: formData,
    });

    const result = await clientAction({ params: { id: VALID_BOOKING_ID }, request } as any);
    expect(result).toEqual({ error: "This report was updated elsewhere. Refresh and try again." });
  });

  it("falls back to network-specific copy", async () => {
    mocks.updateConditionReport.mockRejectedValue(
      new AxiosError("Network Error", "ERR_NETWORK")
    );

    const formData = new FormData();
    formData.set("reportId", VALID_REPORT_ID);

    const request = new Request("http://localhost/bookings/test/condition-report", {
      method: "POST",
      body: formData,
    });

    const result = await clientAction({ params: { id: VALID_BOOKING_ID }, request } as any);
    expect(result).toEqual({ error: "We could not update the report right now. Try again in a moment." });
  });

  it("preserves specific direct mutation messages", async () => {
    mocks.updateConditionReport.mockRejectedValue(new Error("Signature is required before submitting"));

    const formData = new FormData();
    formData.set("reportId", VALID_REPORT_ID);

    const request = new Request("http://localhost/bookings/test/condition-report", {
      method: "POST",
      body: formData,
    });

    const result = await clientAction({ params: { id: VALID_BOOKING_ID }, request } as any);
    expect(result).toEqual({ error: "Signature is required before submitting" });
  });
});

describe("getConditionReportUpdateError", () => {
  it("maps network failures to actionable copy", () => {
    expect(
      getConditionReportUpdateError(new AxiosError("Network Error", "ERR_NETWORK"))
    ).toBe("We could not update the report right now. Try again in a moment.");
  });
});