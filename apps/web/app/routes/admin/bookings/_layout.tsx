import { Outlet } from "react-router";

export default function BookingsLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bookings Management</h1>
        <p className="text-gray-600">Manage booking reservations, payments, and disputes</p>
      </div>
      <Outlet />
    </div>
  );
}
