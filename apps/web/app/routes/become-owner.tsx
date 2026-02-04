import type { MetaFunction } from "react-router";
import { Link, Form, useActionData, useNavigation } from "react-router";
import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  Users,
  Shield,
  CheckCircle,
  Star,
  Package,
  Calendar,
  MessageCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "~/lib/store/auth";
import { usersApi } from "~/lib/api/users";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui";
import { UnifiedButton } from "~/components/ui";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => {
  return [
    { title: "Become an Owner | GharBatai Rentals" },
    { name: "description", content: "Start earning by renting out your items" },
  ];
};

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData();
  const agreement = formData.get("agreement") === "true";

  if (!agreement) {
    return { success: false, message: "Please accept the terms and conditions" };
  }

  try {
    // Upgrade user to owner role
    await usersApi.upgradeToOwner();
    return { success: true, message: "Congratulations! You are now an owner." };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to become an owner" };
  }
}

const benefits = [
  {
    icon: DollarSign,
    title: "Earn Extra Income",
    description: "Turn your idle items into a source of income. The average owner earns $500/month.",
  },
  {
    icon: Shield,
    title: "Protected Rentals",
    description: "Our insurance coverage protects your items against damage during rentals.",
  },
  {
    icon: Users,
    title: "Trusted Community",
    description: "All renters are verified with ID checks and reviews from previous owners.",
  },
  {
    icon: Calendar,
    title: "Flexible Schedule",
    description: "You control when your items are available. Block dates anytime.",
  },
];

const steps = [
  {
    number: 1,
    title: "Create Your Listing",
    description: "Add photos, description, and set your price for each item.",
  },
  {
    number: 2,
    title: "Set Availability",
    description: "Choose when your items can be rented and set booking preferences.",
  },
  {
    number: 3,
    title: "Accept Bookings",
    description: "Review requests and accept bookings that work for you.",
  },
  {
    number: 4,
    title: "Get Paid",
    description: "Receive payments directly to your bank account after each rental.",
  },
];

const testimonials = [
  {
    name: "Sarah M.",
    avatar: null,
    rating: 5,
    quote: "I've earned over $3,000 renting out my photography equipment. The platform makes it so easy!",
    earnings: "$3,200",
    items: "Camera gear",
  },
  {
    name: "Mike T.",
    avatar: null,
    rating: 5,
    quote: "Great way to make my tools pay for themselves. The insurance gives me peace of mind.",
    earnings: "$1,800",
    items: "Power tools",
  },
  {
    name: "Emily R.",
    avatar: null,
    rating: 5,
    quote: "Started with one item, now I have 12 listings. This has become a real side business!",
    earnings: "$5,500",
    items: "Party supplies",
  },
];

export default function BecomeOwnerPage() {
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [agreed, setAgreed] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  // If user is already an owner, show different content
  if (user?.role === "owner" || user?.role === "admin") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">You're Already an Owner!</h1>
              <p className="text-muted-foreground mb-6">
                You can start listing your items right away.
              </p>
              <div className="flex gap-4 justify-center">
                <Link to="/listings/new">
                  <UnifiedButton>
                    <Package className="w-4 h-4 mr-2" />
                    Create Listing
                  </UnifiedButton>
                </Link>
                <Link to="/dashboard/owner">
                  <UnifiedButton variant="outline">Go to Dashboard</UnifiedButton>
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
            Turn Your Items Into Income
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of owners earning money by renting out items they already own.
            It's easy, safe, and profitable.
          </p>
          <div className="flex items-center justify-center gap-8 text-sm">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">$500+</p>
              <p className="text-muted-foreground">Avg. monthly earnings</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">10,000+</p>
              <p className="text-muted-foreground">Active owners</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">98%</p>
              <p className="text-muted-foreground">Owner satisfaction</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">
            Why Become an Owner?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit) => (
              <Card key={benefit.title}>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
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
            How It Works
          </h2>
          <div className="space-y-8">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-start gap-6">
                <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  {step.number}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-lg">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
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
            What Our Owners Say
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
                      <p className="font-bold text-green-600">{testimonial.earnings}</p>
                      <p className="text-xs text-muted-foreground">earned</p>
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
              <CardTitle className="text-2xl">Ready to Start Earning?</CardTitle>
              <CardDescription>
                Become an owner today and start listing your items
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionData?.success ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-foreground mb-2">Welcome, Owner!</h3>
                  <p className="text-muted-foreground mb-6">{actionData.message}</p>
                  <Link to="/listings/new">
                    <UnifiedButton size="large">
                      <Package className="w-5 h-5 mr-2" />
                      Create Your First Listing
                    </UnifiedButton>
                  </Link>
                </div>
              ) : (
                <Form method="post">
                  {actionData?.success === false && (
                    <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                      {actionData.message}
                    </div>
                  )}

                  {!user && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        Please <Link to="/auth/login" className="font-medium underline">log in</Link> or{" "}
                        <Link to="/auth/signup" className="font-medium underline">create an account</Link>{" "}
                        first to become an owner.
                      </p>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-semibold text-foreground mb-2">Owner Agreement</h4>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        <li>• I will accurately describe my items and their condition</li>
                        <li>• I will respond to booking requests within 24 hours</li>
                        <li>• I will maintain my items in good working condition</li>
                        <li>• I understand the platform fee of 10% on successful rentals</li>
                        <li>• I agree to the Terms of Service and Owner Guidelines</li>
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
                        I have read and agree to the Owner Agreement, Terms of Service, and Privacy Policy.
                      </span>
                    </label>

                    <Button
                      type="submit"
                      className="w-full"
                      size="large"
                      disabled={!agreed || !user || isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-5 h-5 mr-2" />
                          Become an Owner
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
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "How much does it cost to become an owner?",
                a: "It's completely free to become an owner and list your items. We only charge a 10% service fee when you make a successful rental.",
              },
              {
                q: "What if my item gets damaged?",
                a: "All rentals are covered by our comprehensive insurance policy. If an item is damaged, you can file a claim and we'll help resolve the issue.",
              },
              {
                q: "How do I receive payments?",
                a: "Payments are automatically deposited to your connected bank account within 3-5 business days after each rental is completed.",
              },
              {
                q: "Can I choose who rents my items?",
                a: "Yes! You can review renter profiles, ratings, and previous reviews before accepting or declining any booking request.",
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
