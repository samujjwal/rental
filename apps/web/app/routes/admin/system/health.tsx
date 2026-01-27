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
  
  const healthResponse = await fetch(`${API_BASE_URL}/admin/system/health`, { headers });
  
  if (!healthResponse.ok) {
    throw new Response("Failed to fetch system health", { status: 500 });
  }
  
  const healthData = await healthResponse.json();
  
  return { health: healthData };
}

export default function AdminSystemHealth() {
  const { health } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Health</h2>
        <p className="text-gray-600">Monitor system performance and infrastructure health</p>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">API Status</h3>
            <p className={`text-lg font-bold ${health.api?.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
              {health.api?.status || 'Unknown'}
            </p>
            <p className="text-sm text-gray-500">{health.api?.responseTime || 0}ms</p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Database</h3>
            <p className={`text-lg font-bold ${health.database?.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
              {health.database?.status || 'Unknown'}
            </p>
            <p className="text-sm text-gray-500">{health.database?.responseTime || 0}ms</p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Redis Cache</h3>
            <p className={`text-lg font-bold ${health.redis?.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
              {health.redis?.status || 'Unknown'}
            </p>
            <p className="text-sm text-gray-500">{health.redis?.responseTime || 0}ms</p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Uptime</h3>
            <p className="text-lg font-bold text-green-600">{health.uptime || 99.9}%</p>
            <p className="text-sm text-gray-500">Last 30 days</p>
          </div>
        </div>
      </div>
    </div>
  );
}
