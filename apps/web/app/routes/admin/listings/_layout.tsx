import { Outlet } from "react-router";

export default function ListingsLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Listings Management</h1>
        <p className="text-gray-600">Manage property listings, approvals, and content moderation</p>
      </div>
      <Outlet />
    </div>
  );
}
