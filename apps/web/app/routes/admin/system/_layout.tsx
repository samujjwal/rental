import { Outlet } from "react-router";

export default function SystemLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Management</h1>
        <p className="text-gray-600">Monitor system health, logs, and maintain platform infrastructure</p>
      </div>
      <Outlet />
    </div>
  );
}
