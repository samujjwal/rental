/**
 * Development User Switcher Component
 * Shows quick login buttons for test users in development
 */

import { Link, useNavigate } from "react-router";
import { authApi } from "~/lib/api/auth";
import { useAuthStore } from "~/lib/store/auth";
import { createUserSession } from "~/utils/auth";
import { useState } from "react";

interface DevUser {
  email: string;
  label: string;
  role: string;
  color: string;
  avatar: string;
}

const DEV_USERS: DevUser[] = [
  {
    email: "superadmin@rental-portal.com",
    label: "Super Admin",
    role: "System Admin",
    color: "bg-red-800 hover:bg-red-900",
    avatar: "https://i.pravatar.cc/150?u=superadmin@rental-portal.com",
  },
  {
    email: "admin@rental-portal.com",
    label: "Admin",
    role: "Portal Admin",
    color: "bg-red-600 hover:bg-red-700",
    avatar: "https://i.pravatar.cc/150?u=admin@rental-portal.com",
  },
  {
    email: "host@rental-portal.com",
    label: "Host",
    role: "Property Owner",
    color: "bg-blue-600 hover:bg-blue-700",
    avatar: "https://i.pravatar.cc/150?u=host@rental-portal.com",
  },
];

export function DevUserSwitcher() {
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState<string | null>(null);

  // Only show in development
  if (import.meta.env.MODE !== "development") {
    return null;
  }

  const handleQuickLogin = async (email: string, redirectTo: string = "/dashboard") => {
    setIsLoggingIn(email);
    try {
      // Clear existing auth first
      useAuthStore.getState().clearAuth();
      
      const response = await authApi.login({ email, password: "password123" });
      
      // Update auth store
      useAuthStore.getState().setAuth(response.user, response.accessToken, response.refreshToken);

      // Create session cookie
      await createUserSession({
        userId: response.user.id,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        remember: true,
        redirectTo,
      });

      // Navigate
      navigate(redirectTo);
    } catch (error) {
      console.error("Quick login failed:", error);
      alert("Quick login failed. See console for details.");
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
        Click to login as test user (password: password123)
      </p>
      <div className="grid grid-cols-2 gap-2">
        {DEV_USERS.map((user) => (
          <button
            key={user.email}
            disabled={!!isLoggingIn}
            onClick={() => handleQuickLogin(user.email)}
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
              <div className="text-[8px] opacity-80 truncate leading-tight">{user.role}</div>
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
          disabled={!!isLoggingIn}
          onClick={() => handleQuickLogin("admin@rental-portal.com", "/admin")}
          className="flex-1 rounded bg-gray-700 px-2 py-1.5 text-center text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {isLoggingIn === "admin@rental-portal.com" ? "Loading..." : "Admin Portal"}
        </button>
      </div>
    </div>
  );
}
