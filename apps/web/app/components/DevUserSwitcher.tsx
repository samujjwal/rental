/**
 * Development User Switcher Component
 * Shows quick login buttons for test users in development
 */

import { Link, useNavigate } from "react-router";
import { authApi } from "~/lib/api/auth";
import { useAuthStore } from "~/lib/store/auth";
import { createUserSession } from "~/utils/auth";
import { useState } from "react";
import axios from "axios";

interface DevUser {
  email: string;
  label: string;
  role: string;
  roleKey: "SUPER_ADMIN" | "ADMIN" | "HOST";
  color: string;
  avatar: string;
}

const DEV_USERS: DevUser[] = [
  {
    email: "superadmin@rental-portal.com",
    label: "Super Admin",
    role: "System Admin",
    roleKey: "SUPER_ADMIN",
    color: "bg-red-800 hover:bg-red-900",
    avatar: "https://i.pravatar.cc/150?u=superadmin@rental-portal.com",
  },
  {
    email: "admin@rental-portal.com",
    label: "Admin",
    role: "Portal Admin",
    roleKey: "ADMIN",
    color: "bg-red-600 hover:bg-red-700",
    avatar: "https://i.pravatar.cc/150?u=admin@rental-portal.com",
  },
  {
    email: "host@rental-portal.com",
    label: "Host",
    role: "Property Owner",
    roleKey: "HOST",
    color: "bg-blue-600 hover:bg-blue-700",
    avatar: "https://i.pravatar.cc/150?u=host@rental-portal.com",
  },
];

export function DevUserSwitcher() {
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState<string | null>(null);
  const defaultDevPassword =
    import.meta.env.MODE === "development"
      ? import.meta.env.VITE_DEV_LOGIN_PASSWORD ?? "password123"
      : "";
  const devSecret = import.meta.env.VITE_DEV_LOGIN_SECRET;
  const [devPassword, setDevPassword] = useState(defaultDevPassword);
  const [errorMessage, setErrorMessage] = useState("");
  const normalizeRole = (role?: string) => String(role || "").toUpperCase();

  // Only show in development
  if (import.meta.env.MODE !== "development") {
    return null;
  }

  const handleQuickLogin = async (
    user: DevUser,
    redirectTo?: string
  ) => {
    const { email, roleKey } = user;
    const targetRedirect =
      redirectTo ??
      (roleKey === "ADMIN" || roleKey === "SUPER_ADMIN"
        ? "/admin"
        : "/dashboard");
    setIsLoggingIn(email);
    setErrorMessage("");
    try {
      // Clear existing auth first
      useAuthStore.getState().clearAuth();

      let response;
      if (import.meta.env.MODE === "development") {
        try {
          response = await authApi.devLogin({ email, role: roleKey, secret: devSecret });
        } catch {
          response = await authApi.login({ email, password: devPassword });
        }
      } else {
        response = await authApi.login({ email, password: devPassword });
      }

      const loggedInRole = normalizeRole(response.user.role);
      if (roleKey === "ADMIN" || roleKey === "SUPER_ADMIN") {
        if (loggedInRole !== "ADMIN" && loggedInRole !== "SUPER_ADMIN") {
          setErrorMessage(
            `Expected admin login, got ${loggedInRole || "unknown"} user. Check seed users.`
          );
          return;
        }
      }
      
      // Update auth store (B-29: refreshToken is in httpOnly cookie)
      useAuthStore.getState().setAuth(response.user, response.accessToken);

      // Create session cookie
      await createUserSession({
        userId: response.user.id,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        remember: true,
        redirectTo: targetRedirect,
      });

      // Navigate
      navigate(targetRedirect);
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || `Login failed (${error.response?.status || "network"})`
        : "Quick login failed";
      setErrorMessage(`${message}. If needed, reseed users and use the correct dev password.`);
      console.error("Quick login failed:", error);
    } finally {
      setIsLoggingIn(null);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-lg border-2 border-yellow-400 bg-yellow-50 p-4 shadow-2xl">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-yellow-400 text-xs font-bold">
          DEV
        </div>
        <h3 className="font-bold text-gray-900">Quick Login (Dev Mode)</h3>
      </div>
      <p className="mb-3 text-xs text-gray-600">
        Click to login as test user
      </p>
      <form
        className="mb-3"
        onSubmit={(e) => e.preventDefault()}
        autoComplete="on"
      >
        <input
          type="text"
          name="username"
          autoComplete="username"
          className="hidden"
          tabIndex={-1}
          defaultValue=""
          aria-hidden="true"
        />
        <input
          type="password"
          name="dev-password"
          autoComplete="current-password"
          value={devPassword}
          onChange={(e) => setDevPassword(e.target.value)}
          className="w-full rounded border border-yellow-300 bg-white px-2 py-1.5 text-xs text-gray-900"
          placeholder="Dev password"
        />
      </form>
      {errorMessage && (
        <p className="mb-3 rounded bg-red-100 px-2 py-1.5 text-xs text-red-700">
          {errorMessage}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {DEV_USERS.map((user) => (
          <button
            type="button"
            key={user.email}
            disabled={!!isLoggingIn}
            onClick={() => handleQuickLogin(user)}
            className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-white transition-colors ${user.color} ${
              isLoggingIn === user.email ? "animate-pulse ring-2 ring-yellow-400" : ""
            }`}
          >
            <img 
              src={user.avatar} 
              alt="" 
              className="h-7 w-7 rounded-full border border-white/20 bg-gray-200"
              onError={(e) => {
                // Fallback if i.pravatar.cc is flaky
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.label)}&background=random`;
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold truncate leading-tight">
                {isLoggingIn === user.email ? "..." : user.label}
              </div>
              <div className="text-[10px] truncate leading-tight text-white">{user.role}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2 border-t border-yellow-200 pt-3">
        <Link
          to="/"
          className="flex-1 rounded bg-gray-700 px-2 py-1.5 text-center text-xs font-medium text-white hover:bg-gray-800"
        >
          Home
        </Link>
        <button
          type="button"
          disabled={!!isLoggingIn}
          onClick={() =>
            handleQuickLogin(
              DEV_USERS.find((user) => user.roleKey === "ADMIN") ?? DEV_USERS[0],
              "/admin"
            )
          }
          className="flex-1 rounded bg-gray-700 px-2 py-1.5 text-center text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {isLoggingIn === "admin@rental-portal.com" ? "Loading..." : "Admin Portal"}
        </button>
      </div>
    </div>
  );
}
