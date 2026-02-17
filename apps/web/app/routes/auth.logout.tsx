import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authApi } from "~/lib/api/auth";
import { useAuthStore } from "~/lib/store/auth";
import { getSession, sessionStorage as cookieSessionStorage } from "~/utils/auth";
import { RouteErrorBoundary } from "~/components/ui";

const getRefreshToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;

async function performLogout() {
  const refreshToken = getRefreshToken();

  // Invalidate server session before clearing local tokens.
  if (refreshToken) {
    try {
      await authApi.logout(refreshToken);
    } catch (error) {
      console.error("Logout API error (ignoring):", error);
    }
  }

  if (typeof window !== "undefined") {
    // Clear all auth-related storage immediately
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("auth-storage");
    window.sessionStorage.clear();
  }
  
  // Clear auth store
  useAuthStore.getState().clearAuth();
}

async function clearServerSession(request: Request) {
  const session = await getSession(request);
  return cookieSessionStorage.destroySession(session);
}

export async function clientAction({ request }: ActionFunctionArgs) {
  await performLogout();
  const destroyedCookie = await clearServerSession(request);
  
  // Force client-side navigation to ensure fresh auth check
  return redirect("/auth/login", {
    headers: {
      "Set-Cookie": destroyedCookie,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await performLogout();
  const destroyedCookie = await clearServerSession(request);
  
  return redirect("/auth/login", {
    headers: {
      "Set-Cookie": destroyedCookie,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

export default function LogoutPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-muted-foreground">Logging out...</p>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
