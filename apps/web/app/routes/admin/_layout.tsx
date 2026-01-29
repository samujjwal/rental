import { Outlet } from "react-router";
import AdminNavigation from '~/components/admin/AdminNavigation';

export default function AdminLayout() {
    return (
        <div className="flex min-h-screen bg-gray-50">
            <AdminNavigation />
            <main className="flex-1 p-6 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}
