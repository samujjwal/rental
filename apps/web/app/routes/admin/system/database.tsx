import type { MetaFunction } from "react-router";
import { useLoaderData, Link, Form, useNavigation, useActionData } from "react-router";
import { useState } from "react";
import {
  Database,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  HardDrive,
  Activity,
  Server,
  Zap,
} from "lucide-react";
import { adminApi } from "~/lib/api/admin";
import { UnifiedButton } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Database Management | Admin" },
    { name: "description", content: "Database health, migrations, and maintenance" },
  ];
};

export async function clientLoader() {
  try {
    const [healthRes, dbInfoRes] = await Promise.all([
      adminApi.getSystemHealth(),
      adminApi.getDatabaseInfo(),
    ]);
    return {
      health: healthRes,
      dbInfo: dbInfoRes,
      error: null,
    };
  } catch (error: any) {
    return {
      health: null,
      dbInfo: null,
      error: error?.message || "Failed to load database info",
    };
  }
}

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "vacuum") {
    try {
      await adminApi.runDatabaseVacuum();
      return { success: true, message: "Database vacuum completed successfully" };
    } catch (error: any) {
      return {
        success: false,
        error: error?.response?.data?.message || "Failed to run vacuum",
      };
    }
  }

  if (intent === "analyze") {
    try {
      await adminApi.runDatabaseAnalyze();
      return { success: true, message: "Database analysis completed successfully" };
    } catch (error: any) {
      return {
        success: false,
        error: error?.response?.data?.message || "Failed to run analysis",
      };
    }
  }

  if (intent === "clearCache") {
    try {
      await adminApi.clearCache("database");
      return { success: true, message: "Database cache cleared successfully" };
    } catch (error: any) {
      return {
        success: false,
        error: error?.response?.data?.message || "Failed to clear cache",
      };
    }
  }

  return { success: false, error: "Unknown action" };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function DatabasePage() {
  const { health, dbInfo, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const isSubmitting = navigation.state === "submitting";
  const formIntent = navigation.formData?.get("intent");

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Database Info</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const dbStatus = health?.services?.database?.status || "unknown";
  const dbResponseTime = health?.services?.database?.latency || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/admin/system"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          ← Back to System Settings
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Database Management</h1>
        <p className="text-gray-600 mt-1">
          Monitor database health and perform maintenance operations
        </p>
      </div>

      {/* Action Messages */}
      {actionData?.success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5 inline-block mr-2" />
          {actionData.message}
        </div>
      )}
      {actionData?.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <XCircle className="w-5 h-5 inline-block mr-2" />
          {actionData.error}
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${dbStatus === "healthy" ? "bg-green-100" : "bg-red-100"}`}>
              <Database className={`w-5 h-5 ${dbStatus === "healthy" ? "text-green-600" : "text-red-600"}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className={`font-semibold ${dbStatus === "healthy" ? "text-green-600" : "text-red-600"}`}>
                {dbStatus.charAt(0).toUpperCase() + dbStatus.slice(1)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Response Time</p>
              <p className="font-semibold text-gray-900">{dbResponseTime}ms</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Server className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Connections</p>
              <p className="font-semibold text-gray-900">{dbInfo?.connections || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <HardDrive className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Database Size</p>
              <p className="font-semibold text-gray-900">{formatBytes(dbInfo?.size || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table Statistics */}
      {dbInfo?.tables && dbInfo.tables.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Table Statistics</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Table Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rows
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dbInfo.tables.map((table: { name: string; rows: number; size: number }) => (
                  <tr key={table.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {table.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {table.rows.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {formatBytes(table.size)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Maintenance Operations */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Maintenance Operations</h2>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Caution</h3>
              <p className="text-sm text-yellow-700 mt-1">
                These operations may temporarily affect database performance. 
                It's recommended to run them during low-traffic periods.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Vacuum */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">Vacuum Database</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Reclaim storage space and optimize database performance by removing dead tuples.
            </p>
            {showConfirm === "vacuum" ? (
              <div className="flex items-center gap-2">
                <Form method="post">
                  <input type="hidden" name="intent" value="vacuum" />
                  <Button
                    type="submit"
                    size="small"
                    variant="primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && formIntent === "vacuum" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Confirm"
                    )}
                  </UnifiedButton>
                </Form>
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => setShowConfirm(null)}
                >
                  Cancel
                </UnifiedButton>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowConfirm("vacuum")}
                className="w-full"
              >
                <Zap className="w-4 h-4 mr-2" />
                Run Vacuum
              </UnifiedButton>
            )}
          </div>

          {/* Analyze */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold text-gray-900">Analyze Tables</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Update statistics used by the query planner for better query performance.
            </p>
            {showConfirm === "analyze" ? (
              <div className="flex items-center gap-2">
                <Form method="post">
                  <input type="hidden" name="intent" value="analyze" />
                  <Button
                    type="submit"
                    size="small"
                    variant="primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && formIntent === "analyze" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Confirm"
                    )}
                  </UnifiedButton>
                </Form>
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => setShowConfirm(null)}
                >
                  Cancel
                </UnifiedButton>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowConfirm("analyze")}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Run Analyze
              </UnifiedButton>
            )}
          </div>

          {/* Clear Cache */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-gray-900">Clear Cache</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Clear the database query cache. Use this if you notice stale data.
            </p>
            {showConfirm === "clearCache" ? (
              <div className="flex items-center gap-2">
                <Form method="post">
                  <input type="hidden" name="intent" value="clearCache" />
                  <Button
                    type="submit"
                    size="small"
                    variant="destructive"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && formIntent === "clearCache" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Confirm"
                    )}
                  </UnifiedButton>
                </Form>
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => setShowConfirm(null)}
                >
                  Cancel
                </UnifiedButton>
              </div>
            ) : (
              <Button
                variant="destructive"
                onClick={() => setShowConfirm("clearCache")}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Cache
              </UnifiedButton>
            )}
          </div>
        </div>
      </div>

      {/* Connection Info */}
      {dbInfo && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Connection Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Database Size</p>
              <p className="font-mono text-gray-900">{formatBytes(dbInfo.size)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Active Connections</p>
              <p className="font-mono text-gray-900">{dbInfo.connections || "N/A"}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Tables</p>
              <p className="font-mono text-gray-900">{dbInfo.tables?.length || "N/A"}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Rows</p>
              <p className="font-mono text-gray-900">
                {dbInfo.tables?.reduce((sum, t) => sum + t.rows, 0).toLocaleString() || "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
