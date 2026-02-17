# Route + Interaction Checklist (Web + Mobile)

> Purpose: Inventory routes/pages/interactions/actions/flows and define expected behavior for QA across web and mobile.
> Status: First pass from code scan. Each item needs visual + runtime verification.

## Web Routes (apps/web/app/routes.ts)

### Marketing + Info
- [ ] `/` Home: hero search, category shortcuts, featured listings, location detect, CTA to search/listing creation.
- [ ] `/about`: static company story, links to trust/safety, no broken assets.
- [ ] `/careers`: roles list, CTA to apply, mailto/links work.
- [ ] `/press`: press kit/media links, logos download.
- [ ] `/how-it-works`: renter/owner flow explanation with clear CTAs.
- [ ] `/insurance`: insurance overview, CTA to upload or file claims.
- [ ] `/owner-guide`: onboarding guide, CTA to become owner/list.
- [ ] `/earnings`: earnings explainer, calculators/CTA for owners.
- [ ] `/help`: help center landing, search/FAQ links.
- [ ] `/contact`: contact form (if present), sends message or mailto.
- [ ] `/safety`: trust/safety content, links to policies.
- [ ] `/terms`: static terms.
- [ ] `/privacy`: static privacy policy.
- [ ] `/cookies`: cookie policy.

### Auth
- [ ] `/auth/login`: login form, error handling, remember me, redirect to dashboard.
- [ ] `/auth/signup`: signup form, validation, handles email verification status.
- [ ] `/auth/logout`: clears session/tokens and redirects to home/login.
- [ ] `/auth/forgot-password`: request reset email, success state.
- [ ] `/auth/reset-password`: validates token, sets new password.

### Search + Listings
- [ ] `/search`: search results, filters, pagination, map/geo if provided.
- [ ] `/listings`: listings index, filters, sorting, infinite/paged results.
- [ ] `/listings/new`: create listing form, upload images, validation, submit.
- [ ] `/listings/:id`: listing detail, photos, pricing, booking CTA, reviews, owner profile.
- [ ] `/listings/:id/edit`: edit listing, update fields, images, availability.
- [ ] `/favorites`: list of favorited listings, remove/empty state.

### Booking + Payments
- [ ] `/bookings`: bookings list, status filters, owner/renter tabs.
- [ ] `/bookings/:id`: booking detail, actions (cancel, approve, start, return).
- [ ] `/checkout/:bookingId`: price breakdown, payment intent, confirmation.
- [ ] `/payments`: payment history, earnings, payouts.

### Messaging + Reviews
- [ ] `/messages`: conversation list, unread badges, open thread.
- [ ] `/reviews`: review list, create/respond/report.

### Disputes + Insurance
- [ ] `/disputes`: dispute list, statuses, open detail.
- [ ] `/disputes/:id`: dispute detail, responses, close dispute.
- [ ] `/disputes/new/:bookingId`: dispute creation, evidence upload, submit.
- [ ] `/insurance/upload`: upload insurance docs, status feedback.

### Dashboard + Profile + Settings
- [ ] `/dashboard`: role-aware hub, key stats and shortcuts.
- [ ] `/dashboard/owner`: owner dashboard with key stats.
- [ ] `/dashboard/owner/calendar`: calendar availability and blocked dates.
- [ ] `/dashboard/owner/earnings`: earnings charts/summary.
- [ ] `/dashboard/owner/insights`: analytics insights.
- [ ] `/dashboard/owner/performance`: performance metrics.
- [ ] `/dashboard/renter`: renter dashboard with bookings/recommendations.
- [ ] `/profile/:userId`: public profile, listings/reviews.
- [ ] `/settings`: settings index.
- [ ] `/settings/profile`: profile update form + avatar upload.
- [ ] `/settings/notifications`: notification preferences.

### Organizations
- [ ] `/organizations`: org list + manage.
- [ ] `/organizations/create`: create org form.
- [ ] `/organizations/:id/settings`: org settings update/deactivate.
- [ ] `/organizations/:id/members`: members list + invite/remove/role.
- [ ] `/organizations/:id/listings`: org listings overview + manage.

### Admin
- [ ] `/admin`: admin dashboard overview + links.
- [ ] `/admin/analytics`: reporting dashboards.
- [ ] `/admin/entities/:entity`: entity management (users/listings/etc).
- [ ] `/admin/disputes`: dispute queue + actions.
- [ ] `/admin/system`: system settings hub.
- [ ] `/admin/system/general`: platform settings.
- [ ] `/admin/system/database`: db operations/health.
- [ ] `/admin/system/notifications`: notification settings.
- [ ] `/admin/system/security`: security settings.
- [ ] `/admin/system/api-keys`: key management.
- [ ] `/admin/system/backups`: backup list/create/restore.
- [ ] `/admin/system/email`: email settings + test send.
- [ ] `/admin/system/environment`: env variables display.
- [ ] `/admin/system/logs`: logs view.
- [ ] `/admin/system/audit`: audit logs.
- [ ] `/admin/system/power-operations`: cache/maintenance actions.
- [ ] `/admin/fraud`: fraud dashboards + controls.

