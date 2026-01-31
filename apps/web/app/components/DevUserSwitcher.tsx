/**
 * Development User Switcher Component
 * Shows quick login buttons for test users in development
 */

import { Form } from "react-router";

interface DevUser {
  email: string;
  label: string;
  role: string;
  color: string;
}

const DEV_USERS: DevUser[] = [
  {
    email: "admin@rental-portal.com",
    label: "Admin",
    role: "Administrator",
    color: "bg-red-600 hover:bg-red-700",
  },
  {
    email: "support@rental.local",
    label: "Support",
    role: "Support Agent",
    color: "bg-purple-600 hover:bg-purple-700",
  },
  {
    email: "john.owner@rental.local",
    label: "John (Owner)",
    role: "Camera Equipment Owner",
    color: "bg-blue-600 hover:bg-blue-700",
  },
  {
    email: "emily.tools@rental.local",
    label: "Emily (Owner)",
    role: "Tools Owner",
    color: "bg-blue-600 hover:bg-blue-700",
  },
  {
    email: "mike.customer@rental.local",
    label: "Mike (Customer)",
    role: "Customer",
    color: "bg-green-600 hover:bg-green-700",
  },
  {
    email: "lisa.renter@rental.local",
    label: "Lisa (Customer)",
    role: "Event Planner",
    color: "bg-green-600 hover:bg-green-700",
  },
];

export function DevUserSwitcher() {
  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

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
          <Form key={user.email} action="/auth/login" method="post">
            <input type="hidden" name="email" value={user.email} />
            <input type="hidden" name="password" value="password123" />
            <button
              type="submit"
              className={`w-full rounded px-3 py-2 text-left text-white transition-colors ${user.color}`}
            >
              <div className="text-xs font-semibold">{user.label}</div>
              <div className="text-[10px] opacity-90">{user.role}</div>
            </button>
          </Form>
        ))}
      </div>
      <div className="mt-3 flex gap-2 border-t border-yellow-200 pt-3">
        <a
          href="http://localhost:3401"
          className="flex-1 rounded bg-gray-700 px-2 py-1.5 text-center text-xs font-medium text-white hover:bg-gray-800"
        >
          Customer Portal
        </a>
        <Form action="/auth/login" method="post" className="flex-1">
          <input type="hidden" name="email" value="admin@rental-portal.com" />
          <input type="hidden" name="password" value="password123" />
          <input type="hidden" name="redirectTo" value="/admin" />
          <button
            type="submit"
            className="w-full rounded bg-gray-700 px-2 py-1.5 text-center text-xs font-medium text-white hover:bg-gray-800"
          >
            Admin Portal
          </button>
        </Form>
      </div>
    </div>
  );
}
