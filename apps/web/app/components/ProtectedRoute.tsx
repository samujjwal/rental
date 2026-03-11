import { Navigate } from "react-router";
import { useAuthStore } from "~/lib/store/auth";

const ROLE_HIERARCHY: Record<string, number> = {
  renter: 1,
  owner: 2,
  admin: 3,
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "renter" | "owner" | "admin";
}

export function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const { user, accessToken } = useAuthStore();

  // Check if user is authenticated
  if (!accessToken || !user) {
    return <Navigate to="/auth/login" replace />;
  }

  // Check if user has required role (admin can access everything, owner can access renter routes)
  if (requiredRole) {
    const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
    if (userLevel < requiredLevel) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
