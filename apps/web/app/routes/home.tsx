import type { Route } from "./+types/home";
import { Link, Form } from "react-router";
import { DevUserSwitcher } from "~/components/DevUserSwitcher";

export function meta({}: Route.MetaArgs) {
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">R</span>
            </div>
            <span className="text-xl font-bold tracking-tight">
              Rental Portal
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/auth/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Log in
            </Link>
            <Link
              to="/auth/signup"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 hover:shadow-md"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-16 pb-32">
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-secondary opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>

        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
              Rent anything,
              <span className="text-primary block sm:inline">
                {" "}
                anytime, anywhere
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
              From power tools to party supplies, cameras to camping gear.
              Connect with people in your community to rent what you need, when
              you need it.
            </p>

            {/* Search Bar */}
            <div className="mt-10 max-w-xl mx-auto">
              <Form
                action="/search"
                method="get"
                className="relative flex items-center"
              >
                <input
                  type="text"
                  name="q"
                  placeholder="Search for items..."
                  className="w-full rounded-2xl border border-input bg-card px-6 py-4 pr-32 text-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 bottom-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:scale-[1.02]"
                >
                  Search
                </button>
              </Form>
            </div>

            <div className="mt-8 flex items-center justify-center gap-x-6">
              <Link
                to="/search"
                className="text-sm font-semibold leading-6 text-foreground hover:text-primary transition-colors"
              >
                Browse all categories <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="mx-auto mt-24 max-w-7xl">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <Link
                to="/search"
                className="group block rounded-2xl border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/20"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <svg
                    className="h-6 w-6"
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
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  Easy to find
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Search by location, category, or keywords. Find exactly what
                  you need nearby.
                </p>
              </Link>

              <Link
                to="/auth/signup"
                className="group block rounded-2xl border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/20"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <svg
                    className="h-6 w-6"
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
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  Safe & secure
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Verified users, secure payments, and condition reports ensure
                  safe transactions.
                </p>
              </Link>

              <Link
                to="/listings/new"
                className="group block rounded-2xl border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/20"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <svg
                    className="h-6 w-6"
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
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  Earn & save
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Rent out items you own to earn money, or save by renting
                  instead of buying.
                </p>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Dev User Switcher */}
      <DevUserSwitcher />
    </div>
  );
}
