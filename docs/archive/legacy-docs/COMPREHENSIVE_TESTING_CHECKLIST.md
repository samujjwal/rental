# Comprehensive Testing and QA Checklist

## 1. Purpose

This checklist translates the current codebase into a practical QA plan. It is intentionally broader than a smoke test list: it covers routes, end-to-end flows, UI components, state transitions, accessibility, responsiveness, security, and product-quality expectations.

Use this checklist for:

- manual feature QA
- release readiness review
- regression testing after large changes
- UX validation against the actual product surface
- prioritizing gaps in automation

## 2. How to Use This Document

- treat sections 5 and 6 as release-blocking for core product confidence
- use sections 7 through 11 for broader regression coverage
- mark any failure with severity, repro steps, route, user role, and expected result
- do not sign off a journey if the happy path works but the empty, loading, error, and edge states fail

## 3. Test Environment Readiness

### 3.1 Infrastructure

- [ ] PostgreSQL is running and migrations are applied
- [ ] Redis is running
- [ ] API server is reachable
- [ ] Web app is reachable
- [ ] Mobile app can connect to the API
- [ ] Required environment variables exist for auth, storage, payments, email, SMS, and notifications
- [ ] Test seed data supports renter, owner, and admin roles

### 3.2 Recommended Commands

- [ ] `pnpm run setup`
- [ ] `pnpm run services:up`
- [ ] `pnpm run test`
- [ ] `pnpm run test:e2e:web`
- [ ] `pnpm --filter @rental-portal/api run test:e2e`

### 3.3 Personas to Validate

- [ ] Guest user
- [ ] Newly registered renter
- [ ] Returning renter with active and past bookings
- [ ] Owner with draft, active, and paused listings
- [ ] Owner with pending payout and insurance state
- [ ] Admin with full platform permissions
- [ ] Mobile user opening deep links from notifications

## 4. Release Exit Criteria

- [ ] Search to booking to checkout works end-to-end for a renter
- [ ] Owner can create, edit, publish, and manage a listing
- [ ] Booking state transitions allow only valid role-based actions
- [ ] Messaging and notifications remain accurate across nav, lists, and detail views
- [ ] Reviews and disputes work after booking completion or failure
- [ ] Admin can navigate to required operational surfaces without dead links
- [ ] Critical pages pass keyboard, screen-reader, and responsive checks
- [ ] No release-blocking payment, auth, or navigation regressions remain

## 5. Critical Regression Checks from This Review

- [ ] Desktop top-nav search submits a parameter the search route actually reads, and the query remains visible on `/search`
- [ ] Admin sidebar links only point to registered and accessible destinations
- [ ] Owner dashboard insurance widgets and expiring policy alerts display correctly when policies exist

## 6. Core End-to-End Journeys

### 6.1 Guest Discovery Journey

- [ ] Open `/`
- [ ] Use the hero search input with a keyword
- [ ] Set or change location
- [ ] Navigate to `/search` with the query preserved
- [ ] Switch between grid, list, and map contexts where available
- [ ] Open a listing detail page
- [ ] Verify gallery, price, location, trust signals, and reviews are visible before scroll fatigue sets in
- [ ] Attempt booking and verify auth handoff preserves intent

### 6.2 Renter Booking Journey

- [ ] Log in as renter
- [ ] Search with query, location, category, and price filters
- [ ] Favorite and unfavorite a listing
- [ ] Open listing detail
- [ ] Select booking dates from the calendar
- [ ] Verify blocked dates are clearly unavailable
- [ ] Verify availability check and price breakdown update after valid date selection
- [ ] Add booking message or quantity where relevant
- [ ] Create booking
- [ ] Complete checkout if booking enters `PENDING_PAYMENT`
- [ ] Return to booking detail and verify status, timeline, and next actions

### 6.3 Owner Operations Journey

