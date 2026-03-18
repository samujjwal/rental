import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  BarChart3,
  Calendar,
  CreditCard,
  Heart,
  Home,
  LifeBuoy,
  ListChecks,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuthStore } from "~/lib/store/auth";
import { cn } from "~/lib/utils";
import { KeyboardShortcutsHelp } from "~/hooks/useKeyboardShortcuts";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  href?: string;
  icon: LucideIcon;
  keywords: string[];
  action?: () => void;
}

const BASE_ITEMS: CommandItem[] = [
  {
    id: "home",
    label: "Home",
    description: "Go back to the landing page",
    href: "/",
    icon: Home,
    keywords: ["home", "landing", "start"],
  },
  {
    id: "search",
    label: "Search rentals",
    description: "Browse listings and saved filter presets",
    href: "/search",
    icon: Search,
    keywords: ["search", "browse", "discover", "find"],
  },
  {
    id: "bookings",
    label: "Bookings",
    description: "Open the booking center",
    href: "/bookings",
    icon: Calendar,
    keywords: ["bookings", "reservations", "rentals"],
  },
  {
    id: "messages",
    label: "Messages",
    description: "Jump into your inbox",
    href: "/messages",
    icon: MessageSquare,
    keywords: ["messages", "inbox", "chat", "conversation"],
  },
  {
    id: "settings",
    label: "Settings",
    description: "Manage account preferences and billing",
    href: "/settings",
    icon: Settings,
    keywords: ["settings", "preferences", "account"],
  },
  {
    id: "help",
    label: "Help center",
    description: "Open support and documentation",
    href: "/help",
    icon: LifeBuoy,
    keywords: ["help", "support", "faq"],
  },
];

export function CommandPalette() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [isOpen, setIsOpen] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo(() => {
    const roleItems: CommandItem[] = [];

    if (user?.role === "owner") {
      roleItems.push(
        {
          id: "owner-dashboard",
          label: "Owner dashboard",
          description: "Review bookings, revenue, and listing health",
          href: "/dashboard/owner",
          icon: BarChart3,
          keywords: ["owner", "dashboard", "earnings"],
        },
        {
          id: "owner-listings",
          label: "My listings",
          description: "Manage listings, analytics, and availability",
          href: "/listings",
          icon: ListChecks,
          keywords: ["listings", "inventory", "manage"],
        },
        {
          id: "new-listing",
          label: "Create listing",
          description: "Start a new listing draft",
          href: "/listings/new",
          icon: Plus,
          keywords: ["new listing", "create", "publish"],
        },
        {
          id: "insurance",
          label: "Insurance",
          description: "Manage policies and renewal tasks",
          href: "/insurance",
          icon: Shield,
          keywords: ["insurance", "coverage", "policy"],
        }
      );
    }

    if (user?.role === "renter") {
      roleItems.push(
        {
          id: "renter-dashboard",
          label: "Renter dashboard",
          description: "Track bookings, favorites, and spending",
          href: "/dashboard/renter",
          icon: Sparkles,
          keywords: ["renter", "dashboard", "overview"],
        },
        {
          id: "favorites",
          label: "Favorites",
          description: "Open saved listings",
          href: "/favorites",
          icon: Heart,
          keywords: ["favorites", "saved", "wishlist"],
        }
      );
    }

    if (user?.role === "admin") {
      roleItems.push(
        {
          id: "admin-home",
          label: "Admin home",
          description: "Open the administration dashboard",
          href: "/admin",
          icon: Shield,
          keywords: ["admin", "moderation", "operations"],
        },
        {
          id: "admin-analytics",
          label: "Admin analytics",
          description: "Review marketplace-wide analytics",
          href: "/admin/analytics",
          icon: BarChart3,
          keywords: ["analytics", "metrics", "admin"],
        },
        {
          id: "admin-system",
          label: "System controls",
          description: "Open system settings and power operations",
          href: "/admin/system",
          icon: CreditCard,
          keywords: ["system", "settings", "power", "ops"],
        }
      );
    }

    return [
      ...BASE_ITEMS,
      ...roleItems,
      {
        id: "shortcuts-help",
        label: "Keyboard shortcuts",
        description: "Show the global keyboard shortcuts reference",
        icon: Sparkles,
        keywords: ["shortcuts", "keyboard", "help"],
        action: () => setShowShortcutsHelp(true),
      },
    ];
  }, [user?.role]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) => {
      const haystack = [item.label, item.description, ...item.keywords]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [items, query]);

  useEffect(() => {
    const openPalette = () => setIsOpen(true);
    const closePalette = () => setIsOpen(false);
    const toggleShortcutsHelp = () => setShowShortcutsHelp((value) => !value);

    window.addEventListener("app:open-command-palette", openPalette);
    window.addEventListener("app:close-command-palette", closePalette);
    window.addEventListener("toggle-shortcuts-help", toggleShortcutsHelp);

    return () => {
      window.removeEventListener("app:open-command-palette", openPalette);
      window.removeEventListener("app:close-command-palette", closePalette);
      window.removeEventListener("toggle-shortcuts-help", toggleShortcutsHelp);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) =>
          filteredItems.length === 0 ? 0 : (index + 1) % filteredItems.length
        );
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) =>
          filteredItems.length === 0
            ? 0
            : (index - 1 + filteredItems.length) % filteredItems.length
        );
      }
      if (event.key === "Enter") {
        const selectedItem = filteredItems[activeIndex];
        if (selectedItem) {
          event.preventDefault();
          if (selectedItem.action) {
            selectedItem.action();
          } else if (selectedItem.href) {
            navigate(selectedItem.href);
          }
          setIsOpen(false);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, filteredItems, isOpen, navigate]);

  if (!isOpen && !showShortcutsHelp) {
    return null;
  }

  return (
    <>
      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm">
          <div className="mx-auto mt-[12vh] w-full max-w-2xl px-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              <div className="border-b border-border px-4 py-4">
                <div className="flex items-center gap-3 rounded-xl border border-input bg-background px-4 py-3">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    autoFocus
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    placeholder="Search routes, pages, and admin tools"
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <span className="hidden rounded-md bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:inline-flex">
                    Esc
                  </span>
                </div>
              </div>

              <div className="max-h-[28rem] overflow-y-auto p-2">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = index === activeIndex;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => {
                          if (item.action) {
                            item.action();
                          } else if (item.href) {
                            navigate(item.href);
                          }
                          setIsOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors",
                          isActive ? "bg-primary/10 text-foreground" : "hover:bg-accent"
                        )}
                      >
                        <div className="rounded-lg bg-muted p-2 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-10 text-center">
                    <p className="text-sm font-medium text-foreground">No matches found</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Try searching for pages like bookings, analytics, messages, or listings.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </>
  );
}

export default CommandPalette;