/**
 * Shared sticky top navigation bar used by both:
 *   - _app.tsx (the authenticated app layout)
 *   - home.tsx (which renders its own full page, outside the app layout)
 *
 * Centralises auth state, unread badge polling, and the avatar dropdown so
 * there is a single implementation instead of two diverging copies.
 */
import { Link, useLocation, useNavigate } from "react-router";
import { useState, useEffect, useRef } from "react";
import {
  Bell,
  Building2,
  CreditCard,
  Heart,
  LogOut,
  MessageCircle,
  Search,
  AlertTriangle,
  LayoutDashboard,
  Settings,
  Shield,
  User,
  ChevronDown,
  Plus,
  Menu,
  X,
  Calendar,
  Package,
  Star,
  ShieldAlert,
} from "lucide-react";
import { useAuthStore } from "~/lib/store/auth";
import { ThemeToggle } from "~/components/theme";
import { LanguageSelector } from "~/components/language";
import { cn } from "~/lib/utils";
import { useTranslation } from "react-i18next";
import { notificationsApi } from "~/lib/api/notifications";
import { messagingApi } from "~/lib/api/messaging";
import { useScrollLock } from "~/hooks/useScrollLock";

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Renders the full sticky top navigation header.
 * Owns the unread-count polling loop so only one fetch runs regardless of
 * which route is displaying it.
 */