- [ ] Log in as owner
- [ ] Open owner dashboard
- [ ] Create a listing from `/listings/new`
- [ ] Complete details, location, pricing, and image upload steps
- [ ] Verify category-specific fields appear only when relevant
- [ ] Publish the listing
- [ ] Open `/listings` and confirm draft or published status appears correctly
- [ ] Pause and reactivate a listing
- [ ] Open owner calendar, earnings, insights, and performance routes
- [ ] Verify unread messages, notifications, and insurance signals are visible when present

### 6.4 Messaging and Trust Journey

- [ ] Start a conversation from a listing
- [ ] Open `/messages` and verify the selected conversation opens correctly
- [ ] Send a text message
- [ ] Upload an attachment
- [ ] Mark messages as read through usage
- [ ] Receive a notification and deep-link into the correct destination
- [ ] Open `/reviews` after a completed booking and submit a valid review
- [ ] Open `/disputes/new/:bookingId` and file a dispute with evidence

### 6.5 Admin Operations Journey

- [ ] Log in as admin
- [ ] Open `/admin`
- [ ] Verify quick links, alerts, KPI cards, and activity feed render
- [ ] Open analytics, disputes, fraud, and system pages
- [ ] Verify entity admin pages for allowed entities work end-to-end
- [ ] Confirm no visible admin nav item routes to a dead or inaccessible page

## 7. Page-by-Page QA Checklist

## 7.1 Marketing, Informational, and Auth Pages

- [ ] `/` renders hero, categories, featured listings, and primary CTAs without broken layout
- [ ] `/about` content hierarchy is readable and not visually dense
- [ ] `/careers` surfaces role or contact CTA clearly
- [ ] `/press` includes clear outbound actions
- [ ] `/how-it-works` reduces product ambiguity for both renters and owners
- [ ] `/owner-guide` makes owner onboarding actionable
- [ ] `/help` has useful support grouping and no dead-end answers
- [ ] `/contact` communicates response expectations and working contact paths
- [ ] `/safety` presents practical user guidance, not only policy language
- [ ] `/terms`, `/privacy`, and `/cookies` remain readable on desktop and mobile
- [ ] `/auth/login` supports email/password, MFA continuation, error states, and redirect restoration
- [ ] `/auth/signup` validates inline and completes account creation cleanly
- [ ] `/auth/forgot-password` shows neutral success messaging and error recovery
- [ ] `/auth/reset-password` validates password rules and handles invalid or expired states

## 7.2 Search and Discovery Pages

- [ ] `/search` loads results from URL state
- [ ] Query changes update results and preserve user context
- [ ] Category filter applies correctly
- [ ] Price min and max normalize correctly
- [ ] Location selection and manual apply both work
- [ ] Radius control behaves correctly when coordinates exist
- [ ] Condition, instant booking, and delivery filters work independently and together
- [ ] Map and list views show the same underlying result set
- [ ] "Search this area" changes results intentionally
- [ ] Empty state offers clear recovery
- [ ] Pagination does not reset filters unexpectedly

## 7.3 Listing and Booking Pages

- [ ] `/listings/:id` shows gallery, title, location, price, category, and trust badges
- [ ] Listing detail supports favorite and share actions
- [ ] Contact owner starts or opens a conversation
- [ ] Booking calendar shows blocked, past, hover-preview, and selected states clearly
- [ ] Booking panel handles invalid date ranges with useful feedback
- [ ] Delivery or pickup options appear only when supported
- [ ] Promo code UI behaves predictably
- [ ] Reviews load, paginate, and append correctly
- [ ] `/bookings` lists bookings with understandable statuses
- [ ] `/bookings/:id` shows only role-valid actions for the current booking state
- [ ] Payment-success query state on booking detail resolves clearly
- [ ] `/checkout/:bookingId` shows secure payment UI, summary, cancel path, and Stripe error handling

## 7.4 Dashboard and Operations Pages

