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
  
  const reportsResponse = await fetch(`${API_BASE_URL}/admin/analytics/reports`, { headers });
  
  if (!reportsResponse.ok) {
    throw new Response("Failed to fetch reports", { status: 500 });
  }
  
  const reportsData = await reportsResponse.json();
  
  return { reports: reportsData.data || [] };
}

export default function AdminReports() {
  const { reports } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Custom Reports</h2>
        <p className="text-gray-600">Generate and manage custom analytics reports</p>
        
        <div className="mt-6">
          <div className="space-y-4">
            {reports.map((report: any) => (
              <div key={report.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">{report.name}</h3>
                    <p className="text-sm text-gray-500">{report.description}</p>
                    <p className="text-sm text-gray-500">Type: {report.type}</p>
                    <p className="text-sm text-gray-500">Last generated: {new Date(report.lastGenerated).toLocaleDateString()}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                      Generate
                    </button>
                    <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
                      Download
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <button className="mt-6 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Create New Report
          </button>
        </div>
      </div>
    </div>
  );
}
