import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const token = await getUserToken(request);
  
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const action = url.searchParams.get("action") || "";
  const userId = url.searchParams.get("userId") || "";
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";
  
  const auditResponse = await fetch(`${API_BASE_URL}/admin/system/audit?page=${page}&limit=${limit}&action=${action}&userId=${userId}`, { headers });
  
  if (!auditResponse.ok) {
    throw new Response("Failed to fetch audit logs", { status: 500 });
  }
  
  const auditData = await auditResponse.json();
  
  return { 
    logs: auditData.data || [], 
    pagination: auditData.pagination || { page, limit, total: 0, totalPages: 0 },
    filters: { action, userId }
  };
}

export default function AdminAuditLogs() {
  const { logs, pagination, filters } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Audit Logs</h2>
        <p className="text-gray-600">Track user actions and system changes for compliance and security</p>
        
        <div className="mt-6">
          <div className="space-y-2">
            {logs.map((log: any) => (
              <div key={log.id} className="border-b pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium text-gray-900">{log.action}</span>
                    <span className="text-sm text-gray-500 ml-2">by {log.user?.name}</span>
                    <div className="text-sm text-gray-500">{log.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">{new Date(log.timestamp).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-400">{log.ipAddress}</div>
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
