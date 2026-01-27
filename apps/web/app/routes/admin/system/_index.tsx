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
  
  const systemResponse = await fetch(`${API_BASE_URL}/admin/system/overview`, { headers });
  
  if (!systemResponse.ok) {
    throw new Response("Failed to fetch system overview", { status: 500 });
  }
  
  const systemData = await systemResponse.json();
  
  return { system: systemData };
}

export default function AdminSystemOverview() {
  const { system } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
        <p className="text-gray-600">Monitor system health, performance, and infrastructure status</p>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">System Status</h3>
            <p className={`text-lg font-bold ${system.overallStatus === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
              {system.overallStatus || 'Unknown'}
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Active Services</h3>
            <p className="text-lg font-bold text-blue-600">{system.activeServices || 0}</p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">System Load</h3>
            <p className="text-lg font-bold text-orange-600">{system.systemLoad || 0}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
