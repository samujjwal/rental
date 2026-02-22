import React from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Link, useRouteError, isRouteErrorResponse, useRevalidator } from "react-router";

export function AdminErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();

  let errorMessage = "An unexpected error occurred";
  let errorStack = "";

  if (isRouteErrorResponse(error)) {
    errorMessage = error.statusText || `Error ${error.status}`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorStack = error.stack || "";
  } else if (typeof error === "string") {
    errorMessage = error;
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg w-full bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 text-center border border-gray-200 dark:border-gray-700">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Something went wrong</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          An error occurred in the admin panel. Please try refreshing the page or contact support if the problem persists.
        </p>

        {process.env.NODE_ENV === "development" && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 text-left overflow-auto">
            <pre className="text-xs font-mono text-red-800 dark:text-red-300 whitespace-pre-wrap">
              {errorMessage}
              {errorStack && `\n\n${errorStack}`}
            </pre>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => revalidator.revalidate()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Page
          </button>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AdminErrorBoundary;
