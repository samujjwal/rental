import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const IconStub = vi.hoisted(() => () => null);
const mocks = vi.hoisted(() => ({
  getListingById: vi.fn(),
  updateListing: vi.fn(),
  deleteListing: vi.fn(),
  getUser: vi.fn(),
  useLoaderData: vi.fn(() => ({ listing: {} as any, error: null as string | null })) as any,
  useActionData: vi.fn(() => null),
  useNavigate: vi.fn(() => vi.fn()),
  revalidate: vi.fn(),
  redirect: vi.fn((url: string) => {
    return new Response("", { status: 302, headers: { Location: url } });
  }),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => (mocks.useLoaderData as any)(),
  useActionData: () => (mocks.useActionData as any)(),
  useNavigate: () => (mocks.useNavigate as any)(),
  useRevalidator: () => ({ revalidate: mocks.revalidate }),
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  redirect: mocks.redirect,
}));

vi.mock("~/lib/api/listings", () => ({
  listingsApi: {
    getListingById: (...args: any[]) => mocks.getListingById(...args),
    updateListing: (...args: any[]) => mocks.updateListing(...args),
    deleteListing: (...args: any[]) => mocks.deleteListing(...args),
    getCategories: vi.fn().mockResolvedValue([{ id: "electronics", name: "Electronics", slug: "electronics" }]),
  },
}));

vi.mock("~/lib/api/upload", () => ({
  uploadApi: { uploadImage: vi.fn() },
}));

vi.mock("~/lib/api/ai", () => ({
  aiApi: { generateDescription: vi.fn() },
}));

vi.mock("~/lib/validation/listing", () => ({
  listingSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));

vi.mock("~/utils/auth", () => ({
  getUser: (...args: any[]) => mocks.getUser(...args),
}));

vi.mock("~/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  UnifiedButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("~/components/listings/VoiceListingAssistant", () => ({
  VoiceListingAssistant: () => null,
}));

vi.mock("~/components/listings/CategorySpecificFields", () => ({
  CategorySpecificFields: () => null,
}));

