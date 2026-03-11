import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { RouteErrorBoundary } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Terms of Service | GharBatai Rentals" },
    { name: "description", content: "Review the terms that govern use of the GharBatai platform." },
  ];
};

export default function TermsPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight">{t("pages.terms.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("pages.terms.lastUpdated")}: {t("pages.terms.lastUpdatedDate")}</p>

        <div className="mt-10 space-y-8 text-base leading-7 text-foreground/80">
          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.terms.section1")}</h2>
            <p className="mt-2">
              By accessing or using GharBatai ("the Platform"), you agree to be bound by these Terms
              of Service. If you do not agree, you may not use the Platform. We reserve the right to
              modify these terms at any time, with notice provided via email or in-app notification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.terms.section2")}</h2>
            <p className="mt-2">
              You must be at least 18 years old to create an account. You are responsible for
              maintaining the security of your account credentials and for all activity that occurs
              under your account. You agree to provide accurate, current, and complete information
              during registration.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.terms.section3")}</h2>
            <p className="mt-2">
              GharBatai provides a marketplace connecting individuals who wish to rent items
              ("Renters") with individuals who own items available for rent ("Owners"). GharBatai
              does not own, manage, or control any listed items and is not a party to rental
              agreements between users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.terms.section4")}</h2>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>Owners are responsible for the accuracy of their listing descriptions, pricing, and availability</li>
              <li>All listings are subject to review and may be removed if they violate our policies</li>
              <li>Bookings are binding once confirmed; cancellation policies apply as specified by the owner</li>
              <li>Renters must return items in the condition received, subject to normal wear and tear</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.terms.section5")}</h2>
            <p className="mt-2">
              All payments are processed through our payment partner, Stripe. GharBatai charges a
              platform fee (15% to owners) and a service fee (5% to renters) on each transaction.
              Payouts to owners are processed after the rental period is completed and any dispute
              window has closed.
            </p>
            <p className="mt-2">
              Security deposits, when required, are held by the platform and returned after the item
              is inspected and confirmed undamaged.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.terms.section6")}</h2>
            <p className="mt-2">
              If a dispute arises between a renter and owner, both parties should first attempt to
              resolve it directly. If resolution is not reached, either party may file a dispute
              through the Platform. GharBatai will review disputes and may mediate, but final
              decisions are at our discretion. Refunds are issued based on our cancellation and
              dispute resolution policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.terms.section7")}</h2>
            <p className="mt-2">
              Owners may be required to provide proof of insurance for certain listing categories.
              GharBatai is not liable for damage, loss, or injury arising from the use of rented
              items. Users are encouraged to carry appropriate insurance coverage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.terms.section8")}</h2>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>Listing prohibited, illegal, or stolen items</li>
              <li>Providing false or misleading information</li>
              <li>Circumventing the Platform to avoid fees</li>
              <li>Harassing, threatening, or discriminating against other users</li>
              <li>Attempting to gain unauthorized access to accounts or systems</li>
              <li>Using the Platform for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.terms.section9")}</h2>
            <p className="mt-2">
              We reserve the right to suspend or terminate any account that violates these terms,
              engages in fraudulent activity, or poses a risk to the community. Users may also
              delete their accounts at any time through account settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.terms.section10")}</h2>
            <p className="mt-2">
              GharBatai provides the Platform "as is" without warranties of any kind. To the maximum
              extent permitted by law, GharBatai shall not be liable for any indirect, incidental,
              special, or consequential damages arising from use of the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.terms.section11")}</h2>
            <p className="mt-2">
              These Terms are governed by the laws of the jurisdiction in which GharBatai operates.
              Any disputes arising under these terms shall be resolved through binding arbitration.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">{t("pages.terms.section12")}</h2>
            <p className="mt-2">
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:legal@gharbatai.com" className="text-primary hover:underline">
                legal@gharbatai.com
              </a>{" "}
              or visit our <Link to="/contact" className="text-primary hover:underline">Contact page</Link>.
            </p>
          </section>
        </div>

        <div className="mt-12 flex gap-4 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-primary">{t("pages.terms.privacyPolicy")}</Link>
          <span>·</span>
          <Link to="/cookies" className="hover:text-primary">{t("pages.terms.cookiePolicy")}</Link>
          <span>·</span>
          <Link to="/" className="hover:text-primary">{t("common.backToHome")}</Link>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };
