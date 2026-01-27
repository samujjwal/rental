import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const token = await getUserToken(request);
  
  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "30d";
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";
  
  const analyticsResponse = await fetch(`${API_BASE_URL}/admin/analytics/users?period=${period}`, { headers });
  
  if (!analyticsResponse.ok) {
    throw new Response("Failed to fetch user analytics", { status: 500 });
  }
  
  const analyticsData = await analyticsResponse.json();
  
  return { analytics: analyticsData, period };
}

export default function AdminUserAnalytics() {
  const { analytics, period } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">User Analytics</h2>
        <p className="text-gray-600">User growth, engagement, and demographic insights for {period}</p>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">New Users</h3>
            <p className="text-2xl font-bold text-blue-600">{analytics.newUsers || 0}</p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Active Users</h3>
            <p className="text-2xl font-bold text-green-600">{analytics.activeUsers || 0}</p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Retention Rate</h3>
            <p className="text-2xl font-bold text-purple-600">{(analytics.retentionRate || 0).toFixed(1)}%</p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Avg. Session</h3>
            <p className="text-2xl font-bold text-orange-600">{Math.round((analytics.avgSessionDuration || 0) / 60)}m</p>
          </div>
        </div>
      </div>
    </div>
  );
}
