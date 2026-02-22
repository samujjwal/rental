import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, useRevalidator } from "react-router";
import { useMemo } from "react";
import { AlertCircle, Search } from "lucide-react";
import { adminApi, type AuditLogEntry } from "~/lib/api/admin";
import { UnifiedButton , RouteErrorBoundary } from "~/components/ui";
import { requireAdmin } from "~/utils/auth";

export const meta: MetaFunction = () => {
  return [
    { title: "Audit Logs | Admin" },
    { name: "description", content: "Review admin audit logs" },
  ];
};

const safeDateTimeLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const rawPage = Number(url.searchParams.get("page") || "1");
  const rawLimit = Number(url.searchParams.get("limit") || "25");
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 100
      ? Math.floor(rawLimit)
      : 25;
  const rawAction = url.searchParams.get("action") || "";
  const rawUserId = url.searchParams.get("userId") || "";
  const action = rawAction.trim() || undefined;
  const userId = rawUserId.trim() || undefined;

  try {
    const logs = await adminApi.getAuditLogs({ page, limit, action, userId });
    return {
      logs: logs.logs || [],
      total: logs.total || 0,
      page: logs.page || page,
      limit: logs.limit || limit,
      error: null,
    };
  } catch (error: unknown) {
    return {
      logs: [],
      total: 0,
      page,
      limit,
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load audit logs",
    };
  }
}

function getEntityLink(entity: unknown, entityId?: string) {
  const entityMap: Record<string, string> = {
    user: "/admin/entities/users",
    listing: "/admin/entities/listings",
    booking: "/admin/entities/bookings",
    dispute: "/admin/disputes",
    payment: "/admin/entities/payments",
    organization: "/admin/entities/organizations",
  };

  const normalized = String(entity || "").toLowerCase();
  const base = entityMap[normalized];
  if (!base) return undefined;
  return entityId ? `${base}?search=${entityId}` : base;
}

export default function AuditLogsPage() {
  const { logs, total, page, limit, error } = useLoaderData<typeof clientLoader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const currentAction = searchParams.get("action") || "";
  const currentUserId = searchParams.get("userId") || "";

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  };

  const rows = useMemo(() => logs as AuditLogEntry[], [logs]);

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Unable to load audit logs
            </h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <UnifiedButton onClick={() => revalidator.revalidate()}>Try Again</UnifiedButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            to="/admin/system"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to System Settings
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-2">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Security and admin activity history</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-card border rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground">Action</label>
              <input
                type="text"
                value={currentAction}
                onChange={(e) => handleFilterChange("action", e.target.value)}
                placeholder="e.g. create, suspend, update"
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 bg-background"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-muted-foreground">User ID</label>
              <input
                type="text"
                value={currentUserId}
                onChange={(e) => handleFilterChange("userId", e.target.value)}
                placeholder="Filter by admin user ID"
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 bg-background"
              />
            </div>
            {(currentAction || currentUserId) && (
              <UnifiedButton
                variant="outline"
                onClick={() => setSearchParams(new URLSearchParams())}
              >
                Clear Filters
              </UnifiedButton>
            )}
          </div>
        </div>

        <div className="bg-card border rounded-lg overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3" />
              No audit logs found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">When</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entity</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Admin</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((log) => {
                    const link = getEntityLink(log.entity, log.entityId);
                    return (
                      <tr key={log.id} className="hover:bg-muted/40">
                        <td className="px-4 py-3 text-muted-foreground">
                          {safeDateTimeLabel(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {log.action}
                        </td>
                        <td className="px-4 py-3">
                          {link ? (
                            <Link to={link} className="text-primary hover:underline">
                              {log.entity} #{log.entityId}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">
                              {log.entity} #{log.entityId}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{log.userEmail}</td>
                        <td className="px-4 py-3 text-muted-foreground">{log.ipAddress}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <UnifiedButton
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </UnifiedButton>
                <UnifiedButton
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </UnifiedButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

