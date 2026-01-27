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
  
  const listingsResponse = await fetch(`${API_BASE_URL}/admin/listings?status=PENDING`, { headers });
  
  if (!listingsResponse.ok) {
    throw new Response("Failed to fetch pending listings", { status: 500 });
  }
  
  const listingsData = await listingsResponse.json();
  
  return { listings: listingsData.data || [] };
}

export default function AdminPendingListings() {
  const { listings } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Listings</h2>
        <p className="text-gray-600">Review and approve pending property listings</p>
        
        <div className="mt-6">
          <div className="space-y-4">
            {listings.map((listing: any) => (
              <div key={listing.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">{listing.title}</h3>
                    <p className="text-sm text-gray-500">Owner: {listing.owner?.firstName} {listing.owner?.lastName}</p>
                    <p className="text-sm text-gray-500">Category: {listing.category?.name}</p>
                    <p className="text-sm text-gray-500">Submitted: {new Date(listing.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                      Approve
                    </button>
                    <button className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