## Mobile Screens (apps/mobile/App.tsx)

### Core
- [ ] `Home`: search bar, location input, quick links to core flows.
- [ ] `Search`: results list, empty state, tap-through to listing.
- [ ] `Listing`: detail view, reviews, CTA to book.
- [ ] `BookingFlow`: select dates, availability check, create booking.
- [ ] `Checkout`: booking summary, payment intent.
- [ ] `BookingDetail`: view status and actions.
- [ ] `Bookings`: list + filters for owner/renter.

### Auth
- [ ] `Login`: sign-in form + errors.
- [ ] `Signup`: registration form + validation.
- [ ] `ForgotPassword`: reset email request.
- [ ] `ResetPassword`: set new password.

### Messaging + Reviews
- [ ] `Messages`: conversation list.
- [ ] `MessageThread`: send/receive messages.
- [ ] `Reviews`: list + create review.

### Profile + Settings
- [ ] `Profile`: current user profile.
- [ ] `ProfileView`: public user profile.
- [ ] `Settings`: update profile fields.
- [ ] `SettingsIndex`: settings hub.
- [ ] `SettingsProfile`: profile edit.
- [ ] `SettingsNotifications`: notification prefs.

### Owner / Host
- [ ] `OwnerDashboard`: owner stats.
- [ ] `OwnerListings`: host listings list.
- [ ] `OwnerCalendar`: availability calendar.
- [ ] `OwnerEarnings`: earnings summary.
- [ ] `OwnerInsights`: analytics.
- [ ] `OwnerPerformance`: performance metrics.

### Disputes + Insurance
- [ ] `Disputes`: disputes list.
- [ ] `DisputeCreate`: file dispute.
- [ ] `DisputeDetail`: dispute detail + responses.
- [ ] `Insurance`: info screen.
- [ ] `InsuranceUpload`: upload docs.

### Organizations
- [ ] `Organizations`: org list.
- [ ] `OrganizationCreate`: create org.
- [ ] `OrganizationSettings`: update/deactivate org.
- [ ] `OrganizationMembers`: invite/remove/role.

### Other Info
- [ ] `About`, `Careers`, `Contact`, `Press`, `HowItWorks`, `OwnerGuide`, `Earnings`, `Help`, `Safety`, `Terms`, `Privacy`, `Cookies`, `BecomeOwner`, `Payments`, `Favorites`, `Dashboard`, `RenterDashboard`.

## Cross-Platform Flows (Expected Behavior)

- [ ] **Auth**: signup/login -> token persisted -> `/dashboard` (web) or `Dashboard` (mobile). Refresh token works. Logout clears tokens and state.
- [ ] **Search**: query + location -> results list -> listing detail. Filters/sort/pagination (web) and basic filters (mobile).
- [ ] **Listing Create/Edit**: owner completes form, uploads images, saves; listing appears in owner listings.
- [ ] **Booking**: from listing -> select dates -> availability check -> create booking -> checkout -> confirm -> booking detail.
- [ ] **Payments**: checkout creates payment intent, handles success/failure, records transaction and updates booking status.
- [ ] **Messaging**: open conversation, send message, see real-time/refresh updates, unread count updates.
- [ ] **Reviews**: create/reply/report review from booking completion; reviews appear on listing/profile.
- [ ] **Favorites**: add/remove favorite from listing; favorites list updates.
- [ ] **Disputes**: file dispute with evidence; dispute list updates; admin can resolve.
- [ ] **Organizations**: create org, invite members, manage roles, update settings.
- [ ] **Admin**: manage users/listings/bookings/payments/disputes, system settings + backups.

## UX/Visual Expectations (Web + Mobile)

- [ ] Modern, soothing visual system: consistent typography, soft spacing, neutral palette, high contrast for actions.
- [ ] Clear primary CTA per screen; secondary actions subdued.
- [ ] Loading, empty, error states are styled and non-blocking.
- [ ] Responsive layout on web (mobile breakpoints) + safe-area handling on mobile.

## Backend/Integration Expectations

- [ ] Web uses `VITE_API_URL` or default `http://localhost:3400/api` for all data actions.
- [ ] Mobile uses `@rental-portal/mobile-sdk` pointing to `http://localhost:3400/api`.
- [ ] No mock data in production code paths (hardcoded defaults only as fallback when API fails).