- [ ] `/dashboard` redirects to the correct role-specific route
- [ ] `/dashboard/renter` prioritizes urgent bookings and payments over historical summary
- [ ] `/dashboard/renter` recommendations and favorites render useful next actions
- [ ] `/dashboard/owner` highlights pending bookings, active listings, earnings, and communication
- [ ] `/dashboard/owner/calendar` makes occupancy and gaps obvious
- [ ] `/dashboard/owner/earnings` shows current and pending balances clearly
- [ ] `/dashboard/owner/insights` presents actionable insight cards rather than decorative summaries
- [ ] `/dashboard/owner/performance` explains trends with enough context to act
- [ ] `/listings` supports owner search, status filters, pause, activate, publish, edit, and delete actions
- [ ] `/listings/new` step flow is understandable and recoverable after validation failures
- [ ] `/listings/:id/edit` loads existing data correctly and preserves changes

## 7.5 Messaging, Favorites, Reviews, Disputes, Notifications

- [ ] `/messages` supports conversation search, open state, message sending, and attachment upload
- [ ] `/favorites` has a useful empty state and easy return to discovery
- [ ] `/notifications` supports filter, pagination, mark-as-read, delete, and deep-link behavior
- [ ] `/reviews` supports "received" and "given" views, rating filter, delete authored review, and trustworthy stats display
- [ ] `/disputes` supports status filter and pagination
- [ ] `/disputes/:id` shows evidence, updates, and next actions clearly
- [ ] `/disputes/new/:bookingId` enforces evidence size/type limits and amount rules

## 7.6 Settings, Organizations, Insurance

- [ ] `/settings` redirects to `/settings/profile`
- [ ] `/settings/profile` updates identity fields, avatar, password, and delete-account confirmation correctly
- [ ] `/settings/notifications` saves channel and notification-type preferences correctly
- [ ] `/settings/security` validates password change rules and gives clear success feedback
- [ ] `/settings/billing` shows balances, recent transactions, and links into deeper payment surfaces
- [ ] `/organizations` shows cards with organization status, members, listings, and clear create/manage paths
- [ ] `/organizations/create` validates organization fields and creates successfully
- [ ] `/organizations/:id/settings` saves organization changes and branding safely
- [ ] `/organizations/:id/members` supports invite, role update, and removal flows
- [ ] `/organizations/:id/listings` reflects org-owned inventory correctly
- [ ] `/insurance` explains coverage simply and shows real user policies when authenticated
- [ ] `/insurance/upload` validates listing selection and upload flow cleanly

## 7.7 Admin Pages

- [ ] `/admin` dashboard loads without missing data explosions
- [ ] `/admin/analytics` supports business, user, and performance analysis
- [ ] `/admin/entities/:entity` works for allowed entities and blocks unsupported ones clearly
- [ ] `/admin/disputes` supports triage and action flows
- [ ] `/admin/fraud` displays risk data clearly
- [ ] `/admin/system` and subroutes load correctly
- [ ] `/admin/system/general` changes are understandable before save
- [ ] `/admin/system/database` uses high-friction confirmations for risky actions
- [ ] `/admin/system/notifications` reflects delivery system configuration accurately
- [ ] `/admin/system/security` makes blast radius clear for each control
- [ ] `/admin/system/api-keys` supports creation and revocation safely
- [ ] `/admin/system/backups` surfaces backup freshness and action feedback
- [ ] `/admin/system/email` supports test-send flows
- [ ] `/admin/system/environment` masks secrets appropriately
- [ ] `/admin/system/logs` allows practical troubleshooting
- [ ] `/admin/system/audit` supports trust and accountability
- [ ] `/admin/system/power-operations` requires strong confirmation and clear consequence messaging

## 8. Component-by-Component QA Checklist

## 8.1 Layout and Navigation

- [ ] `AppNav` shows correct role-aware links, unread counts, and search behavior
- [ ] `AuthLayout` keeps auth pages focused and readable
- [ ] `DashboardLayout` and `DashboardSidebar` show active states and responsive structure correctly
- [ ] `MarketingLayout` preserves consistent header/footer behavior
- [ ] `MobileNavigation` supports role-aware navigation without crowded tap targets
- [ ] `PageContainer`, `PageHeader`, and `PortalPageLayout` preserve consistent spacing and hierarchy

