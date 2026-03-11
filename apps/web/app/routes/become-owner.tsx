import type { MetaFunction } from "react-router";
import { Link, Form, useActionData, useNavigation, redirect, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import {
  Banknote,
  TrendingUp,
  Users,
  Shield,
  CheckCircle,
  Star,
  Package,
  Calendar,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "~/lib/store/auth";
import { usersApi } from "~/lib/api/users";
import { RouteErrorBoundary } from "~/components/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui";
import { UnifiedButton } from "~/components/ui";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/lib/utils";
import { getUser } from "~/utils/auth";

export const meta: MetaFunction = () => {
  return [
    { title: "Become an Owner | GharBatai Rentals" },
    { name: "description", content: "Start earning by renting out your items" },
  ];
};

export async function clientAction({ request }: { request: Request }) {
  const currentUser = await getUser(request);
  if (!currentUser) {
    return redirect("/auth/login");
  }
  if (currentUser.role === "owner" || currentUser.role === "admin") {
    return { success: true, message: "You already have owner access." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  if (intent !== "upgrade-owner") {
    return { success: false, message: "Invalid request." };
  }
  const agreementValue = String(formData.get("agreement") || "").toLowerCase();
  const agreement = agreementValue === "true" || agreementValue === "on";

  if (!agreement) {
    return { success: false, message: "Please accept the terms and conditions" };
  }

  try {
    // Upgrade user to owner role
    const updated = await usersApi.upgradeToOwner();
    useAuthStore.getState().updateUser(updated);
    return { success: true, message: "Congratulations! You are now an owner." };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to become an owner",
    };
  }
}

const benefits = [
  {
    icon: Banknote,
    titleKey: "pages.becomeOwner.benefitEarnTitle",
    descKey: "pages.becomeOwner.benefitEarnDesc",
    descParams: { amount: formatCurrency(50000) },
  },
  {
    icon: Shield,
    titleKey: "pages.becomeOwner.benefitProtectedTitle",
    descKey: "pages.becomeOwner.benefitProtectedDesc",
  },
  {
    icon: Users,
    titleKey: "pages.becomeOwner.benefitCommunityTitle",
    descKey: "pages.becomeOwner.benefitCommunityDesc",
  },
  {
    icon: Calendar,
    titleKey: "pages.becomeOwner.benefitFlexibleTitle",
    descKey: "pages.becomeOwner.benefitFlexibleDesc",
  },
];

const steps = [
  {
    number: 1,
    titleKey: "pages.becomeOwner.step1Title",
    descKey: "pages.becomeOwner.step1Desc",
  },
  {
    number: 2,
    titleKey: "pages.becomeOwner.step2Title",
    descKey: "pages.becomeOwner.step2Desc",
  },
  {
    number: 3,
    titleKey: "pages.becomeOwner.step3Title",
    descKey: "pages.becomeOwner.step3Desc",
  },
  {
    number: 4,
    titleKey: "pages.becomeOwner.step4Title",
    descKey: "pages.becomeOwner.step4Desc",
  },
];

const testimonials = [
  {
    name: "Sarah M.",
    avatar: null,
    rating: 5,
    quote: `I've earned over ${formatCurrency(300000)} renting out my photography equipment. The platform makes it so easy!`,
    earnings: formatCurrency(320000),
    items: "Camera gear",
  },
  {
    name: "Mike T.",
    avatar: null,
    rating: 5,
    quote: "Great way to make my tools pay for themselves. The insurance gives me peace of mind.",
    earnings: formatCurrency(180000),
    items: "Power tools",
  },
  {
    name: "Emily R.",
    avatar: null,
    rating: 5,
    quote: "Started with one item, now I have 12 listings. This has become a real side business!",
    earnings: formatCurrency(550000),
    items: "Party supplies",
  },
];

export default function BecomeOwnerPage() {
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auto-redirect to owner dashboard after successful upgrade
  useEffect(() => {
    if (actionData?.success) {
      const timer = setTimeout(() => {
        navigate("/dashboard/owner");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [actionData?.success, navigate]);
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  // If user is already an owner, show different content
  if (user?.role === "owner" || user?.role === "admin") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">{t("pages.becomeOwner.alreadyOwnerTitle")}</h1>
              <p className="text-muted-foreground mb-6">
                {t("pages.becomeOwner.alreadyOwnerDesc")}
              </p>
              <div className="flex gap-4 justify-center">
                <Link to="/listings/new">
                  <UnifiedButton>
                    <Package className="w-4 h-4 mr-2" />
                    {t("pages.becomeOwner.createListing")}
                  </UnifiedButton>
                </Link>
                <Link to="/dashboard/owner">
                  <UnifiedButton variant="outline">{t("pages.becomeOwner.goToDashboard")}</UnifiedButton>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/10 to-background py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            {t("pages.becomeOwner.heroTitle")}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t("pages.becomeOwner.heroSubtitle")}
          </p>
          <div className="flex items-center justify-center gap-8 text-sm">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{formatCurrency(50000)}+</p>
              <p className="text-muted-foreground">{t("pages.becomeOwner.avgMonthlyEarnings")}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">10,000+</p>
              <p className="text-muted-foreground">{t("pages.becomeOwner.activeOwners")}</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">98%</p>
              <p className="text-muted-foreground">{t("pages.becomeOwner.ownerSatisfaction")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            {t("pages.becomeOwner.whyBecomeOwner")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit) => (
              <Card key={benefit.titleKey}>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{t(benefit.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground">{t(benefit.descKey, benefit.descParams)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            {t("pages.becomeOwner.howItWorks")}
          </h2>
          <div className="space-y-8">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-start gap-6">
                <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  {step.number}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-lg">{t(step.titleKey)}</h3>
                  <p className="text-muted-foreground">{t(step.descKey)}</p>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-muted-foreground mt-2 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            {t("pages.becomeOwner.whatOwnersSay")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.name}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-0.5 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          "w-4 h-4",
                          star <= testimonial.rating ? "text-yellow-500 fill-current" : "text-gray-300"
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-foreground mb-4">"{testimonial.quote}"</p>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.items}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-success">{testimonial.earnings}</p>
                      <p className="text-xs text-muted-foreground">{t("pages.becomeOwner.earned")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary/5">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{t("pages.becomeOwner.readyToStart")}</CardTitle>
              <CardDescription>
                {t("pages.becomeOwner.readyToStartDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionData?.success ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-foreground mb-2">{t("pages.becomeOwner.welcomeOwner")}</h3>
                  <p className="text-muted-foreground mb-6">{actionData.message}</p>
                  <Link to="/listings/new">
                    <UnifiedButton size="lg">
                      <Package className="w-5 h-5 mr-2" />
                      {t("pages.becomeOwner.createFirstListing")}
                    </UnifiedButton>
                  </Link>
                </div>
              ) : (
                <Form method="post">
                  <input type="hidden" name="intent" value="upgrade-owner" />
                  {actionData?.success === false && (
                    <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                      {actionData.message}
                    </div>
                  )}

                  {!user && (
                    <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg">
                      <p className="text-sm text-warning">
                        <Trans
                          i18nKey="pages.becomeOwner.loginRequired"
                          components={{
                            loginLink: <Link to="/auth/login" className="font-medium underline" />,
                            signupLink: <Link to="/auth/signup" className="font-medium underline" />,
                          }}
                        />
                      </p>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-semibold text-foreground mb-2">{t("pages.becomeOwner.ownerAgreement")}</h4>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        <li>• {t("pages.becomeOwner.agreementItem1")}</li>
                        <li>• {t("pages.becomeOwner.agreementItem2")}</li>
                        <li>• {t("pages.becomeOwner.agreementItem3")}</li>
                        <li>• {t("pages.becomeOwner.agreementItem4")}</li>
                        <li>• {t("pages.becomeOwner.agreementItem5")}</li>
                      </ul>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="agreement"
                        value="true"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-1"
                        disabled={!user}
                      />
                      <span className="text-sm text-foreground">
                        {t("pages.becomeOwner.agreementConsent")}
                      </span>
                    </label>

                    <UnifiedButton
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={!agreed || !user || isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          {t("pages.becomeOwner.processing")}
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-5 h-5 mr-2" />
                          {t("pages.becomeOwner.becomeOwnerBtn")}
                        </>
                      )}
                    </UnifiedButton>
                  </div>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            {t("pages.becomeOwner.faqTitle")}
          </h2>
          <div className="space-y-4">
            {[
              {
                q: t("pages.becomeOwner.faq1Q"),
                a: t("pages.becomeOwner.faq1A"),
              },
              {
                q: t("pages.becomeOwner.faq2Q"),
                a: t("pages.becomeOwner.faq2A"),
              },
              {
                q: t("pages.becomeOwner.faq3Q"),
                a: t("pages.becomeOwner.faq3A"),
              },
              {
                q: t("pages.becomeOwner.faq4Q"),
                a: t("pages.becomeOwner.faq4A"),
              },
            ].map((faq, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-foreground mb-2">{faq.q}</h3>
                  <p className="text-muted-foreground">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };