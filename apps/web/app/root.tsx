import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLoaderData,
} from "react-router";
import { useAuthInit } from './hooks/useAuthInit';
import { useAuthStore } from './lib/store/auth';
import { getUser, getUserToken, getSession } from "~/utils/auth.server";
import { useEffect } from "react";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

import type { Route } from "./+types/root";
import stylesheet from "./tailwind.css?url";

// Create a Material-UI theme
const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
});

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

export async function loader({ request }: { request: Request }) {
    const user = await getUser(request);
    const session = await getSession(request);
    const accessToken = session.get("accessToken");
    const refreshToken = session.get("refreshToken");

    return {
        user,
        accessToken,
        refreshToken,
        ENV: {
            API_URL: process.env.API_URL || "http://localhost:3400/api/v1",
        },
    };
}

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
    const loaderData = useLoaderData<typeof loader>();
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const isLoading = useAuthStore((state) => state.isLoading);
    const setAuth = useAuthStore((state) => state.setAuth);

    useAuthInit();

    // Sync server-side auth to client-side store if needed
    useEffect(() => {
        if (loaderData?.user && loaderData?.accessToken && loaderData?.refreshToken) {
            const currentStore = useAuthStore.getState();
            if (!currentStore.user || currentStore.accessToken !== loaderData.accessToken) {
                setAuth(loaderData.user, loaderData.accessToken, loaderData.refreshToken);
            }
        }
    }, [loaderData, setAuth]);

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
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Outlet />
        </ThemeProvider>
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
