import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  Settings,
  Zap,
  Database,
  Bell,
  Mail,
  Server,
  Shield,
  Key,
  Activity,
  HardDrive,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { adminApi } from "~/lib/api/admin";
import { requireAdmin } from "~/utils/auth";
import { RouteErrorBoundary } from "~/components/ui";
import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export const meta: MetaFunction = () => {
  return [
    { title: "System Settings | Admin" },
    { name: "description", content: "System configuration and settings" },
  ];
};

export function getSystemSettingsLoadError(error: unknown): string {
  return getActionableErrorMessage(error, "Failed to load system settings", {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Loading system settings timed out. Try again.",
  });
}

function formatUptime(systemHealth: { uptime?: number; processUptimeSeconds?: number } | null) {
  if (!systemHealth) {
    return "0%";
  }

  if (typeof systemHealth.processUptimeSeconds === "number") {
    const totalSeconds = systemHealth.processUptimeSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  return `${systemHealth.uptime || 0}%`;
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  try {
    const [generalSettings, systemHealth, databaseInfo] = await Promise.all([
      adminApi.getGeneralSettings(),
      adminApi.getSystemHealth(),
      adminApi.getDatabaseInfo(),
    ]);

    return {
      generalSettings,
      systemHealth,
      databaseInfo,
      error: null,
    };
  } catch (error: unknown) {
    return {
      generalSettings: null,
      systemHealth: null,
      databaseInfo: null,
      error: getSystemSettingsLoadError(error),
    };
  }
}

interface SettingsCategory {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  status?: "active" | "warning" | "error";
  stats?: { label: string; value: string | number }[];
}

export default function SystemSettingsPage() {
  const { t } = useTranslation();
  const { generalSettings, systemHealth, databaseInfo, error } =
    useLoaderData<typeof clientLoader>();

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(["core", "infrastructure", "security", "monitoring"])
  );

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const settingsCategories: SettingsCategory[] = [
    {
      title: t("admin.generalSettings"),
      description: t("admin.generalSettingsDesc"),
      icon: Settings,
      href: "/admin/system/general",
      status: "active",
      stats: [
        {
          label: t("admin.siteName"),
          value:
            typeof generalSettings?.siteName === "string" && generalSettings.siteName.trim()
              ? generalSettings.siteName
              : "GharBatai Rentals",
        },
        {
          label: t("admin.maintenance"),
          value:
            (generalSettings as { maintenanceMode?: unknown } | null)?.maintenanceMode
              ? "ON"
              : "OFF",
        },
      ],
    },
    {
      title: t("admin.powerOperations"),
      description: t("admin.powerOperationsDesc"),
      icon: Zap,
      href: "/admin/system/power-operations",
      status: systemHealth?.services?.database?.status === "healthy" ? "active" : "warning",
      stats: [
        { label: t("admin.apiStatus"), value: systemHealth?.status || "Unknown" },
        { label: t("admin.uptime"), value: formatUptime(systemHealth) },
      ],
    },
    {
      title: t("admin.databaseManagement"),
      description: t("admin.databaseManagementDesc"),
      icon: Database,
      href: "/admin/system/database",
      status: systemHealth?.services?.database?.status === "healthy" ? "active" : "warning",
      stats: [
        { label: t("admin.status"), value: systemHealth?.services?.database?.status || "Unknown" },
        {
          label: t("admin.connections"),
          value: `${databaseInfo?.connections || 0}`,
        },
      ],
    },
    {
      title: t("admin.notificationSettings"),
      description: t("admin.notificationSettingsDesc"),
      icon: Bell,
      href: "/admin/system/notifications",
      status: "active",
    },
    {
      title: t("admin.securitySettings"),
      description: t("admin.securitySettingsDesc"),
      icon: Shield,
      href: "/admin/system/security",
      status: "active",
    },
    {
      title: t("admin.apiKeys"),
      description: t("admin.apiKeysDesc"),
      icon: Key,
      href: "/admin/system/api-keys",
      status: "active",
    },
    {
      title: t("admin.emailService"),
      description: t("admin.emailServiceDesc"),
      icon: Mail,
      href: "/admin/system/email",
      status: "active",
    },
    {
      title: t("admin.environmentVariables"),
      description: t("admin.environmentVariablesDesc"),
      icon: Server,
      href: "/admin/system/environment",
      status: "active",
    },
    {
      title: t("admin.systemLogs"),
      description: t("admin.systemLogsDesc"),
      icon: Activity,
      href: "/admin/system/logs",
      status: "active",
    },
    {
      title: t("admin.backupManagement"),
      description: t("admin.backupManagementDesc"),
      icon: HardDrive,
      href: "/admin/system/backups",
      status: "active",
    },
  ];

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">{t("admin.errorLoadingSystemSettings")}</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("admin.systemSettings")}</h1>
        <p className="text-gray-600">
          {t("admin.systemSettingsDesc")}
        </p>
      </div>

      {/* System Health Overview */}
      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t("admin.apiStatus")}</p>
                <p className="text-2xl font-bold text-green-600">
                  {systemHealth.status || "Unknown"}
                </p>
              </div>
              <Server className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t("admin.database")}</p>
                <p className="text-2xl font-bold text-green-600">
                  {systemHealth.services?.database?.status || "Unknown"}
                </p>
              </div>
              <Database className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t("admin.uptime")}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatUptime(systemHealth)}
                </p>
              </div>
              <Activity className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t("admin.cacheStatus")}</p>
                <p className="text-2xl font-bold text-green-600">
                  {systemHealth.services?.redis?.status || "N/A"}
                </p>
              </div>
              <Zap className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </div>
      )}

      {/* Settings Categories — Grouped Accordion */}
      {(() => {
        const groups: { key: string; title: string; hrefs: string[] }[] = [
          {
            key: "core",
            title: t("admin.groupCore", "Core Settings"),
            hrefs: ["/admin/system/general", "/admin/system/notifications", "/admin/system/email"],
          },
          {
            key: "infrastructure",
            title: t("admin.groupInfrastructure", "Infrastructure"),
            hrefs: ["/admin/system/database", "/admin/system/backups", "/admin/system/environment"],
          },
          {
            key: "security",
            title: t("admin.groupSecurity", "Security & Access"),
            hrefs: ["/admin/system/security", "/admin/system/api-keys"],
          },
          {
            key: "monitoring",
            title: t("admin.groupMonitoring", "Monitoring & Operations"),
            hrefs: ["/admin/system/logs", "/admin/system/power-operations"],
          },
        ];

        return (
          <div className="space-y-4">
            {groups.map((group) => {
              const items = settingsCategories.filter((c) => group.hrefs.includes(c.href));
              const isOpen = openGroups.has(group.key);
              return (
                <div key={group.key} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <span className="font-semibold text-gray-900">{group.title}</span>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-white">
                      {items.map((category) => {
                        const Icon = category.icon;
                        const statusColor =
                          category.status === "active"
                            ? "bg-green-100 text-green-800"
                            : category.status === "warning"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800";

                        return (
                          <Link
                            key={category.href}
                            to={category.href}
                            className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow p-5 group"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                                  <Icon className="w-5 h-5 text-blue-600" />
                                </div>
                                {category.status && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                    {category.status}
                                  </span>
                                )}
                              </div>
                            </div>
                            <h3 className="text-base font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                              {category.title}
                            </h3>
                            <p className="text-sm text-gray-500 mb-3">{category.description}</p>
                            {category.stats && (
                              <div className="border-t pt-3 space-y-1">
                                {category.stats.map((stat, idx) => (
                                  <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-gray-500">{stat.label}:</span>
                                    <span className="font-medium text-gray-900">{stat.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Quick Actions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("admin.quickActions")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/admin/system/power-operations"
            className="flex items-center space-x-3 p-4 bg-white rounded-lg hover:shadow transition-shadow"
          >
            <Zap className="w-5 h-5 text-yellow-600" />
            <span className="font-medium text-gray-900">{t("admin.powerOperations")}</span>
          </Link>
          <Link
            to="/admin/system/logs"
            className="flex items-center space-x-3 p-4 bg-white rounded-lg hover:shadow transition-shadow"
          >
            <Activity className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">{t("admin.viewSystemLogs")}</span>
          </Link>
          <Link
            to="/admin/system/backups"
            className="flex items-center space-x-3 p-4 bg-white rounded-lg hover:shadow transition-shadow"
          >
            <HardDrive className="w-5 h-5 text-green-600" />
            <span className="font-medium text-gray-900">{t("admin.manageBackups")}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

