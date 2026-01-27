import { requireAdmin } from "~/utils/auth.server";
import { type LoaderFunctionArgs } from "react-router";

export async function loader({ params, request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return { id: params.id };
}

export default function AdminEditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Page</h1>
        <p className="text-gray-600">Edit item details</p>
      </div>
      
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-500">Edit form for ID: This page is under construction</p>
      </div>
    </div>
  );
}
