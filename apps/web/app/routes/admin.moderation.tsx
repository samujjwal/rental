import { requireAdmin } from "~/utils/auth.server";
import { type LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return {};
}

export default function AdminPlaceholder() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Page</h1>
        <p className="text-gray-600">This admin page is under construction</p>
      </div>
      
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-500">Content for this admin section will be implemented soon.</p>
      </div>
    </div>
  );
}