export function AppNav() {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  useScrollLock(mobileMenuOpen);

  const initials = isAuthenticated
    ? (
        (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")
      ).toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"
    : null;

  // ── Single unread-count polling loop (60 s interval) ──────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const fetchCounts = async () => {
      try {
        const [notifs, msgs] = await Promise.allSettled([
          notificationsApi.getUnreadCount(),
          messagingApi.getUnreadCount(),
        ]);
        if (cancelled) return;
        if (notifs.status === "fulfilled")
          setUnreadNotifications(Number(notifs.value?.count || 0));
        if (msgs.status === "fulfilled")
          setUnreadMessages(Number(msgs.value?.count || 0));
      } catch {
        // Non-critical
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  // ── Close avatar dropdown on outside click ─────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        avatarMenuRef.current &&
        !avatarMenuRef.current.contains(e.target as Node)
      ) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Close menus on route change ────────────────────────────────────────────
  useEffect(() => {
    setAvatarMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const dashboardHref =
    user?.role === "admin"
      ? "/admin"
      : user?.role === "owner"
      ? "/dashboard/owner"
      : "/dashboard/renter";

  const isAdmin = user?.role === "admin";
  const isOwner = user?.role === "owner" || isAdmin;

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link
            to="/"
            className="text-xl font-bold text-primary hover:text-primary/90 transition-colors shrink-0"
          >
            GharBatai
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {isAuthenticated && (
              <Link
                to={dashboardHref}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  location.pathname.startsWith("/dashboard") ||
                    location.pathname.startsWith("/admin")
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                {t("nav.dashboard", "Dashboard")}
              </Link>
            )}

            {/* Inline search input — desktop */}
            {(() => {
              const active = location.pathname === "/search" || location.pathname.startsWith("/search/");
              return (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement)?.value?.trim();
                    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
                  }}
                  className="flex items-center"
                >
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors",
                      active
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-muted/30 hover:border-primary/40 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20"
                    )}
                  >
                    <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <input
                      name="q"
                      type="text"
                      placeholder={t("common.search", "Search…")}
                      className="bg-transparent outline-none text-sm w-28 placeholder:text-muted-foreground text-foreground"
                    />
                  </div>
                </form>
              );
            })()}

            {/* Authenticated-only desktop nav links (Bookings only; Messages is icon-strip) */}
            {isAuthenticated && (
              <Link
                to="/bookings"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  location.pathname === "/bookings" || location.pathname.startsWith("/bookings/")
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {t("nav.bookings", "Bookings")}
              </Link>
            )}

            {/* List an Item — owner / admin CTA */}
            {isAuthenticated && isOwner && (
              <Link
                to="/listings/new"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  location.pathname === "/listings/new"
                    ? "text-primary bg-primary/10"
                    : "text-primary hover:bg-primary/10"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                {t("listings.create.title", "List Item")}
              </Link>
            )}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <LanguageSelector size="sm" iconOnly />
            <ThemeToggle size="sm" />

            {isAuthenticated ? (
              <>
                <Link
                  to="/favorites"
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                  aria-label={t("nav.favorites")}
                >
                  <Heart className="w-5 h-5" />
                </Link>

                {/* Notifications bell */}
                <Link
                  to="/notifications"
                  className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                  aria-label={
                    unreadNotifications > 0
                      ? t(
                          "nav.notificationsWithCount",
                          "{{count}} unread notifications",
                          { count: unreadNotifications }
                        )
                      : t("nav.notifications")
                  }
                  onClick={() => {
                    if (unreadNotifications > 0) {
                      setUnreadNotifications(0);
                      notificationsApi.markAllAsRead().catch(() => {});
                    }
                  }}
                >
                  <Bell className="w-5 h-5" />
                  <UnreadBadge count={unreadNotifications} />
                </Link>

                {/* Messages icon */}
                <Link
                  to="/messages"
                  className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                  aria-label={
                    unreadMessages > 0
                      ? t(
                          "nav.messagesWithCount",
                          "{{count}} unread messages",
                          { count: unreadMessages }
                        )
                      : t("nav.messages")
                  }
                  onClick={() => setUnreadMessages(0)}
                >
                  <MessageCircle className="w-5 h-5" />
                  <UnreadBadge count={unreadMessages} />
                </Link>

                {/* Avatar dropdown */}
                <div className="relative ml-1" ref={avatarMenuRef}>
                  <button
                    onClick={() => setAvatarMenuOpen((o) => !o)}
                    className="flex items-center gap-1 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-label={t("nav.profileMenu", "Profile menu")}
                    aria-expanded={avatarMenuOpen}
                    aria-haspopup="true"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors overflow-hidden">
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.firstName ?? "Profile"}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-primary font-semibold text-sm">
                          {initials}
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 text-muted-foreground transition-transform",
                        avatarMenuOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {avatarMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-card shadow-lg py-1 z-50">
                      <div className="px-4 py-2 border-b">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user?.email}
                        </p>
                      </div>

                      <Link
                        to={dashboardHref}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                        {t("nav.dashboard", "Dashboard")}
                      </Link>
                      <Link
                        to={`/profile/${user?.id}`}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <User className="w-4 h-4 text-muted-foreground" />
                        {t("nav.viewProfile", "View Profile")}
                      </Link>
                      {isOwner && (
                        <Link
                          to="/listings"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          <Package className="w-4 h-4 text-muted-foreground" />
                          {t("dashboard.myListings", "My Listings")}
                        </Link>
                      )}
                      {isAdmin && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          <ShieldAlert className="w-4 h-4 text-muted-foreground" />
                          {t("nav.admin", "Admin Panel")}
                        </Link>
                      )}
                      <Link
                        to="/disputes"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                        {t("nav.disputes", "Disputes")}
                      </Link>
                      <Link
                        to="/reviews"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <Star className="w-4 h-4 text-muted-foreground" />
                        {t("nav.reviews", "Reviews")}
                      </Link>
                      <Link
                        to="/payments"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                        {t("nav.payments", "Payment History")}
                      </Link>
                      <Link
                        to="/insurance"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <Shield className="w-4 h-4 text-muted-foreground" />
                        {t("nav.insurance", "Insurance")}
                      </Link>
                      <Link
                        to="/organizations"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {t("nav.organizations", "Organizations")}
                      </Link>
                      <Link
                        to="/settings/profile"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <Settings className="w-4 h-4 text-muted-foreground" />
                        {t("nav.settings", "Settings")}
                      </Link>

                      <div className="border-t my-1" />

                      <Link
                        to="/auth/logout"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        {t("nav.signOut", "Sign Out")}
                      </Link>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  to={`/auth/login?redirectTo=${encodeURIComponent(location.pathname)}`}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  to="/auth/signup"
                  className="px-3 py-1.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {t("nav.signup")}
                </Link>
              </>
            )}

            {/* Mobile hamburger — visible below md */}
            <button
              className="md:hidden ml-1 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label={mobileMenuOpen ? t("nav.closeMenu", "Close menu") : t("nav.openMenu", "Open menu")}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile drawer ─────────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-72 bg-card border-l shadow-xl flex flex-col md:hidden overflow-y-auto">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 h-14 border-b shrink-0">
              <span className="font-bold text-primary text-lg">GharBatai</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label={t("nav.closeMenu", "Close menu")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User identity */}
            {isAuthenticated && (
              <div className="px-4 py-3 border-b">
                <p className="text-sm font-semibold text-foreground">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-primary capitalize mt-0.5">{user?.role}</p>
              </div>
            )}

            {/* Nav links */}
            <nav className="flex-1 py-2" aria-label="Mobile navigation">
              {[
                { to: "/search", label: t("common.search", "Search"), icon: Search, always: true },
                { to: dashboardHref, label: t("nav.dashboard", "Dashboard"), icon: LayoutDashboard, always: false },
                { to: "/bookings", label: t("nav.bookings", "Bookings"), icon: Calendar, always: false },
                { to: "/messages", label: t("nav.messages", "Messages"), icon: MessageCircle, always: false, badge: unreadMessages },
                { to: "/favorites", label: t("nav.favorites", "Favorites"), icon: Heart, always: false },
                { to: "/notifications", label: t("nav.notifications", "Notifications"), icon: Bell, always: false, badge: unreadNotifications },
                { to: "/disputes", label: t("nav.disputes", "Disputes"), icon: AlertTriangle, always: false },
                { to: "/reviews", label: t("nav.reviews", "Reviews"), icon: Star, always: false },
                { to: "/payments", label: t("nav.payments", "Payment History"), icon: CreditCard, always: false },
                { to: "/insurance", label: t("nav.insurance", "Insurance"), icon: Shield, always: false },
                { to: "/organizations", label: t("nav.organizations", "Organizations"), icon: Building2, always: false },
              ]
                .filter(({ always }) => always || isAuthenticated)
                .map(({ to, label, icon: Icon, badge }) => {
                  const active = location.pathname === to || location.pathname.startsWith(to + "/");
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                        active
                          ? "text-foreground bg-muted"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{label}</span>
                      {badge != null && badge > 0 && (
                        <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </Link>
                  );
                })}

              {/* Owner-only links */}
              {isAuthenticated && isOwner && (
                <>
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("nav.ownerTools", "Owner")}
                    </p>
                  </div>
                  {[
                    { to: "/listings", label: t("dashboard.myListings", "My Listings"), icon: Package },
                    { to: "/listings/new", label: t("listings.create.title", "List New Item"), icon: Plus },
                    { to: "/dashboard/owner/earnings", label: t("nav.payouts", "Payouts"), icon: null },
                    { to: "/dashboard/owner/performance", label: t("nav.analytics", "Analytics"), icon: null },
                  ].map(({ to, label, icon: Icon }) => {
                    const active = location.pathname === to;
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                          active
                            ? "text-foreground bg-muted"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        {Icon ? <Icon className="w-4 h-4 shrink-0" /> : <span className="w-4" />}
                        {label}
                      </Link>
                    );
                  })}
                </>
              )}

              {/* Admin link */}
              {isAuthenticated && isAdmin && (
                <Link
                  to="/admin"
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                    location.pathname.startsWith("/admin")
                      ? "text-foreground bg-muted"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {t("nav.admin", "Admin Panel")}
                </Link>
              )}
            </nav>

            {/* Footer actions */}
            <div className="border-t py-2 shrink-0">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/settings/profile"
                    className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    {t("nav.settings", "Settings")}
                  </Link>
                  <Link
                    to="/auth/logout"
                    className="flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("nav.signOut", "Sign Out")}
                  </Link>
                </>
              ) : (
                <div className="flex flex-col gap-2 px-4 py-3">
                  <Link
                    to={`/auth/login?redirectTo=${encodeURIComponent(location.pathname)}`}
                    className="block text-center px-3 py-2 rounded-lg border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    {t("nav.login", "Log In")}
                  </Link>
                  <Link
                    to="/auth/signup"
                    className="block text-center px-3 py-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {t("nav.signup", "Sign Up")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
