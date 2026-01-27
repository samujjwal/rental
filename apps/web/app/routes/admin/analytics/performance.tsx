import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const token = await getUserToken(request);
  
  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "24h";
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";
  
  const performanceResponse = await fetch(`${API_BASE_URL}/admin/analytics/performance?period=${period}`, { headers });
  
  if (!performanceResponse.ok) {
    throw new Response("Failed to fetch performance analytics", { status: 500 });
  }
  
  const performanceData = await performanceResponse.json();
  
  return { performance: performanceData, period };
}

export default function AdminPerformanceAnalytics() {
  const { performance, period } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Analytics</h2>
        <p className="text-gray-600">System performance, response times, and health metrics for {period}</p>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Avg Response Time</h3>
            <p className="text-2xl font-bold text-blue-600">{performance.avgResponseTime || 0}ms</p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Uptime</h3>
            <p className="text-2xl font-bold text-green-600">{(performance.uptime || 0).toFixed(2)}%</p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Error Rate</h3>
            <p className="text-2xl font-bold text-red-600">{((performance.errorRate || 0) * 100).toFixed(2)}%</p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Requests/sec</h3>
            <p className="text-2xl font-bold text-purple-600">{performance.throughput || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
