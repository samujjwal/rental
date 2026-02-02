import {
  type RouteConfigEntry,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
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

  // Admin routes with generic pattern
  route("admin", "routes/admin/_layout.tsx", [
    index("routes/admin/_index.tsx"),
    route("entities/:entity", "routes/admin/entities/[entity].tsx"),
    route("disputes", "routes/admin/disputes.tsx"),
    route("system", "routes/admin/system/_index.tsx"),
    route(
      "system/power-operations",
      "routes/admin/system/power-operations.tsx"
    ),
  ]),
];
