import { Outlet } from "react-router";

export default function PaymentsLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments & Financials</h1>
        <p className="text-gray-600">Manage payment transactions, refunds, and financial analytics</p>
      </div>
      <Outlet />
    </div>
  );
}
