import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { RouteErrorBoundary } from "~/components/ui";
import { Search, MessageCircle, Shield, CreditCard, Package, AlertTriangle } from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "Help Center | GharBatai Rentals" },
    { name: "description", content: "Find answers, guides, and troubleshooting resources." },
  ];
};

const faqs = [
  {
    question: "How do I create a listing?",
    answer:
      'Navigate to your Dashboard and click "Create Listing". Fill in the title, description, pricing, photos, and availability. Your listing will be reviewed before going live.',
  },
  {
    question: "How does payment work?",
    answer:
      "Payments are processed securely through Stripe. Renters pay at the time of booking. Owners receive payouts after the rental is completed and any dispute window has closed. A 15% platform fee is deducted from owner earnings, and a 5% service fee is added for renters.",
  },
  {
    question: "What if an item is damaged during rental?",
    answer:
      "If an item is returned damaged, the owner can file a dispute within the platform. If a security deposit was collected, it may be used to cover repair costs. Both parties can submit evidence, and our team will mediate if needed.",
  },
  {
    question: "How do I cancel a booking?",
    answer:
      "Go to your Bookings page, select the booking, and click Cancel. Refund amounts depend on the cancellation policy set by the owner. Cancellations made more than 48 hours before the start date typically receive a full refund.",
  },
  {
    question: "Is my personal information safe?",
    answer:
      "Yes. We use industry-standard encryption, secure payment processing through Stripe, and never store payment card details on our servers. See our Privacy Policy for details.",
  },
  {
    question: "How do I verify my identity?",
    answer:
      "Go to Settings > Profile and complete the verification steps. You may be asked to provide a government-issued ID and confirm your email and phone number. Verified accounts build more trust with other users.",
  },
];

const categories = [
  { icon: Package, title: "Listings & Rentals", description: "Creating, editing, and managing your listings", link: "/owner-guide" },
  { icon: CreditCard, title: "Payments & Billing", description: "Payment methods, payouts, fees, and invoices", link: "/payments" },
  { icon: Shield, title: "Safety & Trust", description: "Verification, insurance, and account security", link: "/safety" },
  { icon: AlertTriangle, title: "Disputes & Refunds", description: "Filing disputes, cancellations, and refund policies", link: "/disputes" },
  { icon: MessageCircle, title: "Messaging", description: "Communicating with renters and owners", link: "/messages" },
  { icon: Search, title: "Search & Discovery", description: "Finding the right items and filtering results", link: "/search" },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Help Center</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Find answers to common questions and learn how to get the most out of GharBatai.
          </p>
        </div>

        {/* Topic categories */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Link
              key={cat.title}
              to={cat.link}
              className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <cat.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold group-hover:text-primary">{cat.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* FAQs */}
        <div className="mt-16">
          <h2 className="text-2xl font-semibold">Frequently Asked Questions</h2>
          <div className="mt-6 divide-y rounded-xl border bg-card">
            {faqs.map((faq) => (
              <details key={faq.question} className="group px-6 py-4">
                <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                  {faq.question}
                  <span className="ml-2 text-muted-foreground transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div className="mt-12 rounded-xl border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">Still Need Help?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Our support team is here to assist you.
          </p>
          <div className="mt-4">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Contact Support
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
