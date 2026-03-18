import { useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAuthStore } from "~/lib/store/auth";

type KeyboardShortcut = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  preventDefault?: boolean;
  // Condition to check if shortcut should be active
  when?: () => boolean;
};

// Global shortcut registry
const shortcuts: Map<string, KeyboardShortcut> = new Map();

function getShortcutId(shortcut: Omit<KeyboardShortcut, "action" | "description">): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push("ctrl");
  if (shortcut.alt) parts.push("alt");
  if (shortcut.shift) parts.push("shift");
  if (shortcut.meta) parts.push("meta");
  
  // Guard against undefined key
  const key = shortcut.key;
  if (key && typeof key === 'string') {
    parts.push(key.toLowerCase());
  } else {
    parts.push('unknown');
  }
  
  return parts.join("+");
}

export function registerShortcut(shortcut: KeyboardShortcut): () => void {
  const id = getShortcutId(shortcut);
  shortcuts.set(id, shortcut);
  
  // Return unregister function
  return () => {
    shortcuts.delete(id);
  };
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const isInputFocused = useRef(false);

  // Track if user is typing in an input/textarea
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      isInputFocused.current = 
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true";
    };

    const handleBlur = () => {
      isInputFocused.current = false;
    };

    document.addEventListener("focusin", handleFocus, true);
    document.addEventListener("focusout", handleBlur, true);

    return () => {
      document.removeEventListener("focusin", handleFocus, true);
      document.removeEventListener("focusout", handleBlur, true);
    };
  }, []);

  // Register app-wide shortcuts
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modKey = isMac ? "meta" : "ctrl";

    // Navigation shortcuts
    const unregisterNavShortcuts = [
      registerShortcut({
        key: "k",
        [modKey]: true,
        description: "Open search / command palette",
        action: () => {
          window.dispatchEvent(new CustomEvent("app:open-command-palette"));
        },
      }),

      // Dashboard navigation
      ...(user ? [
        registerShortcut({
          key: "d",
          [modKey]: true,
          description: "Go to dashboard",
          action: () => {
            navigate(user.role === "owner" ? "/dashboard/owner" : "/dashboard/renter");
          },
        }),

        registerShortcut({
          key: "b",
          [modKey]: true,
          description: "Go to bookings",
          action: () => {
            navigate("/bookings");
          },
        }),

        registerShortcut({
          key: "l",
          [modKey]: true,
          description: "Go to listings",
          action: () => {
            navigate("/listings");
          },
        }),

        registerShortcut({
          key: "m",
          [modKey]: true,
          description: "Go to messages",
          action: () => {
            navigate("/messages");
          },
        }),

        registerShortcut({
          key: "n",
          [modKey]: true,
          description: "Create new listing",
          action: () => {
            navigate("/listings/new");
          },
        }),

        registerShortcut({
          key: "f",
          [modKey]: true,
          description: "Go to favorites",
          action: () => {
            navigate("/favorites");
          },
        }),

        registerShortcut({
          key: "s",
          [modKey]: true,
          description: "Go to settings",
          action: () => {
            navigate("/settings");
          },
        }),

        registerShortcut({
          key: "h",
          [modKey]: true,
          description: "Go to home",
          action: () => {
            navigate("/");
          },
        }),
      ] : []),

      // Escape key actions
      registerShortcut({
        key: "escape",
        description: "Close modals / go back",
        action: () => {
          // Check if there's a modal open
          const openModal = document.querySelector('[role="dialog"]');
          if (openModal) {
            const closeButton = openModal.querySelector('[aria-label*="Close"], [data-close]');
            if (closeButton instanceof HTMLElement) {
              closeButton.click();
            }
          }
        },
        preventDefault: false,
      }),

      // Help shortcut
      registerShortcut({
        key: "?",
        shift: true,
        description: "Show keyboard shortcuts help",
        action: () => {
          const event = new CustomEvent("toggle-shortcuts-help");
          window.dispatchEvent(event);
        },
      }),

      // Quick actions
      registerShortcut({
        key: "/",
        description: "Focus search input",
        action: () => {
          const searchInput = document.querySelector('input[type="text"][placeholder*="Search"], input[name="query"]') as HTMLElement;
          if (searchInput) {
            searchInput.focus();
          } else {
            navigate("/search");
          }
        },
        preventDefault: false,
        when: () => !location.pathname.startsWith("/search"),
      }),

      // Go back
      registerShortcut({
        key: "[",
        [modKey]: true,
        description: "Go back",
        action: () => {
          window.history.back();
        },
      }),

      // Go forward
      registerShortcut({
        key: "]",
        [modKey]: true,
        description: "Go forward",
        action: () => {
          window.history.forward();
        },
      }),
    ];

    return () => {
      unregisterNavShortcuts.forEach((unregister) => unregister());
    };
  }, [navigate, user, location.pathname]);

  // Global keydown handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (isInputFocused.current) {
        // Allow Escape key even in inputs
        if (e.key !== "Escape") return;
      }

      const shortcutId = getShortcutId({
        key: e.key,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
      });

      const shortcut = shortcuts.get(shortcutId);
      if (shortcut) {
        // Check condition if provided
        if (shortcut.when && !shortcut.when()) {
          return;
        }

        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        shortcut.action();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}

// Hook for registering page-specific shortcuts
export function usePageShortcuts(pageShortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const unregisters = pageShortcuts.map((shortcut) => registerShortcut(shortcut));
    return () => unregisters.forEach((unregister) => unregister());
  }, [pageShortcuts]);
}

// Get all registered shortcuts for help display
export function getAllShortcuts(): Array<{
  shortcut: string;
  description: string;
}> {
  return Array.from(shortcuts.values()).map((s) => ({
    shortcut: getShortcutDisplay(s),
    description: s.description,
  }));
}

function getShortcutDisplay(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  
  if (shortcut.meta) parts.push(isMac ? "⌘" : "Win");
  if (shortcut.ctrl) parts.push(isMac ? "⌃" : "Ctrl");
  if (shortcut.alt) parts.push(isMac ? "⌥" : "Alt");
  if (shortcut.shift) parts.push(isMac ? "⇧" : "Shift");
  
  // Format key
  let key = shortcut.key;
  if (key === " ") key = "Space";
  if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  
  return parts.join(isMac ? "" : "+");
}

// Component to display shortcuts help
export function KeyboardShortcutsHelp({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const shortcuts = getAllShortcuts();
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Shift + ?</kbd> to show this help
              from anywhere.
            </div>

            <div className="grid gap-2">
              {shortcuts.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <span className="text-sm">{s.description}</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono whitespace-nowrap">
                    {s.shortcut}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              <strong>Tip:</strong> Shortcuts work everywhere except when typing in form fields.
              {isMac ? " " : " Use Ctrl for Windows/Linux."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default useKeyboardShortcuts;
