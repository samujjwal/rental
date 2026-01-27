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

  const orgResponse = await fetch(`${API_BASE_URL}/admin/organizations/${params.id}`, { headers });

  if (!orgResponse.ok) {
    throw new Response("Organization not found", { status: 404 });
  }

  const orgData = await orgResponse.json();

  return orgData;
}

export default function AdminOrganizationEdit() {
  const organization = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Organization</h2>
        <p className="text-gray-600">Modify organization details and settings</p>
        <p className="text-sm text-gray-400 mt-2">ID: {organization.id}</p>
      </div>
    </div>
  );
}
