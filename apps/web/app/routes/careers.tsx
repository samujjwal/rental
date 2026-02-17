import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { RouteErrorBoundary } from "~/components/ui";
import { Code2, Palette, BarChart3, Headphones } from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "Careers | GharBatai Rentals" },
    { name: "description", content: "Join our team and help build a more connected rental economy." },
  ];
};

const departments = [
  { icon: Code2, name: "Engineering", description: "Build the platform that powers peer-to-peer rentals at scale." },
  { icon: Palette, name: "Design", description: "Create intuitive experiences that delight renters and owners." },
  { icon: BarChart3, name: "Product & Growth", description: "Shape the product roadmap and expand our marketplace." },
  { icon: Headphones, name: "Support & Trust", description: "Keep our community safe and help users succeed." },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Join Our Team</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Help us build a more connected rental economy. We're looking for passionate people who
            want to make it easy for anyone to rent anything.
          </p>
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-semibold text-center">Our Teams</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {departments.map((dept) => (
              <div key={dept.name} className="rounded-xl border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <dept.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{dept.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{dept.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 rounded-xl border bg-card p-8 text-center">
          <h2 className="text-2xl font-semibold">No Open Positions Right Now</h2>
          <p className="mt-2 text-muted-foreground">
            We don't have any open positions at the moment, but we're always interested in hearing
            from talented people. Send your resume and we'll keep it on file.
          </p>
          <div className="mt-6">
            <a
              href="mailto:careers@gharbatai.com"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Send Your Resume
            </a>
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
