import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { RouteErrorBoundary } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | GharBatai Rentals" },
    { name: "description", content: "Learn how we collect, use, and protect your data." },
  ];
};

export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight">{t("pages.privacy.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("pages.privacy.lastUpdated")}: {t("pages.privacy.lastUpdatedDate")}</p>

        <div className="mt-10 space-y-8 text-base leading-7 text-foreground/80">
          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.privacy.section1")}</h2>
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
            <h2 className="text-xl font-semibold text-foreground">{t("pages.privacy.section2")}</h2>
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
            <h2 className="text-xl font-semibold text-foreground">{t("pages.privacy.section3")}</h2>
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
            <h2 className="text-xl font-semibold text-foreground">{t("pages.privacy.section4")}</h2>
            <p className="mt-2">
              We implement industry-standard security measures, including encryption of data in
              transit (TLS) and at rest, secure password hashing, and regular security audits. Payment
              information is handled directly by Stripe and never stored on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.privacy.section5")}</h2>
            <p className="mt-2">
              We use essential cookies for authentication and session management. We may also use
              analytics cookies to understand how users interact with our platform. You can manage
              cookie preferences in your browser settings. See our{" "}
              <Link to="/cookies" className="text-primary hover:underline">Cookie Policy</Link>{" "}
              for details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.privacy.section6")}</h2>
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
            <h2 className="text-xl font-semibold text-foreground">{t("pages.privacy.section7")}</h2>
            <p className="mt-2">
              We retain your personal data for as long as your account is active or as needed to
              provide services. After account deletion, we retain certain data for up to 3 years to
              comply with legal obligations, resolve disputes, and enforce agreements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.privacy.section8")}</h2>
            <p className="mt-2">
              We may update this policy from time to time. We will notify you of material changes via
              email or an in-app notice. Continued use of GharBatai after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.privacy.section9")}</h2>
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
          <Link to="/terms" className="hover:text-primary">{t("pages.privacy.termsOfService")}</Link>
          <span>·</span>
          <Link to="/cookies" className="hover:text-primary">{t("pages.privacy.cookiePolicy")}</Link>
          <span>·</span>
          <Link to="/" className="hover:text-primary">{t("common.backToHome")}</Link>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
