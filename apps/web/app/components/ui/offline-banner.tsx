/* eslint-disable react-refresh/only-export-components */

import React, { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

interface OfflineBannerProps {
  className?: string;
}

/**
 * Hook to detect online/offline status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Show "back online" message briefly
        setTimeout(() => setWasOffline(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}

/**
 * Offline banner component
 * Based on wireframe section 9.4
 */
export function OfflineBanner({ className }: OfflineBannerProps) {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setVisible(true);
    } else if (wasOffline) {
      // Keep visible briefly to show "back online" message
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!visible && isOnline) return null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-0 z-50 px-4 py-2 text-center text-sm font-medium transition-all duration-300",
        isOnline
          ? "bg-green-500 text-white"
          : "bg-yellow-500 text-yellow-900",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {isOnline ? (
        <span className="flex items-center justify-center gap-2">
          ✅ You're back online!
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          ⚠️ You're offline. Some features may not work.
        </span>
      )}
    </div>
  );
}

/**
 * Slow connection banner
 */
export function SlowConnectionBanner({
  visible,
  className,
}: {
  visible: boolean;
  className?: string;
}) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-0 z-50 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-800 transition-all duration-300",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <span className="flex items-center justify-center gap-2">
        ⏳ Slow connection detected. Please wait...
      </span>
    </div>
  );
}

/**
 * Connection status indicator (small dot)
 */
export function ConnectionIndicator({
  className,
}: {
  className?: string;
}) {
  const { isOnline } = useOnlineStatus();

  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        isOnline ? "bg-green-500" : "bg-red-500",
        className
      )}
      title={isOnline ? "Online" : "Offline"}
      aria-label={isOnline ? "Online" : "Offline"}
    />
  );
}
