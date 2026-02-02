import type { MetaFunction } from "react-router";
import { useLoaderData, Link, useRevalidator } from "react-router";
import { useState, useEffect } from "react";
import {
  Terminal,
  RefreshCw,
  Copy,
  CheckCircle,
  AlertTriangle,
  Server,
  Database,
  Cloud,
  Lock,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { adminApi } from "~/lib/api/admin";
import { Button } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Environment Variables | Admin" },
    { name: "description", content: "View environment configuration" },
  ];
};

interface EnvVariable {
  key: string;
  value: string;
  category: "database" | "auth" | "storage" | "email" | "api" | "other";
  sensitive: boolean;
  description?: string;
}

export async function clientLoader() {
  try {
    const envRes = await adminApi.getEnvironmentVariables();
    return {
      variables: envRes.variables || [],
      environment: envRes.environment || "development",
      error: null,
    };
  } catch (error: any) {
    return {
      variables: [],
      environment: "unknown",
      error: error?.message || "Failed to load environment variables",
    };
  }
}

const categoryIcons: Record<string, React.ReactNode> = {
  database: <Database className="w-4 h-4" />,
  auth: <Lock className="w-4 h-4" />,
  storage: <Cloud className="w-4 h-4" />,
  email: <Server className="w-4 h-4" />,
  api: <Terminal className="w-4 h-4" />,
  other: <Info className="w-4 h-4" />,
};

const categoryColors: Record<string, string> = {
  database: "bg-blue-100 text-blue-800",
  auth: "bg-red-100 text-red-800",
  storage: "bg-purple-100 text-purple-800",
  email: "bg-green-100 text-green-800",
  api: "bg-yellow-100 text-yellow-800",
  other: "bg-gray-100 text-gray-800",
};

export default function EnvironmentPage() {
  const { variables, environment, error } = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();

  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleShowSensitive = (key: string) => {
    setShowSensitive((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredVariables = variables.filter((v: EnvVariable) => {
    const matchesFilter = filter === "all" || v.category === filter;
    const matchesSearch =
      searchQuery === "" ||
      v.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesFilter && matchesSearch;
  });

  const groupedVariables = filteredVariables.reduce(
    (acc: Record<string, EnvVariable[]>, variable: EnvVariable) => {
      const category = variable.category || "other";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(variable);
      return acc;
    },
    {}
  );

  const getEnvironmentBadge = (env: string) => {
    switch (env) {
      case "production":
        return (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            Production
          </span>
        );
      case "staging":
        return (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            Staging
          </span>
        );
      case "development":
        return (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Development
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            {env}
          </span>
        );
    }
  };

  const maskValue = (value: string) => {
    if (value.length <= 8) {
      return "••••••••";
    }
    return value.substring(0, 4) + "••••••••" + value.substring(value.length - 4);
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Error Loading Environment Variables</h3>
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
            ← Back to System Settings
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">Environment Variables</h1>
            {getEnvironmentBadge(environment)}
          </div>
          <p className="text-gray-600 mt-1">
            View current environment configuration (read-only)
          </p>
        </div>
        <Button
          variant="outlined"
          onClick={() => revalidator.revalidate()}
          disabled={revalidator.state === "loading"}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${revalidator.state === "loading" ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Warning Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Read-Only View</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Environment variables cannot be modified through this interface for security reasons.
              To update environment variables, modify your <code className="bg-yellow-100 px-1 rounded">.env</code> file
              or your deployment configuration and restart the application.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search variables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {Object.keys(categoryColors).map((category) => (
              <button
                key={category}
                onClick={() => setFilter(category)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                  filter === category
                    ? categoryColors[category]
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {categoryIcons[category]}
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Variables by Category */}
      {Object.keys(groupedVariables).length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
          <Terminal className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No environment variables found</p>
          {searchQuery && (
            <p className="text-sm mt-1">Try adjusting your search query</p>
          )}
        </div>
      ) : (
        Object.entries(groupedVariables).map(([category, vars]) => (
          <div
            key={category}
            className="bg-white rounded-lg shadow border border-gray-200 mb-6 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded ${categoryColors[category]}`}>
                  {categoryIcons[category]}
                </span>
                <h2 className="text-lg font-semibold text-gray-900 capitalize">
                  {category} Configuration
                </h2>
                <span className="text-sm text-gray-500">
                  ({(vars as EnvVariable[]).length} variables)
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {(vars as EnvVariable[]).map((variable) => (
                <div
                  key={variable.key}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-semibold text-gray-900">
                          {variable.key}
                        </code>
                        {variable.sensitive && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">
                            Sensitive
                          </span>
                        )}
                      </div>
                      {variable.description && (
                        <p className="text-sm text-gray-500 mt-1">{variable.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 px-3 py-1.5 bg-gray-100 rounded text-sm font-mono text-gray-700 break-all">
                          {variable.sensitive && !showSensitive[variable.key]
                            ? maskValue(variable.value)
                            : variable.value}
                        </code>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {variable.sensitive && (
                        <button
                          onClick={() => toggleShowSensitive(variable.key)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                          title={showSensitive[variable.key] ? "Hide value" : "Show value"}
                        >
                          {showSensitive[variable.key] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(variable.value, variable.key)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        title="Copy value"
                      >
                        {copiedKey === variable.key ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Variables</p>
          <p className="text-2xl font-semibold text-gray-900">{variables.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Sensitive</p>
          <p className="text-2xl font-semibold text-red-600">
            {variables.filter((v: EnvVariable) => v.sensitive).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Categories</p>
          <p className="text-2xl font-semibold text-blue-600">
            {new Set(variables.map((v: EnvVariable) => v.category)).size}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Environment</p>
          <p className="text-2xl font-semibold text-gray-900 capitalize">{environment}</p>
        </div>
      </div>
    </div>
  );
}
