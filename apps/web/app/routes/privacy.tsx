import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { RouteErrorBoundary } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | GharBatai Rentals" },
    { name: "description", content: "Learn how we collect, use, and protect your data." },
  ];
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2025</p>

        <div className="mt-10 space-y-8 text-base leading-7 text-foreground/80">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
            <p className="mt-2">
              When you create an account, list an item, or make a booking, we collect personal
              information you provide, such as your name, email address, phone number, payment
              details, and government-issued identification (for verified listings).
            </p>
            <p className="mt-2">
              We also collect usage data automatically, including your IP address, browser type,
              pages visited, search queries, and interaction patterns to improve our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Information</h2>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>To create and manage your account</li>
              <li>To process bookings and facilitate payments between renters and owners</li>
              <li>To verify identities and prevent fraud</li>
              <li>To send booking confirmations, reminders, and service updates</li>
              <li>To improve our platform, features, and user experience</li>
              <li>To comply with legal obligations and resolve disputes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Information Sharing</h2>
            <p className="mt-2">
              We share your information only as necessary to provide our services:
            </p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li><strong>Between parties:</strong> Renter and owner details are shared when a booking is confirmed</li>
              <li><strong>Payment processors:</strong> We use Stripe to process payments securely</li>
              <li><strong>Service providers:</strong> Trusted vendors who help us operate (email, hosting, analytics)</li>
              <li><strong>Legal compliance:</strong> When required by law, court order, or to protect our rights</li>
            </ul>
            <p className="mt-2">We never sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Data Security</h2>
            <p className="mt-2">
              We implement industry-standard security measures, including encryption of data in
              transit (TLS) and at rest, secure password hashing, and regular security audits. Payment
              information is handled directly by Stripe and never stored on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Cookies &amp; Tracking</h2>
            <p className="mt-2">
              We use essential cookies for authentication and session management. We may also use
              analytics cookies to understand how users interact with our platform. You can manage
              cookie preferences in your browser settings. See our{" "}
              <Link to="/cookies" className="text-primary hover:underline">Cookie Policy</Link>{" "}
              for details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Your Rights</h2>
            <p className="mt-2">Depending on your location, you may have the right to:</p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>Access and download a copy of your personal data</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your account and data</li>
              <li>Opt out of marketing communications</li>
              <li>Restrict or object to certain processing activities</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, contact us at{" "}
              <a href="mailto:privacy@gharbatai.com" className="text-primary hover:underline">
                privacy@gharbatai.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
            <p className="mt-2">
              We retain your personal data for as long as your account is active or as needed to
              provide services. After account deletion, we retain certain data for up to 3 years to
              comply with legal obligations, resolve disputes, and enforce agreements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this policy from time to time. We will notify you of material changes via
              email or an in-app notice. Continued use of GharBatai after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Contact Us</h2>
            <p className="mt-2">
              If you have questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:privacy@gharbatai.com" className="text-primary hover:underline">
                privacy@gharbatai.com
              </a>{" "}
              or visit our <Link to="/contact" className="text-primary hover:underline">Contact page</Link>.
            </p>
          </section>
        </div>

        <div className="mt-12 flex gap-4 text-sm text-muted-foreground">
          <Link to="/terms" className="hover:text-primary">Terms of Service</Link>
          <span>·</span>
          <Link to="/cookies" className="hover:text-primary">Cookie Policy</Link>
          <span>·</span>
          <Link to="/" className="hover:text-primary">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