## 8.2 Search and Discovery Components

- [ ] `InstantSearch` supports debounce, keyboard navigation, clear, submit, and result selection
- [ ] `LocationAutocomplete` handles typing, selection, and clearing cleanly
- [ ] `SearchFiltersSidebar` exposes and clears filters cleanly
- [ ] `SearchListingCard`, `SearchListingListItem`, and `SearchListingCompactCard` remain readable in each density
- [ ] `ListingCard` supports featured and generic discovery contexts without missing data failures

## 8.3 Map Components

- [ ] `BaseMap` loads safely and fails gracefully
- [ ] `ListingMarker` reflects active and highlighted states
- [ ] `ListingsMap` syncs to result set and click handling
- [ ] `MapSearchView` preserves list/map state and handles "search this area"
- [ ] `MapViewToggle` clearly indicates current mode
- [ ] `MarkerCluster` avoids unusable marker density

## 8.4 Booking and Listing Workflow Components

- [ ] `BookingCalendar` clearly communicates blocked dates, range selection, min/max constraints, and clear action
- [ ] `BookingProgress` communicates multi-step flow progress accessibly
- [ ] `CategorySpecificFields` only shows relevant fields and validates them
- [ ] `VoiceListingAssistant` is optional and does not block manual listing entry
- [ ] `DetailsStep`, `ImageUploadStep`, `ListingStepIndicator`, `LocationStep`, and `PricingStep` work together as a coherent wizard

## 8.5 Messaging, Favorites, and Feedback Components

- [ ] `FavoriteButton` gives instant, trustworthy state feedback
- [ ] `FavoritesList` handles empty, loading, and populated states well
- [ ] `SuccessCheckmark` and `SuccessCelebration` feel supportive without becoming distracting

## 8.6 Admin Components

- [ ] `ActivityFeed` displays understandable activity summaries
- [ ] `AdminErrorBoundary` prevents catastrophic blank-screen failures
- [ ] `AdminNavigation` does not advertise broken destinations
- [ ] `BulkActions` confirm destructive operations
- [ ] `EnhancedDataTable` supports sorting, pagination, filter chips, and dense data readability
- [ ] `EnhancedForm` is understandable for create, edit, and view modes
- [ ] `DataViews`, `ExportData`, `FilterChips`, `KeyboardShortcuts`, `ResponsiveLayout`, and `SmartSearch` behave predictably

## 8.7 Accessibility, Performance, Theme, and UI Primitives

- [ ] `FocusTrap`, `LiveRegion`, `SkipLink`, and `VisuallyHidden` support keyboard and screen-reader navigation
- [ ] `CodeSplitting`, `LazyImage`, `LazyRoute`, and `VirtualList` reduce load cost without breaking UX
- [ ] `FadeIn`, `SlideIn`, `StaggerChildren`, `ScaleOnHover`, `ModalAnimation`, `PageTransition`, and `MicroInteractions` honor reduced-motion preferences
- [ ] `ThemeToggle`, `LanguageSelector`, `LanguageSwitcher`, and `CurrencySelector` reflect current state accurately
- [ ] `EnhancedInput` preserves labels, validation, and focus states
- [ ] `ConfirmDialog`, `ListingGallery`, `OptimizedImage`, `StatusBadge`, `badge`, `card`, `data-table`, `dialog`, `empty-state`, `error-message`, `error-state`, `loading`, `offline-banner`, `pagination`, `route-skeletons`, `skeleton`, `toast`, `toast-manager`, and `unified-button` behave consistently

## 8.8 Mobile Shared Components