vi.mock("~/lib/category-fields", () => ({
  getCategoryFields: vi.fn(() => []),
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
  ArrowLeft: IconStub, Upload: IconStub, X: IconStub, Check: IconStub,
  MapPin: IconStub, Banknote: IconStub, FileText: IconStub,
  Image: IconStub, Trash2: IconStub, Sparkles: IconStub,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import EditListing, {
  clientLoader,
  clientAction,
  getEditListingError,
  getEditListingLoadError,
} from "./listings.$id.edit";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

const validId = "11111111-1111-1111-1111-111111111111";

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    id: validId,
    title: "Camera",
    ownerId: "owner-1",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("listings.$id.edit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  describe("clientLoader", () => {
    it("redirects to login when not authenticated", async () => {
      mocks.getUser.mockResolvedValue(null);
      try {
        await clientLoader({
          params: { id: validId },
          request: new Request("http://localhost/listings/edit"),
        } as any);
      } catch {
        // redirect
      }
      expect(mocks.redirect).toHaveBeenCalledWith("/auth/login");
    });

    it("redirects for invalid listing id", async () => {
      mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
      try {
        await clientLoader({
          params: { id: "bad" },
          request: new Request("http://localhost/listings/bad/edit"),
        } as any);
      } catch {
        // redirect
      }
      expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
    });

    it("redirects non-owner, non-admin to listing page", async () => {
      mocks.getUser.mockResolvedValue({ id: "other-user", role: "renter" });
      mocks.getListingById.mockResolvedValue(makeListing());
      try {
        await clientLoader({
          params: { id: validId },
          request: new Request("http://localhost"),
        } as any);
      } catch {
        // redirect
      }
      expect(mocks.redirect).toHaveBeenCalledWith(`/listings/${validId}`);
    });

    it("loads listing for owner", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      const listing = makeListing();
      mocks.getListingById.mockResolvedValue(listing);
      const result = await clientLoader({
        params: { id: validId },
        request: new Request("http://localhost"),
      } as any);
      expect(result).toEqual({ listing, error: null });
    });

    it("loads listing for admin", async () => {
      mocks.getUser.mockResolvedValue({ id: "admin-1", role: "admin" });
      const listing = makeListing();
      mocks.getListingById.mockResolvedValue(listing);
      const result = await clientLoader({
        params: { id: validId },
        request: new Request("http://localhost"),
      } as any);
      expect(result).toEqual({ listing, error: null });
    });

    it("returns retryable fallback loader state on API error", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getListingById.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));
      const result = await clientLoader({
        params: { id: validId },
        request: new Request("http://localhost"),
      } as any);
      expect(result).toEqual({
        listing: null,
        error: "Loading the listing timed out. Try again.",
      });
    });
  });

  describe("loader fallback UI", () => {
    it("renders retryable fallback UI when loader data has no listing", () => {
      mocks.useLoaderData.mockReturnValue({
        listing: null,
        error: "Loading the listing timed out. Try again.",
      });
      const navigateMock = vi.fn();
      mocks.useNavigate.mockReturnValue(navigateMock);

      render(<EditListing />);

      expect(screen.getByText("Listing editor unavailable")).toBeInTheDocument();
      expect(screen.getByText("Loading the listing timed out. Try again.")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
      expect(mocks.revalidate).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "Back to Dashboard" }));
      expect(navigateMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("clientAction", () => {
    it("redirects to login when not authenticated", async () => {
      mocks.getUser.mockResolvedValue(null);
      try {
        await clientAction({
          params: { id: validId },
          request: makeFormData({ intent: "update" }),
        } as any);
      } catch {
        // redirect
      }
      expect(mocks.redirect).toHaveBeenCalledWith("/auth/login");
    });

    it("returns error for invalid listing id", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      const result = await clientAction({
        params: { id: "bad" },
        request: makeFormData({ intent: "update" }),
      } as any);
      expect(result).toEqual({ error: "Listing ID is required" });
    });

    it("returns error for unauthorized user", async () => {
      mocks.getUser.mockResolvedValue({ id: "other", role: "renter" });
      mocks.getListingById.mockResolvedValue(makeListing());
      const result = await clientAction({
        params: { id: validId },
        request: makeFormData({ intent: "update" }),
      } as any);
      expect(result).toEqual({
        error: "You are not authorized to edit this listing",
      });
    });

    describe("delete intent", () => {
      it("deletes when confirmation matches", async () => {
        mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
        mocks.getListingById.mockResolvedValue(makeListing());
        mocks.deleteListing.mockResolvedValue({});
        try {
          await clientAction({
            params: { id: validId },
            request: makeFormData({
              intent: "delete",
              deleteConfirmation: "DELETE",
            }),
          } as any);
        } catch {
          // redirect
        }
        expect(mocks.deleteListing).toHaveBeenCalledWith(validId);
      });

      it("rejects without DELETE confirmation", async () => {
        mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
        mocks.getListingById.mockResolvedValue(makeListing());
        const result = await clientAction({
          params: { id: validId },
          request: makeFormData({
            intent: "delete",
            deleteConfirmation: "wrong",
          }),
        } as any);
        expect(result).toEqual({
          error: "Type DELETE to confirm listing deletion.",
        });
      });

      it("is case-insensitive for DELETE confirmation", async () => {
        mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
        mocks.getListingById.mockResolvedValue(makeListing());
        mocks.deleteListing.mockResolvedValue({});
        try {
          await clientAction({
            params: { id: validId },
            request: makeFormData({
              intent: "delete",
              deleteConfirmation: "delete",
            }),
          } as any);
        } catch {
          // redirect
        }
        expect(mocks.deleteListing).toHaveBeenCalled();
      });

      it("uses actionable offline copy for delete failures", async () => {
        const previousOnline = navigator.onLine;
        Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
        mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
        mocks.getListingById.mockResolvedValue(makeListing());
        mocks.deleteListing.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

        const result = await clientAction({
          params: { id: validId },
          request: makeFormData({
            intent: "delete",
            deleteConfirmation: "DELETE",
          }),
        } as any);

        expect(result).toEqual({
          error: "You appear to be offline. Reconnect and try again.",
        });

        Object.defineProperty(navigator, "onLine", { configurable: true, value: previousOnline });
      });

      it("uses timeout-specific copy for delete failures", async () => {
        mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
        mocks.getListingById.mockResolvedValue(makeListing());
        mocks.deleteListing.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

        const result = await clientAction({
          params: { id: validId },
          request: makeFormData({
            intent: "delete",
            deleteConfirmation: "DELETE",
          }),
        } as any);

        expect(result).toEqual({
          error: "Listing request timed out. Try again.",
        });
      });
    });

    it("rejects invalid intent other than update/delete", async () => {
      mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
      mocks.getListingById.mockResolvedValue(makeListing());
      const result = await clientAction({
        params: { id: validId },
        request: makeFormData({ intent: "hack" }),
      } as any);
      expect(result).toEqual({ error: "Invalid action" });
    });

    describe("update intent", () => {
      it("requires valid JSON for location, photos, etc.", async () => {
        mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
        mocks.getListingById.mockResolvedValue(makeListing());
        const result = await clientAction({
          params: { id: validId },
          request: makeFormData({
            intent: "update",
            location: "invalid-json",
            photos: "invalid",
            deliveryOptions: "invalid",
            features: "invalid",
          }),
        } as any);
        expect(result).toEqual({ error: "Invalid listing payload" });
      });

      it("rejects too many images", async () => {
        mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
        mocks.getListingById.mockResolvedValue(makeListing());
        const images = Array.from({ length: 11 }, (_, i) => `img${i}.jpg`);
        const result = await clientAction({
          params: { id: validId },
          request: makeFormData({
            intent: "update",
            title: "Test",
            description: "Test description",
            category: "electronics",
            basePrice: "100",
            securityDeposit: "50",
            minimumRentalPeriod: "1",
            location: JSON.stringify({
              city: "KTM",
              lat: 27.7,
              lng: 85.3,
            }),
            photos: JSON.stringify(images),
            deliveryOptions: JSON.stringify({ pickup: true }),
            features: JSON.stringify(["feature1"]),
          }),
        } as any);
        expect(result).toEqual({
          error: "Listing payload exceeds allowed size limits",
        });
      });

      it("preserves backend response messages in helper", () => {
        expect(
          getEditListingError({ response: { data: { message: "Moderation review in progress" } } }, "fallback")
        ).toBe("Moderation review in progress");
      });

      it("maps offline loader failures to actionable copy", () => {
        Object.defineProperty(window.navigator, "onLine", {
          configurable: true,
          value: false,
        });

        expect(getEditListingLoadError(new AxiosError("Network Error", "ERR_NETWORK"))).toBe(
          "You appear to be offline. Reconnect and try loading the listing again."
        );
      });

      it("uses actionable offline copy for update failures", async () => {
        const previousOnline = navigator.onLine;
        Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
        mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
        mocks.getListingById.mockResolvedValue(makeListing());
        mocks.updateListing.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

        const result = await clientAction({
          params: { id: validId },
          request: makeFormData({
            intent: "update",
            title: "Test",
            description: "Test description",
            category: "electronics",
            basePrice: "100",
            securityDeposit: "50",
            minimumRentalPeriod: "1",
            location: JSON.stringify({ city: "KTM" }),
            photos: JSON.stringify(["img.jpg"]),
            deliveryOptions: JSON.stringify({ pickup: true }),
            features: JSON.stringify([]),
          }),
        } as any);

        expect(result).toEqual({
          error: "You appear to be offline. Reconnect and try again.",
        });

        Object.defineProperty(navigator, "onLine", { configurable: true, value: previousOnline });
      });

      it("uses timeout-specific copy for update failures", async () => {
        mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
        mocks.getListingById.mockResolvedValue(makeListing());
        mocks.updateListing.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

        const result = await clientAction({
          params: { id: validId },
          request: makeFormData({
            intent: "update",
            title: "Test",
            description: "Test description",
            category: "electronics",
            basePrice: "100",
            securityDeposit: "50",
            minimumRentalPeriod: "1",
            location: JSON.stringify({ city: "KTM" }),
            photos: JSON.stringify(["img.jpg"]),
            deliveryOptions: JSON.stringify({ pickup: true }),
            features: JSON.stringify([]),
          }),
        } as any);

        expect(result).toEqual({
          error: "Listing request timed out. Try again.",
        });
      });

      it("requires title, description, and category", async () => {
        mocks.getUser.mockResolvedValue({ id: "owner-1", role: "owner" });
        mocks.getListingById.mockResolvedValue(makeListing());
        const result = await clientAction({
          params: { id: validId },
          request: makeFormData({
            intent: "update",
            title: "",
            description: "",
            category: "",
            basePrice: "100",
            securityDeposit: "50",
            minimumRentalPeriod: "1",
            location: JSON.stringify({ city: "KTM" }),
            photos: JSON.stringify(["img.jpg"]),
            deliveryOptions: JSON.stringify({ pickup: true }),
            features: JSON.stringify([]),
          }),
        } as any);
        expect(result).toEqual({
          error: "Title, description, and category are required",
        });
      });
    });
  });
});
