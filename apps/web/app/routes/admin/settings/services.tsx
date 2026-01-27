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
  
  const servicesResponse = await fetch(`${API_BASE_URL}/admin/settings/services`, { headers });
  
  if (!servicesResponse.ok) {
    throw new Response("Failed to fetch services", { status: 500 });
  }
  
  const servicesData = await servicesResponse.json();
  
  return { services: servicesData };
}

export default function AdminServiceSettings() {
  const { services } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Service Configuration</h2>
        <p className="text-gray-600">Configure external services and integrations</p>
        
        <div className="mt-6 space-y-6">
          {services.map((service: any) => (
            <div key={service.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-900">{service.name}</h3>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    defaultChecked={service.enabled}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">Enabled</label>
                </div>
              </div>
              
              <div className="space-y-3">
                {service.config.map((config: any) => (
                  <div key={config.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {config.label}
                    </label>
                    <input
                      type={config.type}
                      defaultValue={config.value}
                      placeholder={config.placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Save Service Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
