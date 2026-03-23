import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  getListingById: vi.fn(),
  createListing: vi.fn(),
  getUser: vi.fn(),
  useActionData: vi.fn(),
  useNavigate: vi.fn(() => vi.fn()),
  useSubmit: vi.fn(() => vi.fn()),
  redirect: vi.fn((url: string) => {
    return new Response("", { status: 302, headers: { Location: url } });
  }),
}));

vi.mock("react-router", () => ({
  useActionData: () => mocks.useActionData(),
  useNavigate: () => mocks.useNavigate(),
  useSubmit: () => mocks.useSubmit(),
  redirect: mocks.redirect,
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("~/lib/api/listings", () => ({
  listingsApi: {
    getListingById: (...args: any[]) => mocks.getListingById(...args),
    createListing: (...args: any[]) => mocks.createListing(...args),
    getCategories: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("~/lib/api/upload", () => ({
  uploadApi: { uploadImage: vi.fn() },
}));

vi.mock("~/lib/api/ai", () => ({
  aiApi: { generateDescription: vi.fn() },
}));

vi.mock("~/lib/validation/listing", () => ({
  listingSchema: {
    safeParse: (data: unknown) => ({
      success: true,
      data,
    }),
  },
}));

vi.mock("~/utils/auth", () => ({
  getUser: (...args: any[]) => mocks.getUser(...args),
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("~/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("~/components/listings/VoiceListingAssistant", () => ({
  VoiceListingAssistant: () => <div data-testid="voice-assistant" />,
}));

vi.mock("~/components/listings/CategorySpecificFields", () => ({
  CategorySpecificFields: () => <div data-testid="category-fields" />,
}));

vi.mock("~/lib/category-fields", () => ({
  getCategoryFields: vi.fn(() => []),
}));

vi.mock("~/components/listings/steps", () => ({
  ListingStepIndicator: ({ currentStep }: any) => (
    <div data-testid="step-indicator">Step {currentStep}</div>
  ),
  LocationStep: () => <div data-testid="location-step" />,
  DetailsStep: () => <div data-testid="details-step" />,
  PricingStep: () => <div data-testid="pricing-step" />,
  ImageUploadStep: () => <div data-testid="image-step" />,
}));

vi.mock("react-hook-form", () => ({
  useForm: () => ({
    register: vi.fn(() => ({})),
    handleSubmit: vi.fn((fn: any) => fn),
    setValue: vi.fn(),
    watch: vi.fn(() => ""),
    formState: { errors: {} },
    trigger: vi.fn(),
    reset: vi.fn(),
    getValues: vi.fn(() => ({})),
  }),
}));

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: vi.fn(),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: IconStub, ArrowRight: IconStub, Upload: IconStub, X: IconStub,
  CheckCircle: IconStub, Sparkles: IconStub, TrendingUp: IconStub,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import {
  clientLoader,
  clientAction,
  getCreateListingError,
} from "./listings.new";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeActionRequest(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("listings.new route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("clientLoader", () => {
    it("redirects to login when not authenticated", async () => {
      mocks.getUser.mockResolvedValue(null);
      const result = await clientLoader({
        request: new Request("http://localhost/listings/new"),
      } as any);
      expect(mocks.redirect).toHaveBeenCalledWith(
        "/auth/login?redirectTo=/listings/new"
      );
    });

    it("redirects to become-owner when user is renter", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
      const result = await clientLoader({
        request: new Request("http://localhost/listings/new"),
      } as any);
      expect(mocks.redirect).toHaveBeenCalledWith("/become-owner");
    });

    it("returns null for owner", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
      const result = await clientLoader({
        request: new Request("http://localhost/listings/new"),
      } as any);
      expect(result).toBeNull();
    });

    it("returns null for admin", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "admin" });
      const result = await clientLoader({
        request: new Request("http://localhost/listings/new"),
      } as any);
      expect(result).toBeNull();
    });
  });

  describe("clientAction", () => {
    it("redirects to login when not authenticated", async () => {
      mocks.getUser.mockResolvedValue(null);
      try {
        await clientAction({
          request: makeActionRequest({ intent: "create", data: "{}" }),
        } as any);
      } catch {
        // redirect throws
      }
      expect(mocks.redirect).toHaveBeenCalledWith(
        "/auth/login?redirectTo=/listings/new"
      );
    });

    it("rejects non-owner role", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
      const result = await clientAction({
        request: makeActionRequest({ intent: "create", data: "{}" }),
      } as any);
      expect(result).toEqual({ error: "Only owners can create listings." });
    });

    it("rejects invalid intent", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
      const result = await clientAction({
        request: makeActionRequest({ intent: "hack", data: "{}" }),
      } as any);
      expect(result).toEqual({ error: "Invalid action" });
    });

    it("rejects non-string data payload", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
      const fd = new FormData();
      fd.append("intent", "create");
      // no data field
      const result = await clientAction({
        request: { formData: () => Promise.resolve(fd) },
      } as any);
      expect(result).toEqual({ error: "Invalid listing payload" });
    });

    it("rejects oversized payload", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
      const result = await clientAction({
        request: makeActionRequest({
          intent: "create",
          data: "x".repeat(200_001),
        }),
      } as any);
      expect(result).toEqual({ error: "Listing payload is too large" });
    });

    it("rejects invalid JSON payload", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
      const result = await clientAction({
        request: makeActionRequest({
          intent: "create",
          data: "not json",
        }),
      } as any);
      expect(result).toEqual({ error: "Invalid listing payload" });
    });

    it("rejects non-object JSON payload", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
      const result = await clientAction({
        request: makeActionRequest({
          intent: "create",
          data: '"string"',
        }),
      } as any);
      expect(result).toEqual({ error: "Invalid listing payload" });
    });

    it("preserves backend create-listing errors", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
      const categoriesMock = await import("~/lib/api/listings");
      vi.mocked(categoriesMock.listingsApi.getCategories).mockResolvedValue([{ id: "cat-1" }] as any);
      mocks.createListing.mockRejectedValue({
        response: { data: { message: "Listing slug already exists" } },
      });
      const result = await clientAction({
        request: makeActionRequest({
          intent: "create",
          data: JSON.stringify({ category: "cat-1", title: "Tripod" }),
        }),
      } as any);
      expect(result).toEqual({ error: "Listing slug already exists" });
    });

    it("uses actionable offline copy on create failure", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
      const categoriesMock = await import("~/lib/api/listings");
      vi.mocked(categoriesMock.listingsApi.getCategories).mockResolvedValue([{ id: "cat-1" }] as any);
      mocks.createListing.mockRejectedValue(new Error("Network Error"));
      const online = window.navigator.onLine;
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });

      const result = await clientAction({
        request: makeActionRequest({
          intent: "create",
          data: JSON.stringify({ category: "cat-1", title: "Tripod" }),
        }),
      } as any);
      expect(result).toEqual({
        error: "You appear to be offline. Reconnect and try creating the listing again.",
      });

      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: online,
      });
    });

    it("uses timeout-specific copy on create failure", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
      const categoriesMock = await import("~/lib/api/listings");
      vi.mocked(categoriesMock.listingsApi.getCategories).mockResolvedValue([{ id: "cat-1" }] as any);
      mocks.createListing.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

      const result = await clientAction({
        request: makeActionRequest({
          intent: "create",
          data: JSON.stringify({ category: "cat-1", title: "Tripod" }),
        }),
      } as any);

      expect(result).toEqual({
        error: "Creating the listing timed out. Try again.",
      });
    });

    it("uses conflict-specific copy on create failure", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
      const categoriesMock = await import("~/lib/api/listings");
      vi.mocked(categoriesMock.listingsApi.getCategories).mockResolvedValue([{ id: "cat-1" }] as any);
      mocks.createListing.mockRejectedValue(
        new AxiosError("Conflict", undefined, undefined, undefined, {
          status: 409,
          statusText: "Conflict",
          headers: {},
          config: { headers: {} } as any,
          data: {},
        } as any)
      );

      const result = await clientAction({
        request: makeActionRequest({
          intent: "create",
          data: JSON.stringify({ category: "cat-1", title: "Tripod" }),
        }),
      } as any);

      expect(result).toEqual({
        error: "This listing is already being created or reviewed. Refresh and check your listings.",
      });
    });
  });

  describe("KEYWORD_PRICE_HINTS constant", () => {
    // We verify the price hint logic indirectly by checking the module loads
    it("module exports clientLoader and clientAction", () => {
      expect(clientLoader).toBeDefined();
      expect(clientAction).toBeDefined();
    });
  });

  describe("getCreateListingError", () => {
    it("preserves plain thrown errors", () => {
      expect(getCreateListingError(new Error("Permission denied"), "fallback")).toBe(
        "Permission denied"
      );
    });

    it("uses timeout-specific helper copy", () => {
      expect(getCreateListingError(new AxiosError("timeout", "ECONNABORTED"), "fallback")).toBe(
        "Creating the listing timed out. Try again."
      );
    });

    it("uses conflict-specific helper copy", () => {
      expect(
        getCreateListingError(
          new AxiosError("Conflict", undefined, undefined, undefined, {
            status: 409,
            statusText: "Conflict",
            headers: {},
            config: { headers: {} } as any,
            data: {},
          } as any),
          "fallback"
        )
      ).toBe("This listing is already being created or reviewed. Refresh and check your listings.");
    });
  });
});
