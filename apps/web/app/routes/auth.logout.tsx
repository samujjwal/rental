import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authApi } from "~/lib/api/auth";
import { useAuthStore } from "~/lib/store/auth";
import { getSession, sessionStorage as cookieSessionStorage } from "~/utils/auth";
import { RouteErrorBoundary } from "~/components/ui";
import { useTranslation } from "react-i18next";

const getRefreshToken = () =>
  typeof window !== "undefined" ? null : null; // B-29: refresh token is now in httpOnly cookie

async function performLogout() {
  // B-29: Refresh token is sent automatically via httpOnly cookie.
  // Call logout endpoint to clear the cookie server-side.
  try {
    await authApi.logout();
  } catch {
    // ignored
  }

  // Clear auth store (single source of truth — also removes persist key)
  useAuthStore.getState().clearAuth();

  if (typeof window !== "undefined") {
    window.sessionStorage.clear();
  }
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
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-muted-foreground">{t("auth.loggingOut")}</p>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

