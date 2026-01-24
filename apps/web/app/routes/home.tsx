import type { Route } from "./+types/home";
import { Link } from "react-router";

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "Universal Rental Portal" },
        {
            name: "description",
            content: "Rent anything, anytime, anywhere",
        },
    ];
}

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
            {/* Navigation */}
            <nav className="border-b bg-white/80 backdrop-blur-sm">
                <div className="container mx-auto flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
                            <span className="text-lg font-bold text-white">R</span>
                        </div>
                        <span className="text-xl font-bold">Rental Portal</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            to="/auth/login"
                            className="text-sm font-medium text-gray-700 hover:text-primary-600"
                        >
                            Log in
                        </Link>
                        <Link
                            to="/auth/signup"
                            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                        >
                            Sign up
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="container mx-auto px-4 py-20">
                <div className="mx-auto max-w-3xl text-center">
                    <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                        Rent anything,
                        <span className="text-primary-600"> anytime, anywhere</span>
                    </h1>
                    <p className="mt-6 text-lg leading-8 text-gray-600">
                        From power tools to party supplies, cameras to camping gear. Connect
                        with people in your community to rent what you need, when you need
                        it.
                    </p>
                    <div className="mt-10 flex items-center justify-center gap-x-6">
                        <Link
                            to="/search"
                            className="rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                        >
                            Start browsing
                        </Link>
                        <Link
                            to="/list-item"
                            className="text-base font-semibold leading-7 text-gray-900 hover:text-primary-600"
                        >
                            List an item <span aria-hidden="true">→</span>
                        </Link>
                    </div>
                </div>

                {/* Features */}
                <div className="mx-auto mt-20 max-w-7xl">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
                                <svg
                                    className="h-6 w-6 text-primary-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                Easy to find
                            </h3>
                            <p className="mt-2 text-sm text-gray-600">
                                Search by location, category, or keywords. Find exactly what you
                                need nearby.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
                                <svg
                                    className="h-6 w-6 text-primary-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                Safe & secure
                            </h3>
                            <p className="mt-2 text-sm text-gray-600">
                                Verified users, secure payments, and condition reports ensure safe
                                transactions.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
                                <svg
                                    className="h-6 w-6 text-primary-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                Earn & save
                            </h3>
                            <p className="mt-2 text-sm text-gray-600">
                                Rent out items you own to earn money, or save by renting instead
                                of buying.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
