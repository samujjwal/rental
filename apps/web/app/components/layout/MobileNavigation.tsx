import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { cn } from "~/lib/utils";
import {
  Menu,
  X,
  Home,
  Search,
  Calendar,
  Heart,
  MessageCircle,
  Settings,
  HelpCircle,
  LogOut,
  Bell,
  User,
  Plus,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";

interface MobileNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface MobileNavigationProps {
  /**
   * Whether the user is logged in
   */
  isAuthenticated?: boolean;
  /**
   * User type for showing relevant navigation
   */
  userType?: "renter" | "owner" | "admin";
  /**
   * Number of unread messages
   */
  messageCount?: number;
  /**
   * Number of notifications
   */
  notificationCount?: number;
  /**
   * User's name for display
   */
  userName?: string;
  /**
   * Logout callback
   */
  onLogout?: () => void;
}

const publicNavItems: MobileNavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Browse", icon: Search },
];

const renterNavItems: MobileNavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Browse", icon: Search },
  { href: "/bookings", label: "My Bookings", icon: Calendar },
  { href: "/favorites", label: "Favorites", icon: Heart },
];

const ownerNavItems: MobileNavItem[] = [
  { href: "/dashboard/owner", label: "Dashboard", icon: Home },
  { href: "/listings", label: "Listings", icon: Search },
  { href: "/bookings?view=owner", label: "Bookings", icon: Calendar },
  { href: "/dashboard/owner/earnings", label: "Earnings", icon: Settings },
];

/**
 * Mobile Navigation Header
 * Based on wireframe section 8.1
 */
export function MobileHeader({
  isAuthenticated,
  messageCount,
  notificationCount,
  userName,
}: MobileNavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile Header Bar - only visible on mobile */}
      <header className="sticky top-0 z-50 border-b border-border bg-card md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="rounded-lg p-2 hover:bg-accent"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">G</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to="/notifications"
                  className="relative rounded-lg p-2 hover:bg-accent"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {notificationCount && notificationCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/profile"
                  className="rounded-lg p-2 hover:bg-accent"
                  aria-label="Profile"
                >
                  <User className="h-5 w-5" />
                </Link>
              </>
            ) : (
              <Link
                to="/auth/login"
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Slide-out Menu */}
      {isMenuOpen && (
        <MobileSlideMenu
          onClose={() => setIsMenuOpen(false)}
          isAuthenticated={isAuthenticated}
          messageCount={messageCount}
          userName={userName}
        />
      )}
    </>
  );
}

/**
 * Mobile Slide-out Menu
 */
function MobileSlideMenu({
  onClose,
  isAuthenticated,
  messageCount,
  userName,
}: {
  onClose: () => void;
  isAuthenticated?: boolean;
  messageCount?: number;
  userName?: string;
}) {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Add logout logic here
    onClose();
    navigate("/auth/login");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu Panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-72 bg-card shadow-xl md:hidden">
        {/* Menu Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-accent"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
          <Link to="/" className="flex items-center gap-2" onClick={onClose}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">G</span>
            </div>
            <span className="font-semibold">GharBatai</span>
          </Link>
        </div>

        {/* Search Bar */}
        <div className="border-b border-border p-4">
          <NavLink
            to="/search"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            <Search className="h-4 w-4" />
            Search rentals...
          </NavLink>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <div className="space-y-1">
            <NavLink
              to="/"
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                )
              }
            >
              <Home className="h-5 w-5" />
              Home
            </NavLink>
            <NavLink
              to="/search"
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                )
              }
            >
              <Search className="h-5 w-5" />
              Browse Categories
            </NavLink>

            {isAuthenticated && (
              <>
                <NavLink
                  to="/bookings"
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent"
                    )
                  }
                >
                  <Calendar className="h-5 w-5" />
                  My Bookings
                </NavLink>
                <NavLink
                  to="/messages"
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent"
                    )
                  }
                >
                  <span className="flex items-center gap-3">
                    <MessageCircle className="h-5 w-5" />
                    Messages
                  </span>
                  {messageCount && messageCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {messageCount}
                    </Badge>
                  )}
                </NavLink>
                <NavLink
                  to="/favorites"
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent"
                    )
                  }
                >
                  <Heart className="h-5 w-5" />
                  Favorites
                </NavLink>
              </>
            )}
          </div>

          <div className="my-4 border-t border-border" />

          {/* Account Section */}
          <div className="space-y-1">
            {isAuthenticated ? (
              <>
                <NavLink
                  to="/settings"
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent"
                    )
                  }
                >
                  <Settings className="h-5 w-5" />
                  Account Settings
                </NavLink>
                <NavLink
                  to="/help"
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent"
                    )
                  }
                >
                  <HelpCircle className="h-5 w-5" />
                  Help Center
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth/login"
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <User className="h-5 w-5" />
                  Log In
                </Link>
                <Link
                  to="/auth/signup"
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* User Info Footer */}
        {isAuthenticated && userName && (
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 truncate">
                <p className="text-sm font-medium text-foreground">{userName}</p>
                <Link
                  to="/profile"
                  onClick={onClose}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  View profile
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Mobile Bottom Tab Bar for quick navigation
 */
export function MobileBottomNav({
  isAuthenticated,
  userType = "renter",
}: {
  isAuthenticated?: boolean;
  userType?: "renter" | "owner" | "admin";
}) {
  const items = isAuthenticated
    ? userType === "owner"
      ? ownerNavItems
      : renterNavItems
    : publicNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card md:hidden">
      <div className="flex h-16 items-center justify-around">
        {items.slice(0, 5).map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
      {/* Safe area padding for iOS */}
      <div className="h-safe-area-inset-bottom bg-card" />
    </nav>
  );
}
