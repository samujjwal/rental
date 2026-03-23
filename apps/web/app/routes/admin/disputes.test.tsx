import { AxiosError } from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon-stub" />);
const mocks = vi.hoisted(() => ({
  getDisputes: vi.fn(),
  updateDisputeStatus: vi.fn(),
  assignDispute: vi.fn(),
  updateDispute: vi.fn(),
  resolveDispute: vi.fn(),
  getDisputeById: vi.fn(),
  respondToDispute: vi.fn(),
  requireAdmin: vi.fn(),
  useLoaderData: vi.fn(),
  useActionData: vi.fn(),
  useNavigation: vi.fn(() => ({ state: "idle" })),
  useRevalidator: vi.fn(() => ({ revalidate: vi.fn(), state: "idle" })),
}));

vi.mock("react-router", () => ({
  useLoaderData: () => mocks.useLoaderData(),
  useActionData: () => mocks.useActionData(),
  useNavigation: () => mocks.useNavigation(),
  useRevalidator: () => mocks.useRevalidator(),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>{children}</a>
  ),
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
}));

vi.mock("~/lib/api/admin", () => ({
  adminApi: {
    getDisputes: (...args: any[]) => mocks.getDisputes(...args),
    updateDisputeStatus: (...args: any[]) => mocks.updateDisputeStatus(...args),
    assignDispute: (...args: any[]) => mocks.assignDispute(...args),
    updateDispute: (...args: any[]) => mocks.updateDispute(...args),
    resolveDispute: (...args: any[]) => mocks.resolveDispute(...args),
  },
}));

vi.mock("~/lib/api/disputes", () => ({
  disputesApi: {
    getDisputeById: (...args: any[]) => mocks.getDisputeById(...args),
    respondToDispute: (...args: any[]) => mocks.respondToDispute(...args),
  },
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...args: any[]) => mocks.requireAdmin(...args),
}));

