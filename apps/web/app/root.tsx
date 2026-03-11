
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useNavigate,
  useRevalidator,
} from "react-router";
import * as React from "react";
import { useAuthInit } from "./hooks/useAuthInit";
import { useAuthStore } from "./lib/store/auth";
import { getUser, getSession } from "~/utils/auth";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OfflineBanner, RouteErrorBoundary } from "~/components/ui";
import { ToastManager } from "~/components/ui/toast-manager";
import { SkipLink } from "~/components/accessibility/SkipLink";
import { PageTransition } from "~/components/animations/PageTransition";
import type { User as AuthUser } from "~/types/auth";
import { APP_LANG } from "~/config/locale";
import "~/i18n"; // Initialize i18next

import type { LinksFunction } from "react-router";
import stylesheet from "./tailwind.css?url";
import mapStyles from "./styles/map.css?url";

// QueryClient factory — must NOT be module-level in SSR to avoid cross-request data leaks
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  { rel: "stylesheet", href: stylesheet },
  { rel: "stylesheet", href: mapStyles },
];

export async function clientLoader({ request }: { request: Request }) {
  const user = await getUser(request);
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  const refreshToken = session.get("refreshToken");

  return {
    user,
    accessToken,
    refreshToken,
    ENV: {
      API_URL: import.meta.env.VITE_API_URL || "http://localhost:3400/api",
    },
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={APP_LANG} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Inline theme init to prevent FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme-preference');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.classList.toggle('light',!d);var l=localStorage.getItem('language-preference');if(l)document.documentElement.lang=l}catch(e){}})()`
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function RootContent() {
  // SSR-safe QueryClient: on the server, create a new one per request;
  // on the browser, reuse a singleton so React Query cache persists.
  const queryClient = (() => {
    if (typeof window === 'undefined') return makeQueryClient();
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  })();

  const loaderData = useLoaderData<typeof clientLoader>();
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  useAuthInit();

  // Allow non-component code (e.g., API client, error boundaries) to request
  // navigation/revalidation without using hard reloads.
  useEffect(() => {
    function onNavigate(event: Event) {
      const customEvent = event as CustomEvent<{ to: string; replace?: boolean }>;
      if (!customEvent.detail?.to) {
        return;
      }
      navigate(customEvent.detail.to, { replace: !!customEvent.detail.replace });
    }

    function onRevalidate() {
      revalidator.revalidate();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("app:navigate", onNavigate);
      window.addEventListener("app:revalidate", onRevalidate);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("app:navigate", onNavigate);
        window.removeEventListener("app:revalidate", onRevalidate);
      }
    };
  }, [navigate, revalidator]);

  // Sync server-side auth to client-side store if needed
  useEffect(() => {
    if (
      loaderData?.user &&
      loaderData?.accessToken
    ) {
      const currentStore = useAuthStore.getState();
      if (
        !currentStore.user ||
        currentStore.accessToken !== loaderData.accessToken
      ) {
        setAuth(
          loaderData.user as unknown as AuthUser,
          loaderData.accessToken
        );

        // New tokens should invalidate any stale loaders.
        revalidator.revalidate();
      }
    }
  }, [loaderData, setAuth, revalidator]);

  // Show loading state while restoring session
  if (!isInitialized || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SkipLink />
      <OfflineBanner />
      <ToastManager />
      <div id="main-content" tabIndex={-1}>
        <PageTransition mode="fade" duration={0.2}>
          <Outlet />
        </PageTransition>
      </div>
    </QueryClientProvider>
  );
}

export default function Root() {
  return <RootContent />;
}

export function HydrateFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// Global error boundary for the entire app
export { RouteErrorBoundary as ErrorBoundary };
