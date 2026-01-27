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
  
  const dbResponse = await fetch(`${API_BASE_URL}/admin/system/database`, { headers });
  
  if (!dbResponse.ok) {
    throw new Response("Failed to fetch database info", { status: 500 });
  }
  
  const dbData = await dbResponse.json();
  
  return { database: dbData };
}

export default function AdminDatabaseManagement() {
  const { database } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Database Management</h2>
        <p className="text-gray-600">Monitor database performance and manage data operations</p>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Database Status</h3>
            <p className={`text-lg font-bold ${database.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
              {database.status || 'Unknown'}
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Connection Pool</h3>
            <p className="text-lg font-bold text-blue-600">{database.activeConnections || 0}/{database.maxConnections || 0}</p>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900">Query Time</h3>
            <p className="text-lg font-bold text-orange-600">{database.avgQueryTime || 0}ms</p>
          </div>
        </div>
        
        <div className="mt-6">
          <h3 className="font-medium text-gray-900 mb-4">Database Operations</h3>
          <div className="flex space-x-3">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Run Query
            </button>
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              View Schema
            </button>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              Optimize Tables
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
