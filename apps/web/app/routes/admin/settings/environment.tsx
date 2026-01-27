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
  
  const envResponse = await fetch(`${API_BASE_URL}/admin/settings/environment`, { headers });
  
  if (!envResponse.ok) {
    throw new Response("Failed to fetch environment variables", { status: 500 });
  }
  
  const envData = await envResponse.json();
  
  return { environment: envData };
}

export default function AdminEnvironmentSettings() {
  const { environment } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Environment Variables</h2>
        <p className="text-gray-600">Manage environment variables and configuration secrets</p>
        
        <div className="mt-6">
          <div className="space-y-4">
            {environment.map((envVar: any) => (
              <div key={envVar.key} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {envVar.key}
                    </label>
                    <p className="text-xs text-gray-500">{envVar.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    envVar.isSecret ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {envVar.isSecret ? 'Secret' : 'Public'}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type={envVar.isSecret ? 'password' : 'text'}
                    defaultValue={envVar.value}
                    placeholder={envVar.defaultValue}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                    {envVar.isSecret ? 'Show' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex space-x-3">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Save Environment Variables
            </button>
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              Download .env
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
