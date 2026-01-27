import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const token = await getUserToken(request);
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";
  
  const paymentResponse = await fetch(`${API_BASE_URL}/admin/payments/${params.id}`, { headers });
  
  if (!paymentResponse.ok) {
    throw new Response("Payment not found", { status: 404 });
  }
  
  const paymentData = await paymentResponse.json();
  
  return paymentData;
}

export default function AdminPaymentDetail() {
  const payment = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Details</h2>
        <p className="text-gray-600">Transaction details and payment information</p>
        <p className="text-sm text-gray-400 mt-2">Payment ID: {payment.id}</p>
        
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Amount</p>
            <p className="text-lg font-bold text-gray-900">${payment.amount} {payment.currency}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="text-lg font-bold text-gray-900">{payment.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Method</p>
            <p className="text-lg font-bold text-gray-900">{payment.method}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Date</p>
            <p className="text-lg font-bold text-gray-900">{new Date(payment.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
