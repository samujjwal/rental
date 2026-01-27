import { Outlet } from "react-router";

export default function SettingsLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings & Configuration</h1>
        <p className="text-gray-600">Manage system settings, API keys, and service configuration</p>
      </div>
      <Outlet />
    </div>
  );
}
