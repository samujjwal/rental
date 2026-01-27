import { Outlet } from "react-router";

export default function AnalyticsLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Reporting</h1>
        <p className="text-gray-600">Comprehensive insights into platform performance and user behavior</p>
      </div>
      <Outlet />
    </div>
  );
}
