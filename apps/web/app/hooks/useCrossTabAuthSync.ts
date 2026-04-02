import { useEffect, useCallback } from "react";
import { useAuthStore } from "~/lib/store/auth";

const AUTH_SYNC_EVENT = "app:auth-sync";
const AUTH_SYNC_KEY = "auth-sync-storage";

interface AuthSyncEvent {
  type: "login" | "logout" | "token-refresh" | "user-update";
  timestamp: number;
  data?: {
    user?: unknown;
    accessToken?: string;
  };
}

/**
 * Cross-tab authentication synchronization hook
 * Ensures auth state stays synchronized across multiple browser tabs/windows
 */
export function useCrossTabAuthSync() {
  const { user, accessToken, setAuth, clearAuth, setAccessToken } =
    useAuthStore();

  /**
   * Broadcast auth change to other tabs
   */
  const broadcastAuthChange = useCallback((event: AuthSyncEvent) => {
    if (typeof window === "undefined") return;

    // Use BroadcastChannel if available (more modern)
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(AUTH_SYNC_EVENT);
      channel.postMessage(event);
      channel.close();
    }

    // Fallback to localStorage for broader browser support
    try {
      localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify(event));
      // Immediately remove to not leave traces
      setTimeout(() => {
        localStorage.removeItem(AUTH_SYNC_KEY);
      }, 100);
    } catch {
      // localStorage might be disabled or full
    }
  }, []);

  /**
   * Handle incoming auth sync events
   */
  const handleAuthSync = useCallback(
    (event: AuthSyncEvent) => {
      // Prevent handling events from the current tab
      if (event.timestamp === Date.now()) return;

      switch (event.type) {
        case "login":
          if (event.data?.user && event.data?.accessToken) {
            setAuth(
              event.data.user as Parameters<typeof setAuth>[0],
              event.data.accessToken
            );
          }
          break;

        case "logout":
          clearAuth();
          break;

        case "token-refresh":
          if (event.data?.accessToken) {
            setAccessToken(event.data.accessToken);
          }
          break;

        case "user-update":
          if (event.data?.user) {
            // Use updateUser action if available, otherwise refresh
            const store = useAuthStore.getState();
            if ("updateUser" in store) {
              (store as { updateUser: (user: unknown) => void }).updateUser(
                event.data.user
              );
            }
          }
          break;
      }
    },
    [setAuth, clearAuth, setAccessToken]
  );

  /**
   * Sync current auth state to other tabs
   */
  const syncCurrentState = useCallback(() => {
    if (user && accessToken) {
      broadcastAuthChange({
        type: "login",
        timestamp: Date.now(),
        data: { user, accessToken },
      });
    }
  }, [user, accessToken, broadcastAuthChange]);

  // Set up listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    // BroadcastChannel listener (preferred)
    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel(AUTH_SYNC_EVENT);
      bc.onmessage = (event) => {
        handleAuthSync(event.data as AuthSyncEvent);
      };
    }

    // localStorage fallback
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_SYNC_KEY && e.newValue) {
        try {
          const event = JSON.parse(e.newValue) as AuthSyncEvent;
          handleAuthSync(event);
        } catch {
          // Invalid JSON
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (bc) {
        bc.close();
      }
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [handleAuthSync]);

  return {
    broadcastAuthChange,
    syncCurrentState,
    isSyncSupported:
      typeof window !== "undefined" &&
      ("BroadcastChannel" in window || "localStorage" in window),
  };
}

/**
 * Wraps auth store actions to broadcast changes
 * Use this to wrap the auth store for automatic sync
 */
export function createSyncedAuthActions(
  broadcast: (event: AuthSyncEvent) => void
) {
  return {
    setAuth: (user: unknown, accessToken: string) => {
      broadcast({
        type: "login",
        timestamp: Date.now(),
        data: { user, accessToken },
      });
    },

    clearAuth: () => {
      broadcast({
        type: "logout",
        timestamp: Date.now(),
      });
    },

    setAccessToken: (token: string) => {
      broadcast({
        type: "token-refresh",
        timestamp: Date.now(),
        data: { accessToken: token },
      });
    },

    updateUser: (user: unknown) => {
      broadcast({
        type: "user-update",
        timestamp: Date.now(),
        data: { user },
      });
    },
  };
}

export default useCrossTabAuthSync;
