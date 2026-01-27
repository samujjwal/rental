import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  const token = await getUserToken(request);
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";
  
  const [orgResponse, membersResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/admin/organizations/${params.id}`, { headers }),
    fetch(`${API_BASE_URL}/admin/organizations/${params.id}/members`, { headers }),
  ]);
  
  if (!orgResponse.ok) {
    throw new Response("Organization not found", { status: 404 });
  }
  
  const orgData = await orgResponse.json();
  const membersData = membersResponse.ok ? await membersResponse.json() : { data: [] };
  
  return { organization: orgData, members: membersData.data || [] };
}

export default function AdminOrganizationMembers() {
  const { organization, members } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Organization Members</h2>
        <p className="text-gray-600">Manage members of {organization.name}</p>
        
        <div className="mt-6">
          <div className="space-y-4">
            {members.map((member: any) => (
              <div key={member.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {member.firstName} {member.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">{member.email}</p>
                    <p className="text-sm text-gray-500">Role: {member.role}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    member.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {member.status}
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
