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
  
  const apiKeysResponse = await fetch(`${API_BASE_URL}/admin/settings/api-keys`, { headers });
  
  if (!apiKeysResponse.ok) {
    throw new Response("Failed to fetch API keys", { status: 500 });
  }
  
  const apiKeysData = await apiKeysResponse.json();
  
  return { apiKeys: apiKeysData.data || [] };
}

export default function AdminApiKeys() {
  const { apiKeys } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">API Keys Management</h2>
        <p className="text-gray-600">Generate and manage API keys for external integrations</p>
        
        <div className="mt-6">
          <div className="space-y-4">
            {apiKeys.map((apiKey: any) => (
              <div key={apiKey.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">{apiKey.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">Service: {apiKey.service}</p>
                    <p className="text-sm text-gray-500">Created: {new Date(apiKey.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    apiKey.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {apiKey.isActive ? 'Active' : 'Inactive'}
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
