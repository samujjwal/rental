import type { MetaFunction } from "react-router";
import { useLoaderData, Link, Form, useNavigation, useActionData } from "react-router";
import { useState } from "react";
import {
  HardDrive,
  Download,
  Upload,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { adminApi, type SystemBackup } from "~/lib/api/admin";
import { UnifiedButton } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Backup Management | Admin" },
    { name: "description", content: "Database backups and restore operations" },
  ];
};

export async function clientLoader() {
  try {
    const backupsRes = await adminApi.getBackups();
    return {
      backups: backupsRes.backups || [],
      error: null,
    };
  } catch (error: any) {
    return {
      backups: [],
      error: error?.message || "Failed to load backups",
    };
  }
}

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const type = formData.get("type") as "full" | "incremental";
    try {
      await adminApi.createBackup(type);
      return { success: true, message: `${type} backup started successfully` };
    } catch (error: any) {
      return {
        success: false,
        error: error?.response?.data?.message || "Failed to create backup",
      };
    }
  }

  if (intent === "restore") {
    const backupId = formData.get("backupId") as string;
    try {
      await adminApi.restoreBackup(backupId);
      return { success: true, message: "Restore initiated successfully" };
    } catch (error: any) {
      return {
        success: false,
        error: error?.response?.data?.message || "Failed to restore backup",
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

export default function BackupsPage() {
  const { backups, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [showConfirmRestore, setShowConfirmRestore] = useState<string | null>(null);

  const isSubmitting = navigation.state === "submitting";
  const formIntent = navigation.formData?.get("intent");

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "in_progress":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Backups</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to="/admin/system"
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            ← Back to System Settings
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Backup Management</h1>
          <p className="text-gray-600 mt-1">
            Create and manage database backups
          </p>
        </div>
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

      {/* Create Backup Section */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Backup</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <input type="hidden" name="type" value="full" />
            <Button
              type="submit"
              disabled={isSubmitting && formIntent === "create"}
              className="w-full"
            >
              {isSubmitting && formIntent === "create" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <HardDrive className="w-4 h-4 mr-2" />
              )}
              Full Backup
            </UnifiedButton>
            <p className="text-sm text-gray-500 mt-2">
              Complete backup of all database tables and files
            </p>
          </Form>

          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <input type="hidden" name="type" value="incremental" />
            <Button
              type="submit"
              variant="outline"
              disabled={isSubmitting && formIntent === "create"}
              className="w-full"
            >
              {isSubmitting && formIntent === "create" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Incremental Backup
            </UnifiedButton>
            <p className="text-sm text-gray-500 mt-2">
              Backup only changes since last full backup
            </p>
          </Form>
        </div>
      </div>

      {/* Warning Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">
              Important: Restore Operations
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              Restoring from a backup will overwrite all current data. This action cannot be undone.
              Make sure to create a backup of the current state before proceeding with any restore.
            </p>
          </div>
        </div>
      </div>

      {/* Backup List */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Available Backups</h2>
        </div>

        {backups.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <HardDrive className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No backups available</p>
            <p className="text-sm mt-1">Create your first backup using the buttons above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {backups.map((backup: SystemBackup) => (
              <div
                key={backup.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(backup.status)}
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">
                          {backup.type === "full" ? "Full Backup" : "Incremental Backup"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                            backup.status
                          )}`}
                        >
                          {backup.status.replace("_", " ").toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>
                          Created: {new Date(backup.createdAt).toLocaleString()}
                        </span>
                        {backup.completedAt && (
                          <span>
                            Completed: {new Date(backup.completedAt).toLocaleString()}
                          </span>
                        )}
                        <span>Size: {formatBytes(backup.size)}</span>
                      </div>
                    </div>
                  </div>

                  {backup.status === "completed" && (
                    <div className="flex items-center gap-2">
                      {backup.downloadUrl && (
                        <a
                          href={backup.downloadUrl}
                          download
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </a>
                      )}

                      {showConfirmRestore === backup.id ? (
                        <div className="flex items-center gap-2">
                          <Form method="post">
                            <input type="hidden" name="intent" value="restore" />
                            <input type="hidden" name="backupId" value={backup.id} />
                            <Button
                              type="submit"
                              size="small"
                              variant="destructive"
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Confirm"
                              )}
                            </UnifiedButton>
                          </Form>
                          <Button
                            variant="outline"
                            size="small"
                            onClick={() => setShowConfirmRestore(null)}
                          >
                            Cancel
                          </UnifiedButton>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="small"
                          onClick={() => setShowConfirmRestore(backup.id)}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Restore
                        </UnifiedButton>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