- [ ] `ConfirmDialog` is easy to dismiss or confirm on touch
- [ ] `ErrorBoundary` catches mobile runtime failures safely
- [ ] `FormContainer` and `FormInput` work with the mobile keyboard and validation states
- [ ] `ImagePicker` handles permissions and upload state clearly
- [ ] `ListingCard` remains readable at mobile densities
- [ ] `LoadingSkeleton` preserves structure during load
- [ ] `LocationInput` and `SearchBar` minimize typing friction
- [ ] `StaticInfoScreen` keeps informational content readable
- [ ] `Toast` is visible without blocking task completion

## 9. API and Backend Module Checklist

### 9.1 Auth and User Management

- [ ] Register, login, logout, refresh, and `me` endpoints work
- [ ] MFA enable, verify, and disable flows work
- [ ] OAuth and OTP flows behave correctly when configured
- [ ] Email and phone verification flows behave correctly
- [ ] Profile update, account deletion, owner upgrade, and export flows work
- [ ] KYC document upload and review paths work

### 9.2 Listings, Categories, and Availability

- [ ] Category list, category detail, template, and stats endpoints work
- [ ] Category-specific attributes can be created, updated, attached, and validated
- [ ] Listing create, read, update, delete, publish, pause, and activate actions work
- [ ] Listing content localization and version endpoints work when used
- [ ] Availability create, patch, get, available dates, and check endpoints work
- [ ] Featured and nearby listing endpoints work

### 9.3 Bookings and Payments

- [ ] Booking creation works from valid listing/date combinations
- [ ] `blocked-dates` returns usable calendar data
- [ ] Price calculation handles discounts, delivery, and quantity correctly
- [ ] Booking lifecycle transition endpoints enforce role and state constraints
- [ ] Payment intent creation, balance, transactions, earnings, payouts, deposits, and refunds work
- [ ] Stripe webhook handling is idempotent

### 9.4 Search, Geo, Messaging, Notifications

- [ ] Search query, autocomplete, suggestions, popular, similar, and nearby endpoints work
- [ ] Geo autocomplete and reverse endpoints work
- [ ] Conversation list, detail, send message, unread count, mark read, and delete flows work
- [ ] Notification list, unread count, mark read, mark all, delete, preferences, and device registration flows work

### 9.5 Reviews, Disputes, Insurance, Organizations, Admin

- [ ] Review create, get, patch, delete, listing reviews, user reviews, booking reviews, and can-review endpoints work
- [ ] Dispute create, get, response, close, escalate, evidence, and message flows work
- [ ] Insurance requirement, policy, claim, certificate, review, and payout flows work
- [ ] Organization CRUD, stats, members, invitations, and role updates work
- [ ] Admin dashboard, analytics, listing approvals, booking oversight, payment oversight, and system routes work

### 9.6 Advanced Marketplace and Ops Services

- [ ] Health and metrics endpoints work
- [ ] Storage upload, presigned URL, and delete flows work
- [ ] Marketplace availability, checkout, pricing, fraud, policy, compliance, observability, and payment-orchestration endpoints behave as expected when enabled

## 10. Accessibility, Responsive, and Cross-Device Checklist

- [ ] Keyboard-only users can navigate the main shell, forms, dialogs, filters, tables, and booking flow
- [ ] Focus order is logical after route changes and modal opens
- [ ] Screen-reader labels exist for buttons, toggles, and icon-only controls
- [ ] Contrast remains acceptable in both theme modes
- [ ] Touch targets are large enough on mobile
- [ ] Search, listing detail, checkout, and dashboard layouts hold up at 320px, 768px, 1024px, and wide desktop
- [ ] Map interactions remain usable on touch devices
- [ ] Sticky or fixed navigation does not cover primary actions on small screens

## 11. Performance and Reliability Checklist

- [ ] Home page loads without visible layout shift
- [ ] Search results load progressively with useful skeletons
- [ ] Listing gallery images do not collapse layout while loading
- [ ] Booking and checkout states remain responsive during API calls
- [ ] Message send and notification reads feel immediate
- [ ] Large admin tables remain usable with filters and pagination
- [ ] Error boundaries prevent full-page white screens where recovery is possible
- [ ] Offline or failed network states explain the problem and next step

