import { Outlet } from "react-router";

export default function UsersLayout() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                <p className="text-gray-600">Manage user accounts, roles, and permissions</p>
            </div>
            <Outlet />
        </div>
    );
}
