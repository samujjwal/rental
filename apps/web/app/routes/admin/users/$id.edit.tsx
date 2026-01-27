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

  // Fetch user details for editing
  const userResponse = await fetch(`${API_BASE_URL}/admin/users/${params.id}`, { headers });

  if (!userResponse.ok) {
    throw new Response("User not found", { status: 404 });
  }

  const userData = await userResponse.json();

  return userData;
}

export default function AdminUserEdit() {
  const user = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
        <p className="text-gray-600">Modify user information and settings</p>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-500">User edit form for {user.firstName} {user.lastName}</p>
        <p className="text-sm text-gray-400 mt-2">User ID: {user.id}</p>
      </div>
    </div>
  );
}
