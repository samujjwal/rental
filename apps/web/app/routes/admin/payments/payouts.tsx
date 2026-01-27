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
  
  const payoutsResponse = await fetch(`${API_BASE_URL}/admin/payments/payouts`, { headers });
  
  if (!payoutsResponse.ok) {
    throw new Response("Failed to fetch payouts", { status: 500 });
  }
  
  const payoutsData = await payoutsResponse.json();
  
  return { payouts: payoutsData.data || [] };
}

export default function AdminPayouts() {
  const { payouts } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Payouts Management</h2>
        <p className="text-gray-600">Manage payouts to property owners and service providers</p>
        
        <div className="mt-6">
          <div className="space-y-4">
            {payouts.map((payout: any) => (
              <div key={payout.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">Payout #{payout.id.slice(0, 8)}</h3>
                    <p className="text-sm text-gray-500">Recipient: {payout.recipient?.name}</p>
                    <p className="text-sm text-gray-500">Amount: ${payout.amount}</p>
                    <p className="text-sm text-gray-500">Period: {payout.period}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    payout.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    payout.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {payout.status}
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
