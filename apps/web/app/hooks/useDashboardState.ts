import { useMemo } from "react";
import type { Booking } from "~/types/booking";

export type UserActivityLevel = "new" | "returning" | "active" | "experienced";

interface PersonalizedRecommendation {
  title: string;
  description: string;
  actionText: string;
  actionUrl: string;
}

interface DashboardState {
  userActivityLevel: UserActivityLevel;
  showFirstTimeHelp: boolean;
  personalizedRecommendations: PersonalizedRecommendation;
}

const safeStatusKey = (value: unknown, fallback = "PENDING"): string => {
  const status = typeof value === "string" ? value.trim() : "";
  return (status || fallback).toUpperCase();
};

/**
 * Consolidated dashboard state management hook
 * Fixes P0.1: State synchronization issues by computing all derived state in a single useMemo
 * This prevents race conditions and stale closures from dependent useMemo chains
 */
export function useDashboardState(recentBookings: Booking[]): DashboardState {
  return useMemo(() => {
    // Calculate user activity metrics
    const totalBookings = recentBookings.length;
    const completedBookings = recentBookings.filter((b) => {
      const status = safeStatusKey(b.status);
      return status === "COMPLETED" || status === "SETTLED";
    }).length;

    // Determine user activity level
    let userActivityLevel: UserActivityLevel;
    if (totalBookings === 0) {
      userActivityLevel = "new";
    } else if (completedBookings >= 5) {
      userActivityLevel = "experienced";
    } else if (completedBookings >= 2) {
      userActivityLevel = "active";
    } else {
      userActivityLevel = "returning";
    }

    // Determine if first-time help should be shown
    const showFirstTimeHelp = userActivityLevel === "new" && totalBookings === 0;

    // Generate personalized recommendations based on activity level
    let personalizedRecommendations: PersonalizedRecommendation;
    if (userActivityLevel === "new") {
      personalizedRecommendations = {
        title: "Getting Started",
        description: "Discover popular items in your area",
        actionText: "Browse Popular",
        actionUrl: "/search?sort=popular",
      };
    } else if (userActivityLevel === "experienced") {
      personalizedRecommendations = {
        title: "Expand Your Horizons",
        description: "Try new categories and experiences",
        actionText: "Explore Categories",
        actionUrl: "/search",
      };
    } else {
      personalizedRecommendations = {
        title: "Continue Your Journey",
        description: "Find items similar to your bookings",
        actionText: "Find Similar",
        actionUrl: "/search",
      };
    }

    // Return all derived state in a single computation
    return {
      userActivityLevel,
      showFirstTimeHelp,
      personalizedRecommendations,
    };
  }, [recentBookings]); // Single dependency array prevents stale closures
}
