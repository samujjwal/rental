import React from "react";
import { Link } from "react-router";
import { 
  Search, 
  Plus, 
  Calendar, 
  Heart, 
  MessageSquare, 
  Star, 
  Package, 
  TrendingUp,
  Compass,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { cn } from "~/lib/utils";
import { UnifiedButton } from "~/components/ui";
import { useAuthStore } from "~/lib/store/auth";

interface PersonalizedEmptyStateProps {
  type: "bookings" | "listings" | "favorites" | "messages" | "reviews" | "search";
  context?: "renter" | "owner" | "new-user";
  className?: string;
}

const getPersonalizedContent = (
  type: PersonalizedEmptyStateProps["type"],
  userRole?: string,
  isNewUser?: boolean
) => {
  const isOwner = userRole === "owner";
  const isRenter = userRole === "renter" || !isOwner;

  switch (type) {
    case "bookings":
      if (isOwner) {
        return {
          icon: Calendar,
          title: "No bookings yet",
          description: "Your listings are ready! Once renters make requests, they'll appear here.",
          primaryAction: {
            label: "View Your Listings",
            href: "/listings",
            icon: Package,
          },
          secondaryAction: {
            label: "Create New Listing",
            href: "/listings/new",
            icon: Plus,
          },
          tips: [
            "Add more photos to attract renters",
            "Set competitive pricing based on market",
            "Enable instant booking for faster conversions",
          ],
        };
      }
      return {
        icon: Compass,
        title: "Start your rental journey",
        description: isNewUser 
          ? "Welcome! Discover thousands of items available for rent in your area."
          : "Find the perfect item for your next project, trip, or event.",
        primaryAction: {
          label: "Browse Rentals",
          href: "/search",
          icon: Search,
        },
        secondaryAction: {
          label: "View Categories",
          href: "/search",
          icon: TrendingUp,
        },
        tips: [
          "Use filters to narrow down by location and price",
          "Save favorites to compare later",
          "Read reviews from other renters",
        ],
      };

    case "listings":
      if (isOwner) {
        return {
          icon: Package,
          title: "No listings yet",
          description: "Turn your idle items into income! List your first item in under 5 minutes.",
          primaryAction: {
            label: "Create Your First Listing",
            href: "/listings/new",
            icon: Plus,
          },
          secondaryAction: {
            label: "Learn How It Works",
            href: "/owner-guide",
            icon: Sparkles,
          },
          tips: [
            "Take clear, well-lit photos from multiple angles",
            "Write detailed descriptions including condition",
            "Set competitive prices based on similar listings",
          ],
        };
      }
      return {
        icon: TrendingUp,
        title: "Become an owner",
        description: "Have items others might need? Start earning by listing them for rent.",
        primaryAction: {
          label: "List Your First Item",
          href: "/become-owner",
          icon: Plus,
        },
        secondaryAction: {
          label: "Owner Benefits",
          href: "/owner-guide",
          icon: Sparkles,
        },
        tips: [
          "Popular items: cameras, tools, vehicles, electronics",
          "Insurance protection included for peace of mind",
          "Average owner earns $500/month",
        ],
      };

    case "favorites":
      return {
        icon: Heart,
        title: "No favorites yet",
        description: "See something you like? Save it here to find it quickly later.",
        primaryAction: {
          label: "Discover Items",
          href: "/search",
          icon: Search,
        },
        secondaryAction: null,
        tips: [
          "Click the heart icon on any listing to save it",
          "Compare saved items side by side",
          "Get notified when favorited items have special offers",
        ],
      };

    case "messages":
      return {
        icon: MessageSquare,
        title: "No messages yet",
        description: "Communication with owners and renters happens here.",
        primaryAction: {
          label: "Start Browsing",
          href: "/search",
          icon: Search,
        },
        secondaryAction: null,
        tips: [
          "Message owners before booking to ask questions",
          "Coordinate pickup details through messages",
          "Respond quickly for better rental experiences",
        ],
      };

    case "reviews":
      return {
        icon: Star,
        title: "No reviews yet",
        description: "Reviews appear here after completed rentals. Build trust by completing bookings!",
        primaryAction: {
          label: isRenter ? "Find Items to Rent" : "Manage Your Listings",
          href: isRenter ? "/search" : "/listings",
          icon: isRenter ? Search : Package,
        },
        secondaryAction: null,
        tips: [
          "Complete rentals to receive reviews",
          "Leave honest reviews to help the community",
          "Good reviews increase booking success",
        ],
      };

    case "search":
      return {
        icon: Search,
        title: "No results found",
        description: "Try adjusting your search terms or filters to find what you're looking for.",
        primaryAction: {
          label: "Clear All Filters",
          href: "/search",
          icon: ArrowRight,
        },
        secondaryAction: {
          label: "Browse All Categories",
          href: "/search",
          icon: TrendingUp,
        },
        tips: [
          "Try broader search terms",
          "Expand your location radius",
          "Check different date ranges",
        ],
      };

    default:
      return {
        icon: Package,
        title: "Nothing here yet",
        description: "This section will fill up as you use the platform.",
        primaryAction: {
          label: "Get Started",
          href: "/",
          icon: ArrowRight,
        },
        secondaryAction: null,
        tips: [],
      };
  }
};

export function PersonalizedEmptyState({
  type,
  context,
  className,
}: PersonalizedEmptyStateProps) {
  const { user } = useAuthStore();
  const userRole = context || (user?.role as "renter" | "owner") || "renter";
  const isNewUser = user?.createdAt 
    ? Date.now() - new Date(user.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000 
    : true;

  const content = getPersonalizedContent(type, userRole, isNewUser);
  const Icon = content.icon;

  return (
    <div className={cn("text-center py-12 px-4", className)}>
      {/* Icon */}
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="w-10 h-10 text-primary" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-foreground mb-2">
        {content.title}
      </h3>

      {/* Description */}
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        {content.description}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
        <Link to={content.primaryAction.href}>
          <UnifiedButton size="lg" leftIcon={<content.primaryAction.icon className="w-5 h-5" />}>
            {content.primaryAction.label}
          </UnifiedButton>
        </Link>
        {content.secondaryAction && (
          <Link to={content.secondaryAction.href}>
            <UnifiedButton variant="outline" size="lg" leftIcon={<content.secondaryAction.icon className="w-5 h-5" />}>
              {content.secondaryAction.label}
            </UnifiedButton>
          </Link>
        )}
      </div>

      {/* Tips */}
      {content.tips.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-sm font-medium text-foreground mb-2">
            💡 Pro Tips
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {content.tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Enhanced presets that replace the basic empty states
export const EnhancedEmptyStatePresets = {
  NoBookings: (props: { context?: "renter" | "owner" }) => (
    <PersonalizedEmptyState type="bookings" context={props.context} />
  ),
  NoListings: (props: { context?: "renter" | "owner" }) => (
    <PersonalizedEmptyState type="listings" context={props.context} />
  ),
  NoFavorites: () => <PersonalizedEmptyState type="favorites" />,
  NoMessages: () => <PersonalizedEmptyState type="messages" />,
  NoReviews: (props: { context?: "renter" | "owner" }) => (
    <PersonalizedEmptyState type="reviews" context={props.context} />
  ),
  NoSearchResults: () => <PersonalizedEmptyState type="search" />,
};

export default PersonalizedEmptyState;
