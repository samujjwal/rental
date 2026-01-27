import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const token = await getUserToken(request);
  
  const url = new URL(request.url);
  const level = url.searchParams.get("level") || "all";
  const limit = parseInt(url.searchParams.get("limit") || "100");
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";
  
  const logsResponse = await fetch(`${API_BASE_URL}/admin/system/logs?level=${level}&limit=${limit}`, { headers });
  
  if (!logsResponse.ok) {
    throw new Response("Failed to fetch logs", { status: 500 });
  }
  
  const logsData = await logsResponse.json();
  
  return { logs: logsData.data || [], level, limit };
}

export default function AdminSystemLogs() {
  const { logs, level, limit } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Logs</h2>
        <p className="text-gray-600">View and filter system logs for debugging and monitoring</p>
        
        <div className="mt-6">
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
            {logs.map((log: any) => (
              <div key={log.id} className="mb-2">
                <span className="text-gray-400">
                  [{new Date(log.timestamp).toLocaleString()}]
                </span>
                <span className={`ml-2 ${
                  log.level === 'ERROR' ? 'text-red-400' :
                  log.level === 'WARN' ? 'text-yellow-400' :
                  log.level === 'INFO' ? 'text-blue-400' :
                  'text-gray-300'
                }`}>
                  [{log.level}]
                </span>
                <span className="ml-2">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
