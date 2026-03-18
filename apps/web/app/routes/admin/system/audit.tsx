import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, Link, useRevalidator } from "react-router";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { AlertCircle, Search } from "lucide-react";
import { adminApi, type AuditLogEntry } from "~/lib/api/admin";
import { UnifiedButton , RouteErrorBoundary } from "~/components/ui";
import { requireAdmin } from "~/utils/auth";
import { formatDateTime } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Audit Logs | Admin" },
    { name: "description", content: "Review admin audit logs" },
  ];
};

const safeDateTimeLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown date" : formatDateTime(date);
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
    payout: "/admin/entities/payments",
    refund: "/admin/entities/payments",
    deposit_release: "/admin/entities/payments",
    organization: "/admin/entities/organizations",
  };

  const normalized = String(entity || "").toLowerCase();
  const base = entityMap[normalized];
  if (!base) return undefined;
  return entityId ? `${base}?search=${entityId}` : base;
}

export default function AuditLogsPage() {
  const { t } = useTranslation();
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
              {t("admin.unableToLoadAuditLogs")}
            </h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <UnifiedButton onClick={() => revalidator.revalidate()}>{t("admin.tryAgain")}</UnifiedButton>
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
            {t("admin.backToSystemSettings")}
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-2">{t("admin.auditLogs")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.activityHistory")}</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-card border rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground">{t("admin.action")}</label>
              <input
                type="text"
                value={currentAction}
                onChange={(e) => handleFilterChange("action", e.target.value)}
                placeholder={t("admin.actionPlaceholder")}
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 bg-background"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-muted-foreground">{t("admin.userId")}</label>
              <input
                type="text"
                value={currentUserId}
                onChange={(e) => handleFilterChange("userId", e.target.value)}
                placeholder={t("admin.userIdPlaceholder")}
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 bg-background"
              />
            </div>
            {(currentAction || currentUserId) && (
              <UnifiedButton
                variant="outline"
                onClick={() => setSearchParams(new URLSearchParams())}
              >
                {t("admin.clearFilters")}
              </UnifiedButton>
            )}
          </div>
        </div>

        <div className="bg-card border rounded-lg overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3" />
              {t("admin.noAuditLogsFound")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.when")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.action")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.entityColumn")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.adminColumn")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.ip")}</th>
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
                          <div>{log.action}</div>
                          {log.command?.failureReason ? (
                            <div className="text-xs text-destructive mt-1">{log.command.failureReason}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {log.command?.status ? (
                            <div className="space-y-1">
                              <span
                                className={[
                                  "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                                  log.command.attentionRequired
                                    ? "bg-amber-100 text-amber-900"
                                    : log.command.status === "COMPLETED"
                                      ? "bg-emerald-100 text-emerald-900"
                                      : log.command.status === "FAILED"
                                        ? "bg-red-100 text-red-900"
                                        : "bg-slate-100 text-slate-900",
                                ].join(" ")}
                              >
                                {log.command.status}
                              </span>
                              <div className="text-xs text-muted-foreground">
                                {typeof log.command.amount === "number"
                                  ? `${log.command.amount} ${log.command.currency || ""}`.trim()
                                  : null}
                              </div>
                              {log.command.attentionRequired ? (
                                <div className="text-xs text-amber-700">Needs review</div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
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
                {t("admin.pageOf", { current: page, total: totalPages })}
              </p>
              <div className="flex gap-2">
                <UnifiedButton
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  {t("admin.previous")}
                </UnifiedButton>
                <UnifiedButton
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  {t("admin.next")}
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

