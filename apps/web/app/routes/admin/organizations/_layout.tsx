import { Outlet } from "react-router";

export default function OrganizationsLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <p className="text-gray-600">Manage organizations, members, and subscription plans</p>
      </div>
      <Outlet />
    </div>
  );
}
