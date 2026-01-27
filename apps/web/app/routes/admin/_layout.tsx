import { Outlet } from "react-router";
import { AdminSidebar } from "~/components/admin/AdminSidebar";
import { AdminHeader } from "~/components/admin/AdminHeader";

export default function AdminLayout() {
    console.log("AdminLayout rendering");
    return (
        <div className="min-h-screen bg-gray-50">
            <AdminHeader />
            <div className="flex">
                <AdminSidebar />
                <main className="flex-1 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
