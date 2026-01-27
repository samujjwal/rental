import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const token = await getUserToken(request);
  
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";
  
  const ledgerResponse = await fetch(`${API_BASE_URL}/admin/payments/ledger?page=${page}&limit=${limit}`, { headers });
  
  if (!ledgerResponse.ok) {
    throw new Response("Failed to fetch ledger", { status: 500 });
  }
  
  const ledgerData = await ledgerResponse.json();
  
  return { 
    transactions: ledgerData.data || [], 
    pagination: ledgerData.pagination || { page, limit, total: 0, totalPages: 0 }
  };
}

export default function AdminLedger() {
  const { transactions, pagination } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Financial Ledger</h2>
        <p className="text-gray-600">Complete financial transaction history and accounting records</p>
        
        <div className="mt-6">
          <div className="space-y-2">
            {transactions.map((transaction: any) => (
              <div key={transaction.id} className="border-b pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-900">{transaction.type}</span>
                    <span className="text-sm text-gray-500 ml-2">{transaction.description}</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-medium ${
                      transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}${transaction.amount}
                    </span>
                    <div className="text-xs text-gray-500">{new Date(transaction.date).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
