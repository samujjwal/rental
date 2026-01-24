import { Navigate } from "react-router";
import { useAuthStore } from "~/lib/store/auth";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: "renter" | "owner" | "admin";
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
    const { user, accessToken } = useAuthStore();

    // Check if user is authenticated
    if (!accessToken || !user) {
        return <Navigate to="/auth/login" replace />;
    }

    // Check if user has required role
    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}
