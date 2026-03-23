import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const entityHookState = vi.hoisted(() => ({
  setAuth: vi.fn(),
  updateTableState: vi.fn(),
  fetchDetail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteEntity: vi.fn(),
  refresh: vi.fn(),
}));

const IconStub = vi.hoisted(() => (props: any) => <span data-testid="icon" />);
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("react-router", () => ({
  useParams: vi.fn(() => ({ entity: "users" })),
  useLoaderData: vi.fn(() => ({ user: {}, accessToken: "t", refreshToken: "r" })),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  redirect: (...a: any[]) => m.redirect(...a),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (typeof options === "string") return options;
      if (options?.defaultValue) {
        return String(options.defaultValue).replace("{{id}}", String(options.id ?? ""));
      }
      if (options?.name) return `${key}:${options.name}`;
      return key;
    },
  }),
}));

vi.mock("~/utils/auth", () => ({
  requireAdmin: (...a: any[]) => m.requireAdmin(...a),
  getSession: (...a: any[]) => m.getSession(...a),
}));

vi.mock("~/lib/store/auth", () => ({
  useAuthStore: vi.fn(() => ({ setAuth: entityHookState.setAuth })),
}));

vi.mock("~/hooks/useAdminEntity", () => ({
  useAdminEntity: vi.fn(() => ({
    entityConfig: {
      name: "User",
      pluralName: "Users",
      description: "Manage users",
      columns: [],
      fields: [],
      filters: [],
    },
    isConfigLoading: false,
    configError: null,
    data: [{ id: "user-1", name: "Alice" }],
    total: 1,
    isDataLoading: false,
    dataError: null,
    tableState: {
      sorting: [],
      filters: {},
      search: "",
      pagination: { page: 1, limit: 25 },
    },
    updateTableState: entityHookState.updateTableState,
    fetchDetail: entityHookState.fetchDetail,
    create: entityHookState.create,
    update: entityHookState.update,
    delete: entityHookState.deleteEntity,
    refresh: entityHookState.refresh,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  })),
}));

vi.mock("~/components/admin/enhanced", () => ({
  EnhancedDataTable: ({ error, onRowDelete }: any) => (
    <div data-testid="data-table">
      {error ? <div>{error}</div> : null}
      <button type="button" onClick={() => onRowDelete?.({ id: "user-1", name: "Alice" })}>
        open delete
      </button>
    </div>
  ),
  EnhancedForm: () => <div data-testid="form" />,
}));

vi.mock("~/components/ui", () => ({
  Dialog: ({ open, title, children }: any) =>
    open ? (
      <div role="dialog">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  UnifiedButton: ({ children, loading, ...props }: any) => (
    <button type="button" {...props} aria-busy={loading ? "true" : undefined}>
      {children}
    </button>
  ),
  RouteErrorBoundary: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  ChevronRight: IconStub, Loader2: IconStub,
}));

import ModernDynamicEntityPage, {
  clientLoader,
  getAdminEntityActionError,
} from "./[entity]";

describe("admin/entities/[entity]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireAdmin.mockResolvedValue({ id: "u1", role: "admin" });
    m.getSession.mockResolvedValue({
      get: (k: string) => (k === "accessToken" ? "tok" : "ref"),
    });
    m.redirect.mockImplementation((url: string) => new Response(null, { status: 302, headers: { Location: url } }));
    entityHookState.setAuth.mockReset();
    entityHookState.updateTableState.mockReset();
    entityHookState.fetchDetail.mockReset();
    entityHookState.create.mockReset();
    entityHookState.update.mockReset();
    entityHookState.deleteEntity.mockReset();
    entityHookState.refresh.mockReset();
  });

  it("redirects for invalid entity", async () => {
    const res = await clientLoader({
      request: new Request("http://l/admin/entities/invalid"),
    } as any);
    expect(m.redirect).toHaveBeenCalledWith("/admin");
  });

  it("loads for valid entity (users)", async () => {
    const res = await clientLoader({
      request: new Request("http://l/admin/entities/users"),
    } as any);
    expect(res).toEqual(
      expect.objectContaining({ accessToken: "tok", refreshToken: "ref" })
    );
  });

  it("loads for valid entity (listings)", async () => {
    const res = await clientLoader({
      request: new Request("http://l/admin/entities/listings"),
    } as any);
    expect(m.requireAdmin).toHaveBeenCalled();
  });

  it("loads for valid entity (bookings)", async () => {
    await clientLoader({
      request: new Request("http://l/admin/entities/bookings"),
    } as any);
    expect(m.requireAdmin).toHaveBeenCalled();
  });

  it("loads for valid entity (reviews)", async () => {
    await clientLoader({
      request: new Request("http://l/admin/entities/reviews"),
    } as any);
    expect(m.requireAdmin).toHaveBeenCalled();
  });

  it("loads for valid entity (insurance)", async () => {
    await clientLoader({
      request: new Request("http://l/admin/entities/insurance"),
    } as any);
    expect(m.requireAdmin).toHaveBeenCalled();
  });

  it("preserves backend mutation messages", () => {
    expect(
      getAdminEntityActionError(
        { response: { data: { message: "Cannot delete protected record" } } },
        "Failed to delete this record"
      )
    ).toBe("Cannot delete protected record");
  });

  it("opens a shared delete dialog instead of using window.confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    entityHookState.deleteEntity.mockRejectedValueOnce({
      response: { data: { message: "Cannot delete protected record" } },
    });

    render(<ModernDynamicEntityPage />);

    fireEvent.click(screen.getByRole("button", { name: /open delete/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Record ID: user-1/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(entityHookState.deleteEntity).toHaveBeenCalledWith("user-1");
    });
    expect((await screen.findAllByText(/Cannot delete protected record/i)).length).toBeGreaterThan(0);
  });
});
