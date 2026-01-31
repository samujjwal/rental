import { useEffect, useRef } from "react";
import { useAuthStore } from "~/lib/store/auth";

/**
 * Hook to initialize and restore user session on app startup
 * Should be called once in the root component or main layout
 */
export function useAuthInit() {
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only run once, on mount
    if (!hasInitialized.current && !isInitialized) {
      hasInitialized.current = true;
      useAuthStore.getState().restoreSession();
    }
  }, []); // Empty dependency array - only run on mount

  return { isInitialized };
}
