import { requireAdmin } from "~/utils/auth.server";
import { type LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
    await requireAdmin(request);
    return { success: true, data: [] };
}

export default function AdminPlaceholder() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Imports/Exports</h1>
            <p>This functionality is under construction.</p>
        </div>
    );
}
