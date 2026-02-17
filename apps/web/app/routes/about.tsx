import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { RouteErrorBoundary } from "~/components/ui";
import { Shield, Users, Heart, Globe } from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "About Us | GharBatai Rentals" },
    { name: "description", content: "Learn about GharBatai and our mission to make renting easy and trustworthy." },
  ];
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">About GharBatai</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            We make it easy to rent anything from people you trust in your community — from tools
            and equipment to vehicles and spaces.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Community First</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              We connect neighbors who have items to spare with those who need them. Every rental
              strengthens trust in your local community.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Verified &amp; Secure</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Identity verification, secure payments through Stripe, insurance options, and a
              dispute resolution system keep every transaction safe.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Sustainability</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Renting instead of buying reduces waste and puts resources to better use. We believe
              access is more valuable than ownership.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">For Everyone</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Whether you're a renter looking for the perfect item or an owner earning from your
              assets, GharBatai works for you.
            </p>
          </div>
        </div>

        <div className="mt-16 rounded-xl border bg-card p-8 text-center">
          <h2 className="text-2xl font-semibold">Ready to Get Started?</h2>
          <p className="mt-2 text-muted-foreground">
            Join thousands of users already renting on GharBatai.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              to="/search"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Browse Listings
            </Link>
            <Link
              to="/become-owner"
              className="inline-flex items-center justify-center rounded-lg border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-accent"
            >
              Become an Owner
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
