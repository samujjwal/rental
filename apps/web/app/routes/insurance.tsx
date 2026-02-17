import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { RouteErrorBoundary } from "~/components/ui";
import { Shield, FileCheck, AlertCircle, CheckCircle } from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "Insurance | GharBatai Rentals" },
    { name: "description", content: "Learn how GharBatai protects renters and owners with flexible coverage options." },
  ];
};

const coverageTypes = [
  {
    icon: Shield,
    title: "Property Protection",
    description: "Coverage for damage, loss, or theft of rented items during the rental period.",
  },
  {
    icon: FileCheck,
    title: "Liability Coverage",
    description: "Protection against third-party claims arising from the use of rented items.",
  },
  {
    icon: AlertCircle,
    title: "Security Deposits",
    description: "Owners can require refundable deposits held by the platform until the item is returned safely.",
  },
];

export default function InsurancePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Insurance &amp; Protection</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Rent with confidence. GharBatai offers multiple layers of protection for both renters
            and owners.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {coverageTypes.map((type) => (
            <div key={type.title} className="rounded-xl border bg-card p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <type.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{type.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{type.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold">For Owners</h2>
            <div className="mt-4 rounded-xl border bg-card p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">Upload Insurance Documents</h4>
                  <p className="text-sm text-muted-foreground">
                    Certain categories (vehicles, high-value items) require proof of insurance
                    before your listing goes live. Upload your policy through the listing dashboard.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">Set Security Deposits</h4>
                  <p className="text-sm text-muted-foreground">
                    Add a fixed or percentage-based deposit to your listing. Deposits are collected
                    at booking and held until the item is returned in good condition.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">Damage Claims</h4>
                  <p className="text-sm text-muted-foreground">
                    If an item is returned damaged, file a dispute with photographic evidence.
                    Our team will review and facilitate resolution.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">For Renters</h2>
            <div className="mt-4 rounded-xl border bg-card p-6 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">Secure Payments</h4>
                  <p className="text-sm text-muted-foreground">
                    All payments are processed securely through Stripe. Your payment details are
                    never stored on our servers.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">Dispute Resolution</h4>
                  <p className="text-sm text-muted-foreground">
                    If something goes wrong with your rental, file a dispute within 48 hours
                    of the rental end date. Our team mediates between parties.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <h4 className="font-medium">Refund Protection</h4>
                  <p className="text-sm text-muted-foreground">
                    Cancellations made more than 48 hours before the start date are eligible
                    for a full refund. Late cancellations follow the owner's policy.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 rounded-xl border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">Have Questions About Coverage?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Contact our support team for help with insurance requirements or claims.
          </p>
          <div className="mt-4 flex justify-center gap-4">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Contact Support
            </Link>
            <Link
              to="/help"
              className="inline-flex items-center justify-center rounded-lg border bg-background px-5 py-2.5 text-sm font-semibold hover:bg-accent"
            >
              Help Center
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
