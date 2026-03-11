import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mocks ───────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getListingById: vi.fn(),
  getListingRequirement: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
}));

vi.mock("react-router", () => ({
  redirect: mocks.redirect,
  useLoaderData: vi.fn(),
  useNavigate: vi.fn(() => vi.fn()),
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
  },
}));
vi.mock("~/lib/api/upload", () => ({
  uploadApi: { uploadDocument: vi.fn() },
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
}));

import { clientLoader } from "./insurance.upload";

const VALID_UUID = "a1b2c3d4-e5f6-1234-a5b6-c7d8e9f0a1b2";

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("insurance.upload clientLoader", () => {
  it("redirects unauthenticated users", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({
      request: new Request(`http://localhost/insurance/upload?listingId=${VALID_UUID}`),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("redirects non-owner/non-admin to dashboard", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "renter" });
    const r = await clientLoader({
      request: new Request(`http://localhost/insurance/upload?listingId=${VALID_UUID}`),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/dashboard");
  });

  it("redirects on invalid UUID", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    const r = await clientLoader({
      request: new Request("http://localhost/insurance/upload?listingId=bad-id"),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/listings");
  });

  it("redirects when listing belongs to someone else", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getListingById.mockResolvedValue({ id: VALID_UUID, ownerId: "u2" });
    const r = await clientLoader({
      request: new Request(`http://localhost/insurance/upload?listingId=${VALID_UUID}`),
    } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/listings");
  });

  it("returns listing data for valid owner", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "owner" });
    mocks.getListingById.mockResolvedValue({ id: VALID_UUID, ownerId: "u1" });
    mocks.getListingRequirement.mockResolvedValue({ required: true, type: "general" });
    const r = (await clientLoader({
      request: new Request(`http://localhost/insurance/upload?listingId=${VALID_UUID}`),
    } as any)) as any;
    expect(r.listingId).toBe(VALID_UUID);
    expect(r.requirement.required).toBe(true);
  });

  it("admin can access any listing", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", role: "admin" });
    mocks.getListingById.mockResolvedValue({ id: VALID_UUID, ownerId: "u2" });
    mocks.getListingRequirement.mockResolvedValue({ required: false });
    const r = (await clientLoader({
      request: new Request(`http://localhost/insurance/upload?listingId=${VALID_UUID}`),
    } as any)) as any;
    expect(r.listingId).toBe(VALID_UUID);
  });
});