## 12. Security and Abuse-Resistance Checklist

- [ ] Role guards block unauthorized route and action access
- [ ] Sensitive operations require auth and appropriate role
- [ ] CSRF-sensitive flows behave correctly
- [ ] Input validation rejects malformed data
- [ ] Upload limits and file type restrictions are enforced
- [ ] Payment and admin operations require clear confirmation
- [ ] Logs and environment views do not leak secrets
- [ ] Error messages do not expose sensitive internals

## 13. Current Automation Map

### 13.1 Web E2E Suites Present

- [ ] `home.spec.ts`
- [ ] `auth.spec.ts`
- [ ] `search-browse.spec.ts`
- [ ] `booking-and-favorites.spec.ts`
- [ ] `booking-by-category.spec.ts`
- [ ] `booking-lifecycle.spec.ts`
- [ ] `renter-booking-journey.spec.ts`
- [ ] `messages.spec.ts`
- [ ] `organizations.spec.ts`
- [ ] `owner-dashboard.spec.ts`
- [ ] `owner-listings.spec.ts`
- [ ] `payments-reviews-notifications.spec.ts`
- [ ] `settings.spec.ts`
- [ ] `admin-flows.spec.ts`
- [ ] `accessibility.spec.ts`
- [ ] `responsive-accessibility.spec.ts`
- [ ] `visual-regression.spec.ts`
- [ ] `portal-layout-consistency.spec.ts`

### 13.2 API E2E Suites Present

- [ ] `auth.e2e-spec.ts`
- [ ] `auth-security.e2e-spec.ts`
- [ ] `bookings.e2e-spec.ts`
- [ ] `concurrent-booking.e2e-spec.ts`
- [ ] `payment-flow.e2e-spec.ts`
- [ ] `payment-processing.e2e-spec.ts`
- [ ] `payout-flow.e2e-spec.ts`
- [ ] `refund-calculation.e2e-spec.ts`
- [ ] `webhook-idempotency.e2e-spec.ts`
- [ ] `listings.e2e-spec.ts`
- [ ] `listing-lifecycle.e2e-spec.ts`
- [ ] `search.e2e-spec.ts`
- [ ] `messaging.integration-spec.ts`
- [ ] `messaging-send.e2e-spec.ts`
- [ ] `notifications.e2e-spec.ts`
- [ ] `reviews.e2e-spec.ts`
- [ ] `disputes.e2e-spec.ts`
- [ ] `dispute-resolution.e2e-spec.ts`
- [ ] `insurance.e2e-spec.ts`
- [ ] `organizations.e2e-spec.ts`
- [ ] `renter-owner-dashboard.e2e-spec.ts`
- [ ] `security.e2e-spec.ts`

### 13.3 Recommended Automation Additions

- [ ] Regression test for desktop top-nav search query parameter consistency
- [ ] Regression test for every visible admin sidebar link
- [ ] Regression test for owner dashboard insurance alert rendering
- [ ] Stronger cross-device booking calendar interaction coverage
- [ ] More explicit low-cognitive-load assertions for listing detail and checkout layout

## 14. Defect Logging Format

For every failure capture:

- [ ] route or screen
- [ ] component if applicable
- [ ] user role
- [ ] exact data/setup used
- [ ] expected result
- [ ] actual result
- [ ] console/network errors
- [ ] screenshots or video if visual
- [ ] severity: blocker, high, medium, low

## 15. Final Sign-Off

- [ ] Discovery is trustworthy
- [ ] Booking is understandable
- [ ] Payments are safe and legible
- [ ] Communication flows are reliable
- [ ] Owner operations are efficient
- [ ] Admin operations are navigable and safe
- [ ] Mobile parity is sufficient for core customer journeys
- [ ] Accessibility and responsive behavior meet baseline quality
- [ ] Known regressions from this review are either fixed or explicitly accepted
