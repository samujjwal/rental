# Comprehensive Product, Feature, Flow, Page, and Component Documentation

## 1. Purpose and Scope

This document is the working product source of truth for the rental platform implemented in this repository. It is intentionally broader than API docs and broader than a UX audit: it connects the current codebase to the user journeys it supports, the pages and components that deliver those journeys, and the usability expectations the platform should meet.

Use this document when you need to:

- understand the actual implemented product surface across `apps/web`, `apps/mobile`, `apps/api`, and `packages/database`
- review the platform feature-by-feature and route-by-route
- judge whether each page and component is modern, simple, powerful, and low-friction
- plan E2E coverage, product QA, design reviews, or implementation audits

Primary code sources used for this document:

- `apps/web/app/routes.ts`
- `apps/web/app/routes/*`
- `apps/web/app/components/*`
- `apps/mobile/App.tsx`
- `apps/mobile/src/navigation/*`
- `apps/mobile/src/screens/*`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/*`
- `packages/database/prisma/schema.prisma`
- `apps/web/e2e/*`
- `apps/api/test/*`

## 2. Current System Snapshot

### 2.1 Platform Summary

The platform is a multi-category rental marketplace supporting discovery, listing creation, booking, checkout, messaging, reviews, disputes, insurance, notifications, organizations, owner operations, and admin management.

Primary user roles:

- guest: browse marketing content, search, view listings, begin auth
- renter: search, favorite, message, book, pay, review, dispute, manage profile
- owner: create listings, manage availability and earnings, review bookings, message renters, manage organizations and insurance
- admin: oversee platform health, moderation, disputes, analytics, system operations

### 2.2 Architecture Snapshot

| Layer | Current Surface | Notes |
| --- | --- | --- |
| Web | React Router v7 app with public pages, authenticated renter/owner flows, settings, organizations, insurance, and admin | Public browse happens on `/search`; owner listing management is on `/listings` |
| Mobile | Expo / React Native app with tab navigation, auth stack, booking detail/flow, owner screens, organizations, insurance, and static pages | Broad parity with core web journeys, not with admin |
| API | NestJS modular backend with auth, listings, bookings, payments, search, messaging, reviews, disputes, notifications, admin, insurance, orgs, analytics, and marketplace services | `AppModule` wires both core product modules and advanced marketplace modules |
| Database | Prisma schema with users, listings, bookings, payments, reviews, disputes, notifications, organizations, insurance, and supporting models | Search, pricing, trust, and audit concepts are modeled in DB and services |
| Tests | Web Playwright suite, API E2E suite, component tests, service tests, mobile tests | Coverage exists across major flows, but UX-level acceptance criteria still need stronger explicit mapping |

### 2.3 Core Product Areas

1. Marketing and discovery
2. Authentication and account recovery
3. Search, browse, and map exploration
4. Listing detail, availability, pricing, and booking intent capture
5. Booking lifecycle and renter-owner coordination
6. Checkout, payments, payouts, and earnings
7. Messaging, notifications, favorites, reviews, and disputes
8. Owner operations: listings, calendar, performance, insights
9. Organizations and insurance
10. Settings and profile management
11. Admin operations, analytics, fraud, system settings, and audit

## 3. Product Quality Standards

The platform should be evaluated against these standards on every page and component.

### 3.1 Modern

- visual hierarchy is clear within 3 seconds
- forms use inline validation and recoverable errors
- loading, empty, success, and error states feel intentional, not accidental
- desktop and mobile interactions feel purpose-built rather than simply resized

### 3.2 Simple

- each screen has one primary job and one dominant CTA
- non-essential options are progressively disclosed
- labels use plain language and domain terms only when needed
- users never need to remember hidden state across pages

### 3.3 Powerful

- expert workflows remain fast with shortcuts, filters, bulk actions, saved state, and responsive tables
- dense information is chunked into summaries, sections, cards, or tabs instead of long undifferentiated blocks
- the system explains status, availability, pricing, and next steps without forcing users to cross-reference elsewhere

### 3.4 Low Cognitive Load

- search filters are reversible and URL-backed
- booking decisions are supported by visible dates, pricing, delivery method, and trust signals
- urgent items appear before historical analytics
- destructive actions are visually separated and confirmed
- every important state change returns immediate feedback

## 4. Current Review Findings

These are current high-signal issues found during this repository review. They are important because they affect user flow integrity or trust in the interface.

### 4.1 Desktop global search drops the user query

- Source: `apps/web/app/components/layout/AppNav.tsx`
- Search nav submits `q`, but the search route loader reads `query`
- Impact: typing in the top navigation search can navigate to `/search` without applying the intended query
- Why it matters: the fastest discovery entry point becomes unreliable and increases cognitive load

### 4.2 Admin sidebar exposes broken or inaccessible destinations

- Source: `apps/web/app/components/admin/AdminNavigation.tsx`
- Source: `apps/web/app/routes/admin/entities/[entity].tsx`
- Source: `apps/web/app/routes.ts`
- The sidebar links to `/admin/listings` and multiple `/admin/entities/*` destinations that are either not route-registered or not allowed by the admin entity loader allowlist
- Impact: admins can click navigation items that redirect unexpectedly, 404, or bounce back to the admin dashboard
- Why it matters: admin confidence depends on predictable information architecture and trustworthy navigation

### 4.3 Owner dashboard insurance intelligence is reading the wrong response shape

- Source: `apps/web/app/routes/dashboard.owner.tsx`
- Source: `apps/web/app/lib/api/insurance.ts`
- The owner dashboard expects `rawPolicies.policies`, while the insurance API client returns `{ data, pagination }`
- Impact: active policy counts and expiring policy alerts can silently disappear even when policies exist
- Why it matters: owners need visible insurance and expiry context to operate safely and avoid compliance surprises

## 5. Role-Based Product Journeys

### 5.1 Guest Journey

1. Land on marketing page or home page
2. Search with keyword and location
3. Explore results in list or map mode
4. Open listing detail
5. Review calendar, price, delivery options, trust signals, and reviews
6. Attempt booking or message owner
7. Authenticate when the flow requires account context

### 5.2 Renter Journey

1. Sign up or log in
2. Search with filters, save favorites, and compare listings
3. Open listing detail and select dates
4. Check availability and review price breakdown
5. Create booking
6. Complete checkout when payment is required
7. Track booking state, message owner, receive notifications
8. Leave review or open dispute after completion or failure

### 5.3 Owner Journey

1. Upgrade or log in as owner
2. Create listing with category-specific fields, images, location, pricing, and availability
3. Publish listing and monitor approval/performance
4. Review bookings and message renters
5. Manage calendar, payouts, insights, and organizations
6. Upload insurance documentation and monitor policy status

### 5.4 Admin Journey

1. Enter admin dashboard
2. Review metrics, alerts, and audit activity
3. Manage entities, disputes, fraud, and system settings
4. Investigate operational issues
5. Perform controlled system or support actions with auditability

## 6. End-to-End Flow Inventory

### 6.1 Discovery to Booking

1. Home page hero and instant search
2. `/search` URL-backed results
3. Listing detail gallery, category facts, reviews, and booking panel
4. Booking calendar for date selection
5. Availability check and price calculation
6. Booking creation
7. Checkout for `PENDING_PAYMENT`
8. Booking detail lifecycle management

Expected UX quality:

- users can see available and unavailable dates directly in the booking panel
- blocked dates are visually distinct and non-interactive
- pricing updates after date selection without forcing a hidden secondary step
- owner contact and favorite actions are available without breaking booking context
- checkout clearly separates summary, secure payment, and exit path

### 6.2 Owner Listing Lifecycle

1. Owner dashboard
2. Listing creation wizard
3. Draft editing
4. Publish / pause / activate actions
5. Owner listings management on `/listings`
6. Calendar and availability management
7. Performance and insights review

Expected UX quality:

- creation flow is broken into obvious steps
- category-specific fields appear only when relevant
- image upload, pricing, and location are validated inline
- listing status badges and next actions are always visible

### 6.3 Trust and Resolution Flow

1. Favorites and compare behavior
2. Messaging from listing or booking context
3. Notifications and deep links
4. Reviews after completion
5. Dispute creation, evidence upload, and dispute detail
6. Insurance visibility for owners and renters

Expected UX quality:

- trust-building signals are adjacent to the decision point
- alerts deep-link to the correct screen
- disputes explain evidence expectations and next steps
- insurance is presented as protection and compliance support, not hidden legal copy

## 7. Web Route Inventory

## 7.1 Marketing, Public, and Auth Routes

| Route | Purpose | Primary Actions | UX / usability expectations |
| --- | --- | --- | --- |
| `/` | Home / hero landing page | Search, choose category, discover featured listings, route into owner flow | Search box must be above the fold, location is easy to set, featured listings are scannable, categories are understandable without jargon |
| `/about` | Brand and company story | Read positioning and trust copy | Clear value proposition, not a wall of text |
| `/careers` | Hiring page | Learn about roles, apply/contact | Short sections, visible CTA |
| `/press` | Press / brand surface | Read company updates and media info | Easy outbound navigation |
| `/how-it-works` | Marketplace explanation | Understand renter and owner mechanics | Must simplify the product model and reduce first-use anxiety |
| `/owner-guide` | Owner education | Learn listing, booking, payouts, and operations | Must answer "what happens next?" clearly |
| `/help` | Help center | Find support topics and support routes | Searchable or scannable categories, no dead-end FAQ layout |
| `/contact` | Support / contact page | Submit contact request, route to support/help | Clear response expectation and contact options |
| `/safety` | Safety information | Review trust and safety guidance | Practical safety actions, not only policy statements |
| `/terms` | Terms page | Read legal terms | Searchable headings and clean typography |
| `/privacy` | Privacy page | Read privacy commitments | Clear sections and readable hierarchy |
| `/cookies` | Cookie policy page | Review cookie information | Simple information architecture |
| `/auth/login` | Login page | Email/password login, MFA continuation, redirect restoration | Minimal fields, show/hide password, strong error feedback, preserve redirect target |
| `/auth/signup` | Sign-up page | Create account | Inline validation, low-friction progression, clear role-neutral copy |
| `/auth/logout` | Logout route | Destroy session and redirect | Should be fast and deterministic |
| `/auth/forgot-password` | Password reset request | Request reset email | Email feedback should be clear without account enumeration |
| `/auth/reset-password` | Reset password completion | Set new password | Token validity, password rules, success confirmation |

## 7.2 Discovery, Booking, and Shared Portal Routes

| Route | Purpose | Primary Actions | UX / usability expectations |
| --- | --- | --- | --- |
| `/search` | Public browse surface | Query, location, category, price, condition, instant booking, delivery, map/list toggle | URL state must be the single source of truth, filters reversible, map and list reflect same result set |
| `/listings/:id` | Listing detail and booking intent | View gallery, facts, reviews, calendar, price, favorite, share, message owner, book | Booking panel must make availability obvious; gallery, price, location, trust badges, and delivery options should be visible before commitment |
| `/bookings` | Booking list | Filter and open booking detail | Statuses must be legible and action-oriented |
| `/bookings/:id` | Booking detail and lifecycle actions | Approve, reject, cancel, start, request return, complete, review, dispute, pay | Timeline and current state should be obvious; only valid actions should be shown |
| `/checkout/:bookingId` | Payment completion | Review summary, enter payment details, cancel, confirm | Secure framing, sticky summary, single primary CTA, easy recovery path |
| `/messages` | Conversation list and thread | Search conversations, select thread, send message, upload attachment | Split-view on desktop, readable thread on mobile, booking/listing context visible |
| `/favorites` | Saved listing management | Open listing, remove favorite, browse similar items | Good empty state and batch mental model |
| `/notifications` | Notification center | Filter, mark read, delete, deep-link to destination | Unread state obvious, click target predictable, pagination stable |
| `/reviews` | Reviews received and given | Filter by rating, switch view, delete authored review | Rating summary must be trustworthy and the view switch should preserve context |
| `/disputes` | User dispute list | Filter, paginate, open dispute | Status and type should be immediately scannable |
| `/disputes/:id` | Dispute detail | Review evidence, messages, actions, resolution state | Evidence and next steps must be easy to understand |
| `/disputes/new/:bookingId` | Dispute creation | Select dispute type, provide title/description, upload evidence, request amount | Form should explain what good evidence looks like and cap uploads clearly |
| `/profile/:userId` | Public profile | Review user profile, listings, reviews | Trust signals should be readable without exposing clutter |
| `/payments` | Owner/admin payment history | Filter, paginate, export, inspect transaction trends | Finance screens must prioritize clarity, signed amounts, and status readability |
| `/earnings` | Owner earnings route | Inspect owner earnings and payout status | Payout readiness, pending balance, and next actions should be obvious |
| `/become-owner` | Owner conversion page | Learn owner benefits, start owner path | The CTA should be prominent and role transition clear |

## 7.3 Dashboard, Settings, Organizations, and Insurance Routes

| Route | Purpose | Primary Actions | UX / usability expectations |
| --- | --- | --- | --- |
| `/dashboard` | Role handoff route | Redirect to owner, renter, or admin area | Never strand the user on an ambiguous dashboard shell |
| `/dashboard/renter` | Renter dashboard | See urgent bookings, favorites, recommendations, unread counts | Urgent items should appear before history; recommendations should be relevant and lightweight |
| `/dashboard/owner` | Owner dashboard | Review stats, recent bookings, unread counts, expiring insurance, create listing | Metrics should lead to actions, not only display numbers |
| `/listings` | Owner listing management | Search owned listings, filter by status, publish, pause, activate, edit, delete | Status and next actions should be obvious, with safe destructive confirmations |
| `/listings/new` | Listing creation wizard | Create a new listing with guided steps | Step sequence should be easy to understand and never feel overwhelming |
| `/listings/:id/edit` | Listing editing flow | Update listing details, media, pricing, and availability inputs | Existing values should load reliably and unsaved-change risk should stay low |
| `/dashboard/owner/calendar` | Owner calendar view | Review availability and booking occupancy | Calendar must make gaps, conflicts, and availability windows obvious |
| `/dashboard/owner/earnings` | Owner payout and earnings view | Inspect balances, request payout | Financial confidence requires clear totals and settlement states |
| `/dashboard/owner/insights` | Owner insights view | Review recommendations, patterns, score-like summaries | Insight cards must be actionable, not decorative |
| `/dashboard/owner/performance` | Owner performance analytics | Track listing performance and operational KPIs | Trend visualization should explain what changed and what to do next |
| `/settings` | Settings index route | Redirect to profile | Should never be a dead end |
| `/settings/profile` | Profile settings | Update profile, upload avatar, change password, delete account | Strong separation between profile edits and destructive actions |
| `/settings/notifications` | Notification preferences | Toggle channels and notification types | Preferences should be easy to scan, grouped by channel and use case |
| `/settings/security` | Security settings | Change password | Security should be simple and confidence-building; MFA and device visibility are still important future additions |
| `/settings/billing` | Billing and payments settings | Review balance, recent transactions, link to payouts/payments | Balances, pending amounts, and next actions should be unambiguous |
| `/organizations` | Organization index | Create organization, open settings, members, listings | Organization cards should clearly communicate status, scale, and ownership |
| `/organizations/create` | Organization creation | Create organization | Business identity fields should be digestible and not overlong |
| `/organizations/:id/settings` | Organization settings | Update details and branding | Clear ownership permissions and safe save feedback |
| `/organizations/:id/members` | Member management | Invite members, update roles, remove members | Role changes and invitation states must be explicit |
| `/organizations/:id/listings` | Organization listing view | See org listings, route to create listing | Useful if an organization owns multiple inventory sources |
| `/insurance` | Insurance overview plus user policies | Review coverage information, open help/contact, view owned policies | Insurance copy must explain protection simply; policy list must display status, coverage, dates, and premium clearly |
| `/insurance/upload` | Owner insurance upload flow | Select listing, upload insurance docs, navigate back to listing management | Upload constraints and next status should be explicit |

## 7.4 Admin Routes

| Route | Purpose | Primary Actions | UX / usability expectations |
| --- | --- | --- | --- |
| `/admin` | Admin dashboard | Review KPIs, alerts, activity feed, quick actions | Operational center must surface risk, action, and system confidence first |
| `/admin/analytics` | Admin analytics | Inspect user, business, and performance analytics | Data should be segmented meaningfully, not dumped |
| `/admin/entities/:entity` | Generic entity admin | Browse and edit whitelisted entities | Tables, filters, bulk actions, and detail forms must stay predictable across entity types |
| `/admin/disputes` | Admin dispute management | Triage and update platform disputes | Queueing, severity, and action ownership should be obvious |
| `/admin/fraud` | Fraud monitoring | Review fraud signals and risk states | Needs clear signal severity and next actions |
| `/admin/system` | System index | Enter system settings area | Must summarize environment risk and key categories |
| `/admin/system/general` | Global settings | Manage general system settings | Changes should explain blast radius |
| `/admin/system/database` | Database operations | Review DB health/maintenance | Strong confirmations required |
| `/admin/system/notifications` | Notification system controls | Review notification config | Delivery channels and status should be observable |
| `/admin/system/security` | Security settings | Review security posture and configuration | High-stakes changes need clarity and audit visibility |
| `/admin/system/api-keys` | API key management | Create/revoke keys | Must show scope, created date, and revocation confirmation |
| `/admin/system/backups` | Backup operations | View or trigger backups | Backup freshness and restore confidence should be explicit |
| `/admin/system/email` | Email configuration and tests | Send test emails, inspect email config | Clear provider state and test feedback |
| `/admin/system/environment` | Environment view | Review environment/config values | Secret handling and masking must be safe |
| `/admin/system/logs` | Log inspection | Review recent system logs | Search and severity filtering expected |
| `/admin/system/audit` | Audit view | Inspect historical changes | Must support trust, filtering, and accountability |
| `/admin/system/power-operations` | High-risk operations | Trigger controlled operational tasks | Highest confirmation threshold in the app |

## 8. Mobile Screen Inventory

The mobile app mirrors the main customer and owner flows, with deep linking and stack-based drill-down for detail screens.

### 8.1 Auth and Entry Screens

- `LoginScreen`
- `SignupScreen`
- `ForgotPasswordScreen`
- `ResetPasswordScreen`

Expected quality:

- minimal friction
- large tap targets
- explicit validation and success states

### 8.2 Tab and Core Discovery Screens

- `HomeScreen`
- `SearchScreen`
- `BookingsScreen`
- `MessagesScreen`
- `ProfileScreen`

Expected quality:

- tab targets easy to reach with one hand
- search remains URL/deep-link equivalent through navigation state
- unread counts and urgent booking states are visible without hunting

### 8.3 Detail and Transactional Screens

- `ListingScreen`
- `BookingFlowScreen`
- `BookingDetailScreen`
- `CheckoutScreen`
- `MessageThreadScreen`
- `ReviewsScreen`
- `PaymentsScreen`
- `FavoritesScreen`
- `ProfileViewScreen`

Expected quality:

- sticky or persistent summary where needed
- booking and checkout fields never require hidden context
- thread and notification context remain obvious

### 8.4 Owner and Operations Screens

- `CreateListingScreen`
- `EditListingScreen`
- `OwnerDashboardScreen`
- `OwnerListingsScreen`
- `OwnerCalendarScreen`
- `OwnerEarningsScreen`
- `OwnerInsightsScreen`
- `OwnerPerformanceScreen`
- `BecomeOwnerScreen`
- `DashboardScreen`
- `RenterDashboardScreen`
- `EarningsScreen`

Expected quality:

- list management should favor quick scanning and fast editing
- owner actions should be clustered around the content they affect
- analytics must remain legible on narrow screens

### 8.5 Trust, Team, and Protection Screens

- `DisputesScreen`
- `DisputeCreateScreen`
- `DisputeDetailScreen`
- `OrganizationsScreen`
- `OrganizationCreateScreen`
- `OrganizationSettingsScreen`
- `OrganizationMembersScreen`
- `InsuranceScreen`
- `InsuranceUploadScreen`

Expected quality:

- legal and operational workflows should stay calm and structured
- uploads, evidence, and status indicators must be obvious on mobile

### 8.6 Static / Informational Screens

- `AboutScreen`
- `CareersScreen`
- `ContactScreen`
- `PressScreen`
- `HowItWorksScreen`
- `OwnerGuideScreen`
- `HelpScreen`
- `SafetyScreen`
- `TermsScreen`
- `PrivacyScreen`
- `CookiesScreen`

## 9. Component Inventory and UX Analysis

## 9.1 Layout and Navigation Components

| Components | Responsibility | UX expectations |
| --- | --- | --- |
| `AppNav` | Shared sticky top nav with auth-aware actions, counts, and search | Search must be reliable, unread counts accurate, menu states predictable |
| `AuthLayout` | Auth page shell | Keep focus on the form and supporting recovery actions |
| `DashboardLayout`, `DashboardSidebar`, `PortalPageLayout` | Portal scaffolding for renter and owner | Active state, section grouping, and mobile collapse must be consistent |
| `MarketingLayout` | Public marketing shell | Strong CTA visibility and consistent brand framing |
| `MobileNavigation` | Mobile-friendly nav surface | Thumb-friendly, not overloaded, and role-aware |
| `PageContainer`, `PageHeader` | Consistent page spacing and heading structure | Reduce visual noise and enforce hierarchy |

## 9.2 Discovery Components

| Components | Responsibility | UX expectations |
| --- | --- | --- |
| `InstantSearch` | Live query suggestions | Query should debounce, keyboard navigation should work, clear and submit affordances must be visible |
| `LocationAutocomplete` | Location lookup and selection | Selected location must be explicit and reversible |
| `SearchFiltersSidebar` | Filter management | Filters must be understandable, grouped, and easy to reset |
| `SearchListingCard`, `SearchListingListItem`, `SearchListingCompactCard` | Result cards in different densities | Price, rating, location, and CTA must stay scannable in every density |
| `ListingCard` | Reusable featured/listing card | Must work in browse, favorites, recommendations, and dashboard contexts |

## 9.3 Map Components

| Components | Responsibility | UX expectations |
| --- | --- | --- |
| `BaseMap` | Shared map foundation | Graceful fallback when map or tiles are unavailable |
| `ListingMarker` | Individual listing markers | Hover and selection state should be obvious |
| `ListingsMap` | Listing map visualization | Result set and map state must stay in sync |
| `MapSearchView` | Map/list container with "search this area" behavior | Search scope must be deterministic and visible |
| `MapViewToggle` | Toggle between map and list | Should preserve filters and not reset state |
| `MarkerCluster` | Marker density management | Avoid overwhelming the map at high result volume |

## 9.4 Booking and Listing Creation Components

| Components | Responsibility | UX expectations |
| --- | --- | --- |
| `BookingCalendar` | Booking date-range selection | Available dates, blocked dates, range preview, and clear selection should be immediately understandable |
| `BookingProgress` | Step/progress communication | Multi-step booking or transactional flows should always show current progress |
| `CategorySpecificFields` | Category-driven listing fields | Show only relevant inputs and explain unusual fields |
| `VoiceListingAssistant` | Assistive listing creation | Helpful but optional; should never block manual entry |
| `DetailsStep` | Listing details step | Clear hierarchy of title, description, and category-specific attributes |
| `ImageUploadStep` | Listing media step | Upload feedback, order, remove, and validation must be easy |
| `ListingStepIndicator` | Listing wizard step state | Steps should be visible and reversible |
| `LocationStep` | Listing location step | Map or address confidence should be obvious |
| `PricingStep` | Pricing step | Price, deposit, fees, and discounts should be easy to reason about |

## 9.5 Messaging, Favorites, Feedback, and Progress Components

| Components | Responsibility | UX expectations |
| --- | --- | --- |
| `FavoriteButton`, `FavoritesList` | Save and manage favorites | Optimistic updates with reliable recovery states |
| `SuccessCheckmark` | Success feedback | Positive feedback should be immediate and lightweight |
| `SuccessCelebration` | More celebratory transaction feedback | Respect reduced motion and avoid interrupting task completion |

## 9.6 Admin Components

| Components | Responsibility | UX expectations |
| --- | --- | --- |
| `ActivityFeed` | Admin recent activity and audit summaries | Must help triage, not just display noise |
| `AdminErrorBoundary` | Admin-safe failure rendering | Operational failures should degrade clearly and safely |
| `AdminNavigation` | Admin information architecture | Must never expose dead or misleading destinations |
| `BulkActions` | Mass operations | Strong confirmation and row selection clarity required |
| `DataViews` | Alternate admin data presentations | Table, detail, calendar, or kanban should remain consistent |
| `EnhancedDataTable` | Rich admin table surface | Filters, sorting, export, and pagination must be predictable |
| `EnhancedForm` | Rich admin edit/create forms | Sectioning and validation must reduce overwhelm |
| `ExportData` | Export actions | Export scope and format should be explicit |
| `FilterChips` | Active filter visibility | Active filters must be removable one by one |
| `KeyboardShortcuts` | Power-user admin interactions | Helpful and discoverable without becoming mandatory |
| `ResponsiveLayout` | Admin layout adaptation | Dense admin surfaces must still work on smaller screens |
| `SmartSearch` | Admin search | Search should be fast and precise for operational tasks |

## 9.7 Accessibility, Performance, Animation, Theme, and Form Components

| Components | Responsibility | UX expectations |
| --- | --- | --- |
| `FocusTrap`, `LiveRegion`, `SkipLink`, `VisuallyHidden` | Accessibility primitives | Keyboard-only and screen-reader flows must be first-class |
| `CodeSplitting`, `LazyImage`, `LazyRoute`, `VirtualList` | Performance support | Fast perceived loading and low layout shift |
| `FadeIn`, `SlideIn`, `StaggerChildren`, `ScaleOnHover`, `ModalAnimation`, `PageTransition`, `MicroInteractions` | Motion and transitions | Motion must support comprehension and honor reduced motion |
| `ThemeToggle` | Theme switching | Must be obvious, stable, and not break contrast |
| `LanguageSelector`, `LanguageSwitcher`, `CurrencySelector` | Locale control | Must clearly reflect current state and not surprise users |
| `EnhancedInput` | Reusable improved input | Clear labels, states, and validation behavior |
| `DevUserSwitcher`, `ProtectedRoute`, `ErrorBoundary`, `StaticPage` | Developer, auth, and fallback scaffolding | Safe in development and predictable in production |

## 9.8 Shared UI Primitives

| Components | Responsibility | UX expectations |
| --- | --- | --- |
| `ConfirmDialog` | Destructive-action confirmation | Clear consequence, clear cancel path |
| `ListingGallery` | Listing image presentation | Support quick trust formation and orientation |
| `OptimizedImage` | Image rendering | Good loading behavior and graceful failure |
| `StatusBadge`, `badge` | Status communication | Color and label must align with meaning |
| `card` | Content grouping | Maintain hierarchy and reduce clutter |
| `data-table` | Generic tabular UI | Sorting, empty state, row affordance |
| `dialog` | Overlay interaction | Focus management and escape behavior required |
| `empty-state` | Zero-data support | Always provide a next step |
| `error-message`, `error-state` | Failure communication | Human-readable and actionable |
| `loading`, `skeleton`, `route-skeletons` | Loading affordances | Preserve layout and user orientation |
| `offline-banner` | Connectivity feedback | Visible but not overwhelming |
| `pagination` | Page navigation | Stable, clear current page state |
| `toast`, `toast-manager` | Ephemeral feedback | Concise, non-blocking, and never the only source of truth |
| `unified-button`, `button-variants` | Primary and secondary actions | Consistent emphasis and disabled behavior |

## 9.9 Mobile Shared Components

| Components | Responsibility | UX expectations |
| --- | --- | --- |
| `ConfirmDialog` | Mobile confirmation flow | Tap-safe, clear consequence |
| `ErrorBoundary` | Failure containment | Prevent crash cascades |
| `FormContainer`, `FormInput` | Shared form layout and input behavior | Large tap targets, keyboard-safe spacing |
| `ImagePicker` | Media selection | Upload state and permissions clarity |
| `ListingCard` | Mobile listing card | Compact but decision-supporting |
| `LoadingSkeleton` | Mobile loading state | Preserve perceived speed |
| `LocationInput` | Mobile location capture | Predictable and low-friction |
| `SearchBar` | Mobile search entry | Fast entry and clear submit/clear behavior |
| `StaticInfoScreen` | Informational screen shell | Good readability on narrow screens |
| `Toast` | Mobile feedback messaging | Brief, non-obstructive, and accessible |

## 10. Backend Module Inventory

| Module family | What it powers |
| --- | --- |
| `auth` | registration, login, MFA, OAuth, OTP, verification, sessions |
| `users` and `kyc` | profile management, owner upgrades, exports, identity checks |
| `categories` | category taxonomy and category-specific listing attributes |
| `listings` | listing CRUD, availability, images, publish/pause/activate, versions, localized content |
| `bookings` | booking creation, blocked dates, availability, lifecycle transitions, invoices |
| `payments` and `tax` | payment intents, balance, transactions, payouts, deposits, refunds, tax utilities |
| `search` and `geo` | search results, autocomplete, nearby, suggestions, reverse geocoding |
| `messaging` | conversations, messages, unread counts, read receipts |
| `reviews` | review CRUD, listing/user review retrieval, can-review checks |
| `disputes` | dispute creation, responses, evidence, escalations, resolution |
| `notifications` | in-app notifications, unread counts, preferences, device registration, admin email/SMS utilities |
| `insurance` | listing insurance requirement, policy and claim operations |
| `organizations` | organization CRUD, members, roles, invites, stats |
| `analytics`, `fraud-detection`, `moderation`, `admin` | admin operations, analytics, moderation queues, risk and oversight |
| `marketplace`, `pricing`, `policy-engine`, `compliance`, `ai` | advanced marketplace intelligence and orchestration services |
| `health`, `metrics`, `storage`, `cache`, `queue`, `events`, `telemetry` | infrastructure and operability foundations |

## 11. Data Model Summary

Core domain entities in Prisma:

- `User`
- `Listing`
- `Category`
- `Organization`
- `Booking`
- `Payment` and transaction-related records
- `Review`
- `Dispute`
- `Notification`
- `Conversation` and `Message`
- `InsurancePolicy` and `InsuranceClaim`
- `Availability`, `PricingRule`, `ListingVersion`, `ListingContent`, and audit/supporting records

This matters for UX because the product is not a flat listing catalog. It supports:

- role-dependent actions
- lifecycle states
- trust signals
- compliance and insurance
- operational visibility
- advanced pricing and marketplace intelligence

## 12. Feature-Specific UX Acceptance Criteria

### 12.1 Search and Browse

- Search query, category, price, location, and map state must be visible and reversible
- Result cards must show enough context to compare without opening every listing
- Empty states should offer recovery: relax filters, clear location pin, or browse categories

### 12.2 Listing Detail and Booking

- The booking panel must make the next action obvious
- The calendar should clearly distinguish available, blocked, past, selected start, selected end, and selected range
- Availability and price calculation should feel automatic once dates are set
- Delivery or pickup choices should appear only when relevant

### 12.3 Checkout and Payments

- Summary and secure payment section must be visually separated
- The total should be trustworthy, with subtotal, fees, deposit, and final amount understandable
- Failures should preserve booking context and explain the next step

### 12.4 Messaging and Notifications

- Thread context should include who, what listing, and what booking when available
- Unread counts should remain accurate across nav, list views, and detail views
- Notification click targets must deep-link correctly and not dump users in generic dashboards

### 12.5 Dashboards

- Dashboards must answer "what needs attention now?" before "what happened historically?"
- Owners need booking actions, payout visibility, listing health, and insurance/compliance cues
- Renters need urgent payments, upcoming bookings, favorites, and recommendations

### 12.6 Settings

- Settings navigation should remain identical across subpages
- Profile, security, notification, and billing concerns should be cleanly separated
- Destructive actions must be isolated and confirmed

### 12.7 Admin

- Admin routing must be trustworthy
- Alerts must be actionable and severity-based
- Bulk actions need confirmation and clear post-action feedback
- System pages must explain operational risk before a user clicks a destructive control

## 13. Documentation Maintenance Notes

Keep this document aligned with:

- `apps/web/app/routes.ts` whenever routes are added, renamed, or removed
- `apps/mobile/App.tsx` and `apps/mobile/src/navigation/*` whenever mobile navigation changes
- `apps/api/src/app.module.ts` and controller inventory whenever modules or endpoint families are added
- component folders whenever new shared primitives or workflow components are introduced
- E2E and QA docs whenever a critical flow changes

When a new feature is introduced, update four things together:

1. route or screen inventory
2. end-to-end flow description
3. component catalog
4. UX acceptance criteria

That is the minimum needed to keep the product easy to review and easy to improve.
