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
  
  const categoriesResponse = await fetch(`${API_BASE_URL}/admin/categories`, { headers });
  
  if (!categoriesResponse.ok) {
    throw new Response("Failed to fetch categories", { status: 500 });
  }
  
  const categoriesData = await categoriesResponse.json();
  
  return { categories: categoriesData.data || [] };
}

export default function AdminCategories() {
  const { categories } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Categories Management</h2>
        <p className="text-gray-600">Manage listing categories and classifications</p>
        
        <div className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category: any) => (
              <div key={category.id} className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900">{category.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{category.slug}</p>
                <p className="text-xs text-gray-400 mt-2">{category.listingsCount || 0} listings</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