vi.mock("~/components/ui", () => ({
  UnifiedButton: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: IconStub, XCircle: IconStub, User: IconStub, Calendar: IconStub,
  Banknote: IconStub, ChevronRight: IconStub, Search: IconStub, Loader2: IconStub,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import AdminDisputes, {
  clientLoader,
  clientAction,
  getAdminDisputesError,
} from "../admin/disputes";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return { formData: () => Promise.resolve(fd) } as unknown as Request;
}

const validId = "11111111-1111-1111-8111-111111111111";

describe("admin/disputes route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(undefined);
  });

  // ── clientLoader ──────────────────────────────────────────────────────

  describe("clientLoader", () => {
    it("loads disputes", async () => {
      const disputes = [{ id: "1", status: "OPEN" }];
      mocks.getDisputes.mockResolvedValue({
        disputes,
        total: 1,
        page: 1,
        limit: 50,
      });
      const result = await clientLoader({
        request: new Request("http://localhost/admin/disputes"),
      } as any);
      expect(result.disputes).toEqual(disputes);
      expect(result.error).toBeNull();
    });

    it("handles API error gracefully", async () => {
      mocks.getDisputes.mockRejectedValue(new Error("Server error"));
      const result = await clientLoader({
        request: new Request("http://localhost/admin/disputes"),
      } as any);
      expect(result.disputes).toEqual([]);
      expect(result.error).toBeTruthy();
    });

    it("extracts error message from nested response", async () => {
      mocks.getDisputes.mockRejectedValue({
        response: { data: { message: "Forbidden" } },
      });
      const result = await clientLoader({
        request: new Request("http://localhost/admin/disputes"),
      } as any);
      expect(result.error).toBe("Forbidden");
    });

    it("uses actionable offline copy on loader failure", async () => {
      const previousOnline = navigator.onLine;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      mocks.getDisputes.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

      const result = await clientLoader({
        request: new Request("http://localhost/admin/disputes"),
      } as any);

      expect(result.error).toBe("You appear to be offline. Reconnect and try again.");

      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: previousOnline,
      });
    });

    it("calls requireAdmin", async () => {
      mocks.getDisputes.mockResolvedValue({
        disputes: [],
        total: 0,
        page: 1,
        limit: 50,
      });
      await clientLoader({
        request: new Request("http://localhost/admin/disputes"),
      } as any);
      expect(mocks.requireAdmin).toHaveBeenCalled();
    });
  });

  // ── clientAction ──────────────────────────────────────────────────────

  describe("clientAction", () => {
    it("updates dispute status", async () => {
      mocks.updateDisputeStatus.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({
          intent: "set-status",
          disputeId: validId,
          status: "UNDER_REVIEW",
        }),
      } as any);
      expect(result.success).toBe(true);
      expect(mocks.updateDisputeStatus).toHaveBeenCalledWith(
        validId,
        "UNDER_REVIEW"
      );
    });

    it("rejects set-status with invalid disputeId", async () => {
      const result = await clientAction({
        request: makeFormData({
          intent: "set-status",
          disputeId: "",
          status: "OPEN",
        }),
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Dispute ID");
    });

    it("rejects set-status with invalid status", async () => {
      const result = await clientAction({
        request: makeFormData({
          intent: "set-status",
          disputeId: validId,
          status: "INVALID",
        }),
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid dispute status");
    });

    it("assigns dispute to admin", async () => {
      mocks.assignDispute.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({
          intent: "assign-to-me",
          disputeId: validId,
        }),
      } as any);
      expect(result.success).toBe(true);
      expect(mocks.assignDispute).toHaveBeenCalledWith(validId);
    });

    it("adds admin note", async () => {
      mocks.updateDispute.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({
          intent: "add-note",
          disputeId: validId,
          adminNote: "Investigating this issue",
        }),
      } as any);
      expect(result.success).toBe(true);
    });

    it("rejects short admin note", async () => {
      const result = await clientAction({
        request: makeFormData({
          intent: "add-note",
          disputeId: validId,
          adminNote: "ab",
        }),
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("at least 3");
    });

    it("sends message to dispute thread", async () => {
      mocks.respondToDispute.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({
          intent: "send-message",
          disputeId: validId,
          message: "Please provide evidence",
        }),
      } as any);
      expect(result.success).toBe(true);
    });

    it("rejects short message", async () => {
      const result = await clientAction({
        request: makeFormData({
          intent: "send-message",
          disputeId: validId,
          message: "hi",
        }),
      } as any);
      expect(result.success).toBe(false);
    });

    it("resolves dispute", async () => {
      mocks.resolveDispute.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({
          intent: "resolve-dispute",
          disputeId: validId,
          resolution: "Refund approved after review",
        }),
      } as any);
      expect(result.success).toBe(true);
    });

    it("resolves dispute with amount", async () => {
      mocks.resolveDispute.mockResolvedValue({});
      const result = await clientAction({
        request: makeFormData({
          intent: "resolve-dispute",
          disputeId: validId,
          resolution: "Partial refund issued",
          resolvedAmount: "500",
        }),
      } as any);
      expect(result.success).toBe(true);
      expect(mocks.resolveDispute).toHaveBeenCalledWith(
        validId,
        expect.objectContaining({ resolvedAmount: 500 })
      );
    });

    it("rejects negative resolved amount", async () => {
      const result = await clientAction({
        request: makeFormData({
          intent: "resolve-dispute",
          disputeId: validId,
          resolution: "Trying negative",
          resolvedAmount: "-100",
        }),
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("negative");
    });

    it("rejects short resolution note", async () => {
      const result = await clientAction({
        request: makeFormData({
          intent: "resolve-dispute",
          disputeId: validId,
          resolution: "ab",
        }),
      } as any);
      expect(result.success).toBe(false);
    });

    it("returns error for unknown intent", async () => {
      const result = await clientAction({
        request: makeFormData({
          intent: "unknown-action",
          disputeId: validId,
        }),
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown action");
    });

    it("handles API errors in set-status", async () => {
      mocks.updateDisputeStatus.mockRejectedValue(
        new Error("Server failure")
      );
      const result = await clientAction({
        request: makeFormData({
          intent: "set-status",
          disputeId: validId,
          status: "OPEN",
        }),
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("handles API errors in assign-to-me", async () => {
      mocks.assignDispute.mockRejectedValue(new Error("fail"));
      const result = await clientAction({
        request: makeFormData({
          intent: "assign-to-me",
          disputeId: validId,
        }),
      } as any);
      expect(result.success).toBe(false);
    });

    it("uses actionable offline copy for action failures", async () => {
      const previousOnline = navigator.onLine;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      mocks.updateDisputeStatus.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));

      const result = await clientAction({
        request: makeFormData({
          intent: "set-status",
          disputeId: validId,
          status: "UNDER_REVIEW",
        }),
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe("You appear to be offline. Reconnect and try again.");

      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: previousOnline,
      });
    });

    it("preserves backend response messages in helper", () => {
      expect(
        getAdminDisputesError({ response: { data: { message: "Escalation limit reached" } } }, "fallback")
      ).toBe("Escalation limit reached");
    });
  });

  // ── Component render tests ────────────────────────────────────────────

  describe("AdminDisputes component", () => {
    beforeEach(() => {
      mocks.useActionData.mockReturnValue(null);
    });

    it("renders disputes list", () => {
      mocks.useLoaderData.mockReturnValue({
        disputes: [
          {
            id: validId,
            status: "OPEN",
            reason: "Item damaged",
            createdAt: "2025-01-01",
            booking: { id: "b-1" },
            reporter: { firstName: "Ram", lastName: "Shrestha" },
          },
        ],
        pagination: { total: 1, page: 1, limit: 50 },
        error: null,
      });
      render(<AdminDisputes />);
      expect(screen.getAllByText(/Item damaged|OPEN|Ram/i).length).toBeGreaterThan(0);
    });

    it("renders error state", () => {
      mocks.useLoaderData.mockReturnValue({
        disputes: [],
        pagination: null,
        error: "Failed to load disputes",
      });
      render(<AdminDisputes />);
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });

    it("renders empty state", () => {
      mocks.useLoaderData.mockReturnValue({
        disputes: [],
        pagination: { total: 0, page: 1, limit: 50 },
        error: null,
      });
      render(<AdminDisputes />);
      expect(
        screen.getByText(/no dispute|no open/i) ||
          document.querySelector("[data-testid]")
      ).toBeTruthy();
    });
  });
});
