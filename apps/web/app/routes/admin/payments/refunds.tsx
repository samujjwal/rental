import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const token = await getUserToken(request);
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";
  
  const refundsResponse = await fetch(`${API_BASE_URL}/admin/payments/refunds`, { headers });
  
  if (!refundsResponse.ok) {
    throw new Response("Failed to fetch refunds", { status: 500 });
  }
  
  const refundsData = await refundsResponse.json();
  
  return { refunds: refundsData.data || [] };
}

export default function AdminRefunds() {
  const { refunds } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Refunds Management</h2>
        <p className="text-gray-600">Process and track refund requests</p>
        
        <div className="mt-6">
          <div className="space-y-4">
            {refunds.map((refund: any) => (
              <div key={refund.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">Refund #{refund.id.slice(0, 8)}</h3>
                    <p className="text-sm text-gray-500 mt-1">Amount: ${refund.amount}</p>
                    <p className="text-sm text-gray-500">Reason: {refund.reason}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    refund.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    refund.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {refund.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
