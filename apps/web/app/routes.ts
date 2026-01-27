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
        route("refunds", "routes/admin/payments/refunds.tsx"),
        route("payouts", "routes/admin/payments/payouts.tsx"),
        route("ledger", "routes/admin/payments/ledger.tsx"),
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
        route("health", "routes/admin/system/health.tsx"),
        route("logs", "routes/admin/system/logs.tsx"),
        route("audit", "routes/admin/system/audit.tsx"),
        route("database", "routes/admin/system/database.tsx"),
        route("backups", "routes/admin/system/backups.tsx"),
      ]),

      // Sidebar groups (pathless) for hierarchical organization
      layout("routes/admin/user-management/_layout.tsx", [
        route("roles", "routes/admin.roles.tsx"),
        route("sessions", "routes/admin.sessions.tsx"),
      ]),

      layout("routes/admin/content-management/_layout.tsx", [
        route("categories", "routes/admin.categories.tsx"),
        route("reviews", "routes/admin.reviews.tsx"),
        route("messages", "routes/admin.messages.tsx"),
        route("favorites", "routes/admin.favorites.tsx"),
      ]),

      layout("routes/admin/bookings-payments/_layout.tsx", [
        route("refunds", "routes/admin.refunds.tsx"),
        route("payouts", "routes/admin.payouts.tsx"),
        route("ledger", "routes/admin.ledger.tsx"),
      ]),

      layout("routes/admin/disputes-moderation/_layout.tsx", [
        route("disputes", "routes/admin.disputes.tsx"),
        route("disputes/:id", "routes/admin.disputes.$id.tsx"),
        route("moderation", "routes/admin.moderation.tsx"),
        route("condition-reports", "routes/admin.condition-reports.tsx"),
      ]),

      layout("routes/admin/insurance/_layout.tsx", [
        route("insurance", "routes/admin.insurance.tsx"),
        route("insurance-claims", "routes/admin.insurance-claims.tsx"),
      ]),

      layout("routes/admin/notifications/_layout.tsx", [
        route("notifications", "routes/admin.notifications.tsx"),
        route("email-templates", "routes/admin.email-templates.tsx"),
        route("push-notifications", "routes/admin.push-notifications.tsx"),
        route("device-tokens", "routes/admin.device-tokens.tsx"),
      ]),

      layout("routes/admin/system-configuration/_layout.tsx", [
        route("api-keys", "routes/admin.api-keys.tsx"),
        route("services", "routes/admin.services.tsx"),
        route("environment", "routes/admin.environment.tsx"),
        route("audit-logs", "routes/admin.audit-logs.tsx"),
      ]),

      layout("routes/admin/monitoring/_layout.tsx", [
        route("health", "routes/admin.health.tsx"),
        route("performance", "routes/admin.performance.tsx"),
        route("error-logs", "routes/admin.error-logs.tsx"),
      ]),

      layout("routes/admin/data-management/_layout.tsx", [
        route("database", "routes/admin.database.tsx"),
        route("backups", "routes/admin.backups.tsx"),
        route("exports", "routes/admin.exports.tsx"),
        route("imports", "routes/admin.imports.tsx"),
      ]),
    ]),
  ]),
] as const satisfies RouteConfig;
