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
  
  const settingsResponse = await fetch(`${API_BASE_URL}/admin/settings/general`, { headers });
  
  if (!settingsResponse.ok) {
    throw new Response("Failed to fetch settings", { status: 500 });
  }
  
  const settingsData = await settingsResponse.json();
  
  return { settings: settingsData };
}

export default function AdminGeneralSettings() {
  const { settings } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">General Settings</h2>
        <p className="text-gray-600">Configure general platform settings and preferences</p>
        
        <div className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
            <input
              type="text"
              defaultValue={settings.siteName}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Site URL</label>
            <input
              type="url"
              defaultValue={settings.siteUrl}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
            <input
              type="email"
              defaultValue={settings.contactEmail}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              defaultChecked={settings.allowRegistration}
              className="mr-2"
            />
            <label className="text-sm text-gray-700">Allow User Registration</label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              defaultChecked={settings.requireEmailVerification}
              className="mr-2"
            />
            <label className="text-sm text-gray-700">Require Email Verification</label>
          </div>
          
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
