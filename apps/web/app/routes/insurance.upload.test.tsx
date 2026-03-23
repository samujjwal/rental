import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AxiosError } from "axios";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getListingById: vi.fn(),
  getListingRequirement: vi.fn(),
  uploadPolicy: vi.fn(),
  uploadDocument: vi.fn(),
  useLoaderData: vi.fn(),
  navigate: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
}));

vi.mock("react-router", () => ({
  redirect: mocks.redirect,
  useLoaderData: () => mocks.useLoaderData(),
  useNavigate: () => mocks.navigate,
  useRevalidator: () => ({ revalidate: mocks.revalidate }),
}));
vi.mock("~/utils/auth", () => ({
  getUser: (...a: any[]) => mocks.getUser(...a),
}));
vi.mock("~/lib/api/listings", () => ({
  listingsApi: {
    getListingById: (...a: any[]) => mocks.getListingById(...a),
  },
}));
vi.mock("~/lib/api/insurance", () => ({
  insuranceApi: {
    getListingRequirement: (...a: any[]) => mocks.getListingRequirement(...a),
    uploadPolicy: (...a: any[]) => mocks.uploadPolicy(...a),
  },
}));
vi.mock("~/lib/api/upload", () => ({
  uploadApi: { uploadDocument: (...a: any[]) => mocks.uploadDocument(...a) },
}));
vi.mock("~/lib/utils", () => ({
  cn: (...a: any[]) => a.filter(Boolean).join(" "),
  formatCurrency: (v: number) => `NPR ${v}`,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock("~/components/ui", () => ({
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  UnifiedButton: ({ children, loading, ...props }: any) => <button {...props}>{children}</button>,
}));

import InsuranceUpload, {
  clientLoader,
  getInsuranceUploadLoadError,
  getInsuranceUploadDocumentError,
  getInsuranceUploadSubmitError,
  isAllowedInsuranceDocument,
} from "./insurance.upload";

const VALID_ID = "ckx1234567890abcdefghijkl";

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("insurance.upload clientLoader", () => {
  it("redirects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request(`http://localhost/insurance/upload?listingId=${VALID_ID}`),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects non-owner/non-admin to dashboard", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
    const r = await clientLoader({
      request: new Request(`http://localhost/insurance/upload?listingId=${VALID_ID}`),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/dashboard");
  });

  it("redirects on invalid listing id", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const r = await clientLoader({
      request: new Request("http://localhost/insurance/upload?listingId=bad-id"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/listings");
  });

  it("redirects when listing belongs to someone else", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getListingById.mockResolvedValue({ id: VALID_ID, ownerId: "u2" });
    const r = await clientLoader({
      request: new Request(`http://localhost/insurance/upload?listingId=${VALID_ID}`),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/listings");
  });

  it("returns listing data for valid owner", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getListingById.mockResolvedValue({ id: VALID_ID, ownerId: "u1" });
    mocks.getListingRequirement.mockResolvedValue({ required: true, type: "general" });
    const r = (await clientLoader({
      request: new Request(`http://localhost/insurance/upload?listingId=${VALID_ID}`),
    } as any)) as any;
    expect(r.listingId).toBe(VALID_ID);
    expect(r.requirement.required).toBe(true);
  });

  it("admin can access any listing", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "admin" });
    mocks.getListingById.mockResolvedValue({ id: VALID_ID, ownerId: "u2" });
    mocks.getListingRequirement.mockResolvedValue({ required: false });
    const r = (await clientLoader({
      request: new Request(`http://localhost/insurance/upload?listingId=${VALID_ID}`),
    } as any)) as any;
    expect(r.listingId).toBe(VALID_ID);
  });

  it("returns actionable fallback loader state on recoverable API error", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getListingById.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const r = (await clientLoader({
      request: new Request(`http://localhost/insurance/upload?listingId=${VALID_ID}`),
    } as any)) as any;

    expect(r).toEqual({
      listingId: VALID_ID,
      requirement: null,
      error: "Loading the insurance upload form timed out. Try again.",
    });
  });
});

describe("insurance.upload component", () => {
  beforeEach(() => {
    mocks.useLoaderData.mockReturnValue({
      listingId: VALID_ID,
      requirement: { required: false, type: "COMPREHENSIVE", minimumCoverage: 0 },
      error: null,
    });
  });

  it("maps offline loader failures to actionable copy", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    expect(getInsuranceUploadLoadError(new AxiosError("Network Error", "ERR_NETWORK"))).toBe(
      "You appear to be offline. Reconnect and try loading the insurance form again."
    );
  });

  it("renders retryable fallback UI when loader data has no requirement", () => {
    mocks.useLoaderData.mockReturnValue({
      listingId: VALID_ID,
      requirement: null,
      error: "Loading the insurance upload form timed out. Try again.",
    });

    render(<InsuranceUpload />);

    expect(screen.getByText("Insurance upload unavailable")).toBeInTheDocument();
    expect(screen.getByText("Loading the insurance upload form timed out. Try again.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });

  it("associates the insurance document label with its input", () => {
    render(<InsuranceUpload />);
    expect(screen.getByLabelText("pages.insurance.insuranceDocument")).toHaveAttribute("id", "document");
  });

  it("preserves backend response messages on submit failure", () => {
    expect(
      getInsuranceUploadSubmitError({ response: { data: { message: "Policy number already exists" } } })
    ).toBe("Policy number already exists");
  });

  it("shows actionable offline copy when submit fails without a backend message", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    expect(getInsuranceUploadSubmitError(new AxiosError("Network Error", "ERR_NETWORK"))).toBe(
      "You appear to be offline. Reconnect and try again."
    );
  });

  it("shows timeout-specific helper copy when submit fails", () => {
    expect(getInsuranceUploadSubmitError(new AxiosError("timeout", "ECONNABORTED"))).toBe(
      "Uploading the insurance policy timed out. Try again."
    );
  });

  it("shows timeout-specific helper copy when document upload fails", () => {
    expect(getInsuranceUploadDocumentError(new AxiosError("timeout", "ECONNABORTED"))).toBe(
      "Uploading the insurance document timed out. Try again."
    );
  });

  it("preserves backend response messages when document upload fails", () => {
    expect(
      getInsuranceUploadDocumentError({
        response: { data: { message: "Document virus scan is still pending" } },
      })
    ).toBe("Document virus scan is still pending");
  });

  it("accepts valid document extensions even when the browser does not provide a MIME type", () => {
    const file = new File(["policy"], "policy.pdf", { type: "" });

    expect(isAllowedInsuranceDocument(file)).toBe(true);
  });

  it("shows actionable submit error when uploadPolicy times out", async () => {
    mocks.uploadDocument.mockResolvedValue({ url: "https://example.com/policy.pdf" });
    mocks.uploadPolicy.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const file = new File(["policy"], "policy.pdf", { type: "" });
    const OriginalFormData = globalThis.FormData;
    class MockFormData extends OriginalFormData {
      constructor(form?: HTMLFormElement) {
        super();

        if (form) {
          this.set("policyNumber", "POL-123456");
          this.set("provider", "Nepal Insurance");
          this.set("type", "COMPREHENSIVE");
          this.set("coverageAmount", "50000");
          this.set("effectiveDate", "2026-03-18");
          this.set("expirationDate", "2027-03-18");
          this.set("document", file);
        }
      }
    }
    globalThis.FormData = MockFormData as typeof FormData;

    try {
      render(<InsuranceUpload />);

      fireEvent.submit(screen.getByRole("button", { name: "pages.insurance.submitForVerification" }).closest("form")!);

      await waitFor(() => {
        expect(mocks.uploadPolicy).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(screen.getByText("Uploading the insurance policy timed out. Try again.")).toBeInTheDocument();
      });
    } finally {
      globalThis.FormData = OriginalFormData;
    }
  });

  it("shows actionable document upload error when uploadDocument times out", async () => {
    mocks.uploadDocument.mockRejectedValue(new AxiosError("timeout", "ECONNABORTED"));

    const file = new File(["policy"], "policy.pdf", { type: "" });
    const OriginalFormData = globalThis.FormData;
    class MockFormData extends OriginalFormData {
      constructor(form?: HTMLFormElement) {
        super();

        if (form) {
          this.set("policyNumber", "POL-123456");
          this.set("provider", "Nepal Insurance");
          this.set("type", "COMPREHENSIVE");
          this.set("coverageAmount", "50000");
          this.set("effectiveDate", "2026-03-18");
          this.set("expirationDate", "2027-03-18");
          this.set("document", file);
        }
      }
    }
    globalThis.FormData = MockFormData as typeof FormData;

    try {
      render(<InsuranceUpload />);

      fireEvent.submit(screen.getByRole("button", { name: "pages.insurance.submitForVerification" }).closest("form")!);

      await waitFor(() => {
        expect(screen.getByText("Uploading the insurance document timed out. Try again.")).toBeInTheDocument();
      });

      expect(mocks.uploadPolicy).not.toHaveBeenCalled();
    } finally {
      globalThis.FormData = OriginalFormData;
    }
  });
});
