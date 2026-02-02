import type { MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import {
  Settings,
  Zap,
  Database,
  Bell,
  Lock,
  Globe,
  Mail,
  Server,
  Shield,
  Key,
  Activity,
  HardDrive,
} from "lucide-react";
import { adminApi } from "~/lib/api/admin";

export const meta: MetaFunction = () => {
  return [
    { title: "System Settings | Admin" },
    { name: "description", content: "System configuration and settings" },
  ];
};

export async function clientLoader() {
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
  } catch (error: any) {
    return {
      generalSettings: null,
      systemHealth: null,
      databaseInfo: null,
      error: error?.message || "Failed to load system settings",
    };
  }
}

interface SettingsCategory {
  title: string;
  description: string;
  icon: any;
  href: string;
  status?: "active" | "warning" | "error";
  stats?: { label: string; value: string | number }[];
}

export default function SystemSettingsPage() {
  const { generalSettings, systemHealth, databaseInfo, error } =
    useLoaderData<typeof clientLoader>();

  const settingsCategories: SettingsCategory[] = [
    {
      title: "General Settings",
      description: "Site name, contact information, and basic configuration",
      icon: Settings,
      href: "/admin/system/general",
      status: "active",
      stats: [
        { label: "Site Name", value: generalSettings?.siteName || "Rental Portal" },
        { label: "Maintenance", value: generalSettings?.maintenanceMode ? "ON" : "OFF" },
      ],
    },
    {
      title: "Power Operations",
      description: "System maintenance, backups, and critical operations",
      icon: Zap,
      href: "/admin/system/power-operations",
      status: systemHealth?.services?.database?.status === "healthy" ? "active" : "warning",
      stats: [
        { label: "API Status", value: systemHealth?.status || "Unknown" },
        { label: "Uptime", value: `${systemHealth?.uptime || 0}%` },
      ],
    },
    {
      title: "Database Management",
      description: "Database configuration, backups, and monitoring",
      icon: Database,
      href: "/admin/system/database",
      status: systemHealth?.services?.database?.status === "healthy" ? "active" : "warning",
      stats: [
        { label: "Status", value: systemHealth?.services?.database?.status || "Unknown" },
        {
          label: "Connections",
          value: `${databaseInfo?.connections || 0}`,
        },
      ],
    },
    {
      title: "Notification Settings",
      description: "Email, SMS, and push notification configuration",
      icon: Bell,
      href: "/admin/system/notifications",
      status: "active",
    },
    {
      title: "Security Settings",
      description: "Authentication, authorization, and security policies",
      icon: Shield,
      href: "/admin/system/security",
      status: "active",
    },
    {
      title: "API Keys",
      description: "Manage third-party service integrations",
      icon: Key,
      href: "/admin/system/api-keys",
      status: "active",
    },
    {
      title: "Email Service",
      description: "Email provider configuration and templates",
      icon: Mail,
      href: "/admin/system/email",
      status: "active",
    },
    {
      title: "Environment Variables",
      description: "System environment configuration",
      icon: Server,
      href: "/admin/system/environment",
      status: "active",
    },
    {
      title: "System Logs",
      description: "View and manage application logs",
      icon: Activity,
      href: "/admin/system/logs",
      status: "active",
    },
    {
      title: "Backup Management",
      description: "Database backups and restore operations",
      icon: HardDrive,
      href: "/admin/system/backups",
      status: "active",
    },
  ];

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading System Settings</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Settings</h1>
        <p className="text-gray-600">
          Configure and manage system-wide settings and integrations
        </p>
      </div>

      {/* System Health Overview */}
      {systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">API Status</p>
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
                <p className="text-sm text-gray-600 mb-1">Database</p>
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
                <p className="text-sm text-gray-600 mb-1">Uptime</p>
                <p className="text-2xl font-bold text-blue-600">
                  {systemHealth.uptime || 0}%
                </p>
              </div>
              <Activity className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Cache Status</p>
                <p className="text-2xl font-bold text-green-600">
                  {systemHealth.services?.redis?.status || "N/A"}
                </p>
              </div>
              <Zap className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </div>
      )}

      {/* Settings Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCategories.map((category) => {
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
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 p-6 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  {category.status && (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}
                    >
                      {category.status}
                    </span>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {category.title}
              </h3>
              <p className="text-sm text-gray-600 mb-4">{category.description}</p>

              {category.stats && (
                <div className="border-t pt-4 space-y-2">
                  {category.stats.map((stat, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">{stat.label}:</span>
                      <span className="font-medium text-gray-900">{stat.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/admin/system/power-operations"
            className="flex items-center space-x-3 p-4 bg-white rounded-lg hover:shadow transition-shadow"
          >
            <Zap className="w-5 h-5 text-yellow-600" />
            <span className="font-medium text-gray-900">Power Operations</span>
          </Link>
          <Link
            to="/admin/system/logs"
            className="flex items-center space-x-3 p-4 bg-white rounded-lg hover:shadow transition-shadow"
          >
            <Activity className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">View System Logs</span>
          </Link>
          <Link
            to="/admin/system/backups"
            className="flex items-center space-x-3 p-4 bg-white rounded-lg hover:shadow transition-shadow"
          >
            <HardDrive className="w-5 h-5 text-green-600" />
            <span className="font-medium text-gray-900">Manage Backups</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
