import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  layout("routes/root.tsx", [
    route("auth/login", "routes/auth.login.tsx"),
    route("auth/signup", "routes/auth.signup.tsx"),
    route("auth/logout", "routes/auth.logout.tsx"),
    route("auth/forgot-password", "routes/auth.forgot-password.tsx"),
    route("auth/reset-password", "routes/auth.reset-password.tsx"),
    route("dashboard", "routes/dashboard.tsx"),
    route("dashboard/owner", "routes/dashboard.owner.tsx"),
    route("dashboard/renter", "routes/dashboard.renter.tsx"),
    route("bookings", "routes/bookings.tsx"),
    route("bookings/:id", "routes/bookings.$id.tsx"),
    route("checkout/:bookingId", "routes/checkout.$bookingId.tsx"),
    route("listings/new", "routes/listings.new.tsx"),
    route("listings/:id", "routes/listings.$id.tsx"),
    route("listings/:id/edit", "routes/listings.$id.edit.tsx"),
    route("messages", "routes/messages.tsx"),
    route("insurance/upload", "routes/insurance.upload.tsx"),
    route("disputes/new/:bookingId", "routes/disputes.new.$bookingId.tsx"),
    route("organizations", "routes/organizations._index.tsx"),
    route(
      "organizations/:id/settings",
      "routes/organizations.$id.settings.tsx"
    ),
    route("organizations/:id/members", "routes/organizations.$id.members.tsx"),
    route("profile/:userId", "routes/profile.$userId.tsx"),
    route("search", "routes/search.tsx"),
    route("settings/profile", "routes/settings.profile.tsx"),
    route("settings/notifications", "routes/settings.notifications.tsx"),

    // Admin routes with hierarchical structure
    route("admin", "routes/admin/_layout.tsx", [
      index("routes/admin/_index.tsx"),

      // User management
      route("users", "routes/admin/users/_layout.tsx", [
        index("routes/admin/users/_index.tsx"),
        route("roles", "routes/admin/users/roles.tsx"),
        route("sessions", "routes/admin/users/sessions.tsx"),
        route(":id", "routes/admin/users/$id.tsx"),
        route(":id/edit", "routes/admin/users/$id.edit.tsx"),
      ]),

      // Organization management
      route("organizations", "routes/admin/organizations/_layout.tsx", [
        index("routes/admin/organizations/_index.tsx"),
        route(":id", "routes/admin/organizations/$id.tsx"),
        route(":id/edit", "routes/admin/organizations/$id.edit.tsx"),
        route(":id/members", "routes/admin/organizations/$id.members.tsx"),
      ]),

      // Listings management
      route("listings", "routes/admin/listings/_layout.tsx", [
        index("routes/admin/listings/_index.tsx"),
        route(":id", "routes/admin/listings/$id.tsx"),
        route(":id/edit", "routes/admin/listings/$id.edit.tsx"),
        route("categories", "routes/admin/listings/categories.tsx"),
        route("pending", "routes/admin/listings/pending.tsx"),
      ]),

      // Bookings management
      route("bookings", "routes/admin/bookings/_layout.tsx", [
        index("routes/admin/bookings/_index.tsx"),
        route(":id", "routes/admin/bookings/$id.tsx"),
        route(":id/edit", "routes/admin/bookings/$id.edit.tsx"),
        route("calendar", "routes/admin/bookings/calendar.tsx"),
      ]),

      // Payments management
      route("payments", "routes/admin/payments/_layout.tsx", [
        index("routes/admin/payments/_index.tsx"),
        route(":id", "routes/admin/payments/$id.tsx"),
      ]),

      // Settings and configuration
      route("settings", "routes/admin/settings/_layout.tsx", [
        index("routes/admin/settings/_index.tsx"),
        route("general", "routes/admin/settings/general.tsx"),
        route("api-keys", "routes/admin/settings/api-keys.tsx"),
        route("services", "routes/admin/settings/services.tsx"),
        route("environment", "routes/admin/settings/environment.tsx"),
      ]),

      // Analytics and reporting
      route("analytics", "routes/admin/analytics/_layout.tsx", [
        index("routes/admin/analytics/_index.tsx"),
        route("users", "routes/admin/analytics/users.tsx"),
        route("business", "routes/admin/analytics/business.tsx"),
        route("performance", "routes/admin/analytics/performance.tsx"),
        route("reports", "routes/admin/analytics/reports.tsx"),
      ]),

      // System management
      route("system", "routes/admin/system/_layout.tsx", [
        index("routes/admin/system/_index.tsx"),
        route("settings", "routes/admin/system/settings.tsx"),
        route("health", "routes/admin/system/health.tsx"),
        route("logs", "routes/admin/system/logs.tsx"),
        route("audit", "routes/admin/system/audit.tsx"),
        route("database", "routes/admin/system/database.tsx"),
        route("backups", "routes/admin/system/backups.tsx"),
        route("api-keys", "routes/admin/system/api-keys.tsx"),
        route("services", "routes/admin/system/services.tsx"),
        route("environment", "routes/admin/system/environment.tsx"),
        route("exports", "routes/admin/system/exports.tsx"),
        route("imports", "routes/admin/system/imports.tsx"),
      ]),

      // Monitoring
      route("monitoring", "routes/admin/monitoring/_layout.tsx", [
        route("performance", "routes/admin/monitoring/performance.tsx"),
      ]),

      // Content Management
      route("content", "routes/admin/content/_layout.tsx", [
        route("categories", "routes/admin/content/categories.tsx"),
        route("reviews", "routes/admin/content/reviews.tsx"),
        route("messages", "routes/admin/content/messages.tsx"),
        route("favorites", "routes/admin/content/favorites.tsx"),
      ]),

      // Finance & Payments
      route("finance", "routes/admin/finance/_layout.tsx", [
        route("refunds", "routes/admin/finance/refunds.tsx"),
        route("payouts", "routes/admin/finance/payouts.tsx"),
        route("ledger", "routes/admin/finance/ledger.tsx"),
      ]),

      // Moderation
      route("moderation", "routes/admin/moderation/_layout.tsx", [
        route("disputes", "routes/admin/moderation/disputes.tsx"),
        route("queue", "routes/admin/moderation/queue.tsx"),
        route(
          "condition-reports",
          "routes/admin/moderation/condition-reports.tsx"
        ),
      ]),

      // Insurance
      route("insurance", "routes/admin/insurance/_layout.tsx", [
        index("routes/admin/insurance/_index.tsx"),
        route("claims", "routes/admin/insurance/claims.tsx"),
      ]),

      // Notifications
      route("notifications", "routes/admin/notifications/_layout.tsx", [
        index("routes/admin/notifications/index.tsx"),
        route("templates", "routes/admin/notifications/templates.tsx"),
        route("push", "routes/admin/notifications/push.tsx"),
        route("tokens", "routes/admin/notifications/tokens.tsx"),
      ]),
    ]),
  ]),
] as const satisfies RouteConfig;
