import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, Form, useNavigation, useActionData } from "react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  Clock,
  Shield,
} from "lucide-react";
import { adminApi } from "~/lib/api/admin";
import { UnifiedButton , RouteErrorBoundary } from "~/components/ui";
import { requireAdmin } from "~/utils/auth";
import { formatDate } from "~/lib/utils";

// Local type for API key from the server
interface ServerApiKey {
  id: string;
  name: string;
  lastUsed: string;
  prefix?: string;
  suffix?: string;
  scopes?: string[];
  status?: "active" | "revoked" | "expired";
  createdAt?: string;
  expiresAt?: string | null;
}

export const meta: MetaFunction = () => {
  return [
    { title: "API Keys | Admin" },
    { name: "description", content: "Manage API keys for external integrations" },
  ];
};

const safeDateLabel = (value: unknown): string => {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "Unknown date" : formatDate(date);
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  try {
    const apiKeysRes = await adminApi.getApiKeys();
    return {
      apiKeys: apiKeysRes.keys || [],
      error: null,
    };
  } catch (error: unknown) {
    return {
      apiKeys: [],
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load API keys",
    };
  }
}

export async function clientAction({ request }: ActionFunctionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const validScopes = new Set(availableScopes.map((scope) => scope.id));
  const allowedIntents = new Set(["create", "revoke", "regenerate"]);
  if (!allowedIntents.has(intent)) {
    return { success: false, error: "Unknown action" };
  }
  const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (intent === "create") {
    const name = String(formData.get("name") ?? "").trim().slice(0, 100);
    const scopes = [...new Set((formData.getAll("scopes") as string[]))].filter((scope) =>
      validScopes.has(scope)
    );
    const expiresInDays = Number(formData.get("expiresInDays"));
    if (!name) {
      return { success: false, error: "API key name is required" };
    }
    if (scopes.length === 0) {
      return { success: false, error: "Select at least one scope" };
    }
    if (!Number.isFinite(expiresInDays) || expiresInDays < 0 || expiresInDays > 3650) {
      return { success: false, error: "Expiration days must be between 0 and 3650" };
    }

    try {
      const response = await adminApi.createApiKey({ name, scopes, expiresInDays });
      return { 
        success: true, 
        message: "API key created successfully",
        newKey: response.key, // The newly generated key to show to user
      };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          (error &&
            typeof error === "object" &&
            "response" in error &&
            (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message) ||
          "Failed to create API key",
      };
    }
  }

  if (intent === "revoke") {
    const keyId = String(formData.get("keyId") ?? "").trim();
    if (!UUID_PATTERN.test(keyId)) {
      return { success: false, error: "API key ID is required" };
    }
    try {
      await adminApi.revokeApiKey(keyId);
      return { success: true, message: "API key revoked successfully" };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          (error &&
            typeof error === "object" &&
            "response" in error &&
            (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message) ||
          "Failed to revoke API key",
      };
    }
  }

  if (intent === "regenerate") {
    const keyId = String(formData.get("keyId") ?? "").trim();
    if (!UUID_PATTERN.test(keyId)) {
      return { success: false, error: "API key ID is required" };
    }
    try {
      const response = await adminApi.regenerateApiKey(keyId);
      return { 
        success: true, 
        message: "API key regenerated successfully",
        newKey: response.key,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error:
          (error &&
            typeof error === "object" &&
            "response" in error &&
            (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message) ||
          "Failed to regenerate API key",
      };
    }
  }

  return { success: false, error: "Unknown action" };
}

const availableScopes = [
  { id: "read:users", label: "Read Users", description: "View user information" },
  { id: "write:users", label: "Write Users", description: "Create and update users" },
  { id: "read:listings", label: "Read Listings", description: "View listing information" },
  { id: "write:listings", label: "Write Listings", description: "Create and update listings" },
  { id: "read:bookings", label: "Read Bookings", description: "View booking information" },
  { id: "write:bookings", label: "Write Bookings", description: "Create and update bookings" },
  { id: "read:analytics", label: "Read Analytics", description: "View analytics and reports" },
  { id: "admin", label: "Full Admin Access", description: "Complete administrative access" },
];

export default function ApiKeysPage() {
  const { t } = useTranslation();
  const { apiKeys, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);

  const isSubmitting = navigation.state === "submitting";
  const formIntent = navigation.formData?.get("intent");
  const actionMessage =
    typeof actionData?.message === "string" ? actionData.message : null;
  const actionError =
    typeof actionData?.error === "string" ? actionData.error : null;
  const newKey =
    typeof actionData?.newKey === "string" ? actionData.newKey : null;

  const copyToClipboard = async (text: string, keyId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        );
      case "revoked":
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            Revoked
          </span>
        );
      case "expired":
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
            Expired
          </span>
        );
      default:
        return null;
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">{t("admin.errorLoadingApiKeys")}</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to="/admin/system"
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            {t("admin.backToSystemSettings")}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{t("admin.apiKeys")}</h1>
          <p className="text-gray-600 mt-1">
            {t("admin.apiKeysSubtitle")}
          </p>
        </div>
        <UnifiedButton onClick={() => setShowCreateForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t("admin.createApiKey")}
        </UnifiedButton>
      </div>

      {/* Action Messages */}
      {actionData?.success && actionMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5 inline-block mr-2" />
          {actionMessage}
          {newKey && (
            <div className="mt-3 p-3 bg-white rounded border border-green-200">
              <p className="text-sm text-gray-700 mb-2">
                <AlertTriangle className="w-4 h-4 inline-block mr-1 text-yellow-500" />
                {t("admin.copyKeyWarning")}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-gray-100 rounded text-sm font-mono break-all">
                  {newKey}
                </code>
                <button
                  onClick={() => copyToClipboard(newKey, "new")}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  {copiedKey === "new" ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-500" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {actionError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <XCircle className="w-5 h-5 inline-block mr-2" />
          {actionError}
        </div>
      )}

      {/* Create API Key Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">{t("admin.createNewApiKey")}</h2>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <Form method="post" onSubmit={() => setShowCreateForm(false)}>
            <input type="hidden" name="intent" value="create" />

            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                {t("admin.keyName")}
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                maxLength={100}
                placeholder={t("admin.keyNamePlaceholder")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("admin.permissions")}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {availableScopes.map((scope) => (
                  <label
                    key={scope.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                  >
                    <input
                      type="checkbox"
                      name="scopes"
                      value={scope.id}
                      checked={selectedScopes.includes(scope.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedScopes([...selectedScopes, scope.id]);
                        } else {
                          setSelectedScopes(selectedScopes.filter((s) => s !== scope.id));
                        }
                      }}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{scope.label}</p>
                      <p className="text-sm text-gray-500">{scope.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="expiresInDays" className="block text-sm font-medium text-gray-700 mb-1">
                {t("admin.expiresIn")}
              </label>
              <select
                id="expiresInDays"
                name="expiresInDays"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
                <option value="0">Never (not recommended)</option>
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <UnifiedButton
                type="button"
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                {t("admin.cancel")}
              </UnifiedButton>
              <UnifiedButton type="submit" disabled={isSubmitting && formIntent === "create"}>
                {isSubmitting && formIntent === "create" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("admin.creating")}
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    {t("admin.createKey")}
                  </>
                )}
              </UnifiedButton>
            </div>
          </Form>
        </div>
      )}

      {/* API Keys List */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{t("admin.existingApiKeys")}</h2>
        </div>

        {apiKeys.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Key className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>{t("admin.noApiKeys")}</p>
            <p className="text-sm mt-1">{t("admin.noApiKeysDesc")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {apiKeys.map((key: ServerApiKey) => (
              <div
                key={key.id}
                className={`p-6 ${key.status && key.status !== "active" ? "bg-gray-50" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{key.name}</h3>
                      {key.status && getStatusBadge(key.status)}
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                        {key.prefix ? (showKey === key.id ? key.prefix + "..." + (key.suffix || "") : key.prefix + "...") : "••••••••"}
                      </code>
                      {key.prefix && (
                        <button
                          onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {showKey === key.id ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      {key.createdAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Created: {safeDateLabel(key.createdAt)}
                        </div>
                      )}
                      {key.expiresAt && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          Expires: {safeDateLabel(key.expiresAt)}
                        </div>
                      )}
                      {key.lastUsed && (
                        <div className="flex items-center gap-1">
                          <RefreshCw className="w-4 h-4" />
                          Last used: {safeDateLabel(key.lastUsed)}
                        </div>
                      )}
                    </div>

                    {key.scopes && key.scopes.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {key.scopes.map((scope: string) => (
                          <span
                            key={scope}
                            className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {(!key.status || key.status === "active") && (
                    <div className="flex items-center gap-2">
                      <Form method="post">
                        <input type="hidden" name="intent" value="regenerate" />
                        <input type="hidden" name="keyId" value={key.id} />
                        <UnifiedButton
                          type="submit"
                          variant="outline"
                          size="sm"
                          disabled={isSubmitting}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          {t("admin.regenerate")}
                        </UnifiedButton>
                      </Form>

                      {confirmRevoke === key.id ? (
                        <div className="flex items-center gap-2">
                          <Form method="post">
                            <input type="hidden" name="intent" value="revoke" />
                            <input type="hidden" name="keyId" value={key.id} />
                            <UnifiedButton
                              type="submit"
                              size="sm"
                              variant="destructive"
                              disabled={isSubmitting}
                            >
                              {t("admin.confirm")}
                            </UnifiedButton>
                          </Form>
                          <UnifiedButton
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmRevoke(null)}
                          >
                            {t("admin.cancel")}
                          </UnifiedButton>
                        </div>
                      ) : (
                        <UnifiedButton
                          variant="destructive"
                          onClick={() => setConfirmRevoke(key.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {t("admin.revokeKey")}
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

      {/* Security Notice */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <Shield className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">{t("admin.securityBestPractices")}</h3>
            <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside space-y-1">
              <li>{t("admin.securityTip1")}</li>
              <li>{t("admin.securityTip2")}</li>
              <li>{t("admin.securityTip3")}</li>
              <li>{t("admin.securityTip4")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

