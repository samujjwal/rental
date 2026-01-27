import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "react-router";
import { useAuthInit } from './hooks/useAuthInit';
import { useAuthStore } from './lib/store/auth';

import type { Route } from "./+types/root";
import stylesheet from "./tailwind.css?url";

export const links: Route.LinksFunction = () => [
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
];

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
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
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const isLoading = useAuthStore((state) => state.isLoading);

    useAuthInit();

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

    return <Outlet />;
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
