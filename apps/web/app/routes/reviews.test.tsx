import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/* ------------------------------------------------------------------ */
const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
vi.mock("lucide-react", () => ({
  Star: IconStub, User: IconStub, Package: IconStub, AlertCircle: IconStub,
  CheckCircle: IconStub, Clock: IconStub,
}));

/* ------------------------------------------------------------------ */
const mocks: Record<string, any> = {
  getUser: vi.fn(),
  getUserReviews: vi.fn(),
  deleteReview: vi.fn(),
  redirect: vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
};

vi.mock("react-router", () => ({
  Link: ({ children, to, ...p }: any) => <a href={to} {...p}>{children}</a>,
  redirect: (...a: any[]) => mocks.redirect(...a),
  useLoaderData: () => ({}),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useActionData: () => null,
}));
vi.mock("~/utils/auth", () => ({ getUser: (...a: any[]) => mocks.getUser(...a) }));
vi.mock("~/lib/api/reviews", () => ({
  reviewsApi: {
    getUserReviews: (...a: any[]) => mocks.getUserReviews(...a),
    deleteReview: (...a: any[]) => mocks.deleteReview(...a),
  },
}));
vi.mock("date-fns", () => ({ format: () => "2024-01-01" }));
vi.mock("~/lib/utils", () => ({ cn: (...a: string[]) => a.filter(Boolean).join(" ") }));
vi.mock("~/components/ui", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
  UnifiedButton: ({ children, ...p }: any) => <button {...p}>{children}</button>,
}));
vi.mock("~/components/ui/skeleton", () => ({
  Skeleton: () => <div />,
}));
vi.mock("~/types/review", () => ({}));

const validId = "11111111-1111-1111-8111-111111111111";

function makeFormReq(fields: Record<string, string>, url = "http://localhost/reviews") {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return {
    url,
    formData: () => Promise.resolve(fd),
  } as unknown as Request;
}

import { clientLoader, clientAction } from "./reviews";

const authUser = { id: "u1", email: "u@test.com", role: "renter" };
const mockReviews = [
  { id: "r1", overallRating: 5, rating: 5, status: "PUBLISHED", comment: "Great" },
  { id: "r2", overallRating: 3, rating: 3, status: "PUBLISHED", comment: "OK" },
  { id: "r3", overallRating: 5, rating: 5, status: "DRAFT", comment: "Draft" },
];

beforeEach(() => vi.clearAllMocks());

/* ================================================================== */
/*  clientLoader                                                       */
/* ================================================================== */
describe("clientLoader", () => {
  it("redirects unauthenticated", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientLoader({ request: new Request("http://localhost/reviews") } as any);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/auth/login");
  });

  it("defaults to 'received' view", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getUserReviews.mockResolvedValue({ reviews: [], total: 0 });
    const r = (await clientLoader({ request: new Request("http://localhost/reviews") } as any)) as any;
    expect(r.view).toBe("received");
    expect(mocks.getUserReviews).toHaveBeenCalledWith("u1", "received", 1, 10, undefined);
  });

  it("passes view=given from query", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getUserReviews.mockResolvedValue({ reviews: [], total: 0 });
    await clientLoader({ request: new Request("http://localhost/reviews?view=given") } as any);
    expect(mocks.getUserReviews).toHaveBeenCalledWith("u1", "given", 1, 10, undefined);
  });

  it("calculates stats from reviews", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getUserReviews.mockResolvedValue({ reviews: mockReviews, total: 3 });
    const r = (await clientLoader({ request: new Request("http://localhost/reviews") } as any)) as any;
    expect(r.stats.total).toBe(3);
    expect(r.stats.ratings[5]).toBe(2);
    expect(r.stats.ratings[3]).toBe(1);
    expect(r.stats.pending).toBe(1); // 1 DRAFT
    expect(r.stats.averageRating).toBeCloseTo(4.33, 1);
  });

  it("filters by rating when specified", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    // Server-side filtering: getUserReviews now receives rating=5 and returns only matching
    const filtered = mockReviews.filter(r => r.rating === 5);
    mocks.getUserReviews.mockResolvedValue({ reviews: filtered, total: 2 });
    const r = (await clientLoader({ request: new Request("http://localhost/reviews?rating=5") } as any)) as any;
    expect(mocks.getUserReviews).toHaveBeenCalledWith("u1", "received", 1, 10, 5);
    expect(r.reviews).toHaveLength(2); // two 5-star reviews
  });

  it("clamps page between 1 and 1000", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getUserReviews.mockResolvedValue({ reviews: [], total: 0 });
    await clientLoader({ request: new Request("http://localhost/reviews?page=5000") } as any);
    expect(mocks.getUserReviews).toHaveBeenCalledWith("u1", "received", 1000, 10, undefined);
  });

  it("returns empty state on API error", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.getUserReviews.mockRejectedValue(new Error("fail"));
    const r = (await clientLoader({ request: new Request("http://localhost/reviews") } as any)) as any;
    expect(r.reviews).toEqual([]);
    expect(r.error).toBeTruthy();
  });
});

/* ================================================================== */
/*  clientAction                                                       */
/* ================================================================== */
describe("clientAction", () => {
  it("redirects unauthenticated", async () => {
    mocks.getUser.mockResolvedValue(null);
    const r = await clientAction({ request: makeFormReq({ intent: "delete" }) } as any);
    expect(r).toBeInstanceOf(Response);
  });

  it("rejects unknown intent", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({ request: makeFormReq({ intent: "hack" }) } as any);
    expect((r as any).message).toMatch(/unknown/i);
  });

  it("rejects invalid reviewId UUID", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({ request: makeFormReq({ intent: "delete", reviewId: "bad" }) } as any);
    expect((r as any).message).toMatch(/missing review/i);
  });

  it("blocks delete for received reviews", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    const r = await clientAction({
      request: makeFormReq({ intent: "delete", reviewId: validId, view: "received" }),
    } as any);
    expect((r as any).message).toMatch(/only authored/i);
  });

  it("deletes review successfully", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.deleteReview.mockResolvedValue({});
    const r = await clientAction({
      request: makeFormReq({ intent: "delete", reviewId: validId, view: "given" }),
    } as any);
    expect((r as any).success).toBe(true);
    expect(mocks.deleteReview).toHaveBeenCalledWith(validId);
  });

  it("handles API error on delete", async () => {
    mocks.getUser.mockResolvedValue(authUser);
    mocks.deleteReview.mockRejectedValue(new Error("Not found"));
    const r = await clientAction({
      request: makeFormReq({ intent: "delete", reviewId: validId, view: "given" }),
    } as any);
    expect((r as any).success).toBe(false);
    expect((r as any).message).toBe("Not found");
  });
});
