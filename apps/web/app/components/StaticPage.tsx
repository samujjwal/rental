import { Link } from "react-router";

type StaticPageProps = {
  title: string;
  description: string;
  callToAction?: {
    label: string;
    href: string;
  };
};

export function StaticPage({ title, description, callToAction }: StaticPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{description}</p>
          {callToAction && (
            <div className="mt-8">
              <Link
                to={callToAction.href}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                {callToAction.label}
              </Link>
            </div>
          )}
          <div className="mt-8 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
