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
  
  const backupsResponse = await fetch(`${API_BASE_URL}/admin/system/backups`, { headers });
  
  if (!backupsResponse.ok) {
    throw new Response("Failed to fetch backups", { status: 500 });
  }
  
  const backupsData = await backupsResponse.json();
  
  return { backups: backupsData.data || [] };
}

export default function AdminBackupManagement() {
  const { backups } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Backup Management</h2>
        <p className="text-gray-600">Manage database backups and recovery operations</p>
        
        <div className="mt-6">
          <div className="space-y-4">
            {backups.map((backup: any) => (
              <div key={backup.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">Backup #{backup.id.slice(0, 8)}</h3>
                    <p className="text-sm text-gray-500">Type: {backup.type}</p>
                    <p className="text-sm text-gray-500">Size: {(backup.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p className="text-sm text-gray-500">Created: {new Date(backup.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      backup.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      backup.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {backup.status}
                    </span>
                    <div className="flex space-x-2">
                      <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                        Restore
                      </button>
                      <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex space-x-3">
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Create Backup
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Schedule Backup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
