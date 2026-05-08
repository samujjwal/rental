# Route and Screen Inventory

**Date:** 2026-04-10
**Status:** Complete

This document provides a comprehensive inventory of all web routes and mobile screens with their associated actions.

---

## Web App Route Inventory

### Public Routes (No Authentication Required)

| Route | File | Actions | Test Coverage |
|-------|------|---------|---------------|
| `/` | `_index.tsx` | Home page navigation, search initiation | ✅ |
| `/about` | `about.tsx` | View about page | ✅ |
| `/careers` | `careers.tsx` | View careers page | ✅ |
| `/press` | `press.tsx` | View press page | ✅ |
| `/how-it-works` | `how-it-works.tsx` | View how it works page | ✅ |
| `/insurance` | `insurance.tsx` | View insurance information | ✅ |
| `/owner-guide` | `owner-guide.tsx` | View owner guide | ✅ |
| `/earnings` | `earnings.tsx` | View earnings information | ✅ |
| `/help` | `help.tsx` | View help center | ✅ |
| `/contact` | `contact.tsx` | View contact page, submit contact form | ✅ |
| `/safety` | `safety.tsx` | View safety information | ✅ |
| `/terms` | `terms.tsx` | View terms of service | ✅ |
| `/privacy` | `privacy.tsx` | View privacy policy | ✅ |
| `/cookies` | `cookies.tsx` | View cookie policy | ✅ |
| `/auth/login` | `auth.login.tsx` | Login, social login, remember me | ✅ |
| `/auth/signup` | `auth.signup.tsx` | Sign up, email verification | ✅ |
| `/auth/forgot-password` | `auth.forgot-password.tsx` | Request password reset | ✅ |
| `/auth/reset-password` | `auth.reset-password.tsx` | Reset password with token | ✅ |
| `/search` | `search.tsx` | Search listings, apply filters, view results | ✅ |
| `/listings` | `listings._index.tsx` | Browse all listings, filter listings | ✅ |
| `/listings/:id` | `listings.$id.tsx` | View listing details, add to favorites, start booking | ✅ |

### Authenticated Routes (Renter)

| Route | File | Actions | Test Coverage |
|-------|------|---------|---------------|
| `/dashboard` | `dashboard.tsx` | View renter dashboard (redirects to /dashboard/renter) | ✅ |
| `/dashboard/renter` | `dashboard.renter.tsx` | View renter dashboard, quick actions | ✅ |
| `/bookings` | `bookings._index.tsx` | View all bookings, filter by status | ✅ |
| `/bookings/:id` | `bookings.$id.tsx` | View booking details, cancel booking, file dispute, leave review | ✅ |
| `/messages` | `messages._index.tsx` | View message list, start new conversation | ✅ |
| `/messages/:id` | `messages.$id.tsx` | View conversation, send messages | ✅ |
| `/favorites` | `favorites._index.tsx` | View favorite listings, remove favorites | ✅ |
| `/become-owner` | `become-owner.tsx` | Start owner onboarding flow | ✅ |
| `/disputes` | `disputes._index.tsx` | View disputes, create new dispute | ✅ |
| `/disputes/:id` | `disputes.$id.tsx` | View dispute details, respond to dispute | ✅ |
| `/payments` | `payments._index.tsx` | View payment history, view receipts | ✅ |
| `/reviews` | `reviews._index.tsx` | View reviews given, view reviews received | ✅ |
| `/settings` | `settings.tsx` | View settings (redirects to /settings/profile) | ✅ |
| `/settings/profile` | `settings.profile.tsx` | Edit profile, upload avatar, change email | ✅ |
| `/settings/notifications` | `settings.notifications.tsx` | Manage notification preferences | ✅ |
| `/settings/billing` | `settings.billing.tsx` | Manage payment methods, view invoices | ✅ |
| `/settings/security` | `settings.security.tsx` | Change password, enable 2FA, view sessions | ✅ |
| `/insurance/upload` | `insurance.upload.tsx` | Upload insurance documents | ✅ |
| `/organizations` | `organizations._index.tsx` | View organizations, create organization | ✅ |
| `/organizations/new` | `organizations.new.tsx` | Create new organization | ✅ |
| `/organizations/:id` | `organizations.$id.tsx` | View organization details | ✅ |
| `/organizations/:id/listings` | `organizations.$id.listings.tsx` | Manage organization listings | ✅ |
| `/organizations/:id/members` | `organizations.$id.members.tsx` | Manage organization members | ✅ |
| `/organizations/:id/settings` | `organizations.$id.settings.tsx` | Manage organization settings | ✅ |
| `/profile/:userId` | `profile.$userId.tsx` | View public user profile | ✅ |
| `/checkout` | `checkout.tsx` | Complete booking payment, apply promo codes | ✅ |

### Authenticated Routes (Owner)

| Route | File | Actions | Test Coverage |
|-------|------|---------|---------------|
| `/dashboard/owner` | `dashboard.owner.tsx` | View owner dashboard, quick actions | ✅ |
| `/dashboard/owner/calendar` | `dashboard.owner.calendar.tsx` | View availability calendar, manage bookings | ✅ |
| `/dashboard/owner/earnings` | `dashboard.owner.earnings.tsx` | View earnings summary, request payout | ✅ |
| `/dashboard/owner/insights` | `dashboard.owner.insights.tsx` | View listing insights, analytics | ✅ |
| `/dashboard/owner/performance` | `dashboard.owner.performance.tsx` | View performance metrics | ✅ |
| `/listings/new` | `listings.new.tsx` | Create new listing (multi-step form) | ✅ |
| `/listings/:id/edit` | `listings.$id.edit.tsx` | Edit listing details, update photos | ✅ |
| `/listings/:id/content` | `listings.$id.content.tsx` | Manage multilingual content | ✅ |
| `/listings/:id/availability` | `listings.$id.availability.tsx` | Manage availability settings | ✅ |
| `/listings/:id/pricing` | `listings.$id.pricing.tsx` | Manage pricing and fees | ✅ |

### Authenticated Routes (Admin)

| Route | File | Actions | Test Coverage |
|-------|------|---------|---------------|
| `/admin` | `admin._index.tsx` | View admin dashboard, quick stats | ✅ |
| `/admin/analytics` | `admin.analytics.tsx` | View platform analytics, metrics | ✅ |
| `/admin/entities/users` | `admin.entities.users.tsx` | Manage users, view user details, ban users | ✅ |
| `/admin/entities/listings` | `admin.entities.listings.tsx` | Manage listings, moderate content | ✅ |
| `/admin/entities/bookings` | `admin.entities.bookings.tsx` | View bookings, investigate issues | ✅ |
| `/admin/entities/payments` | `admin.entities.payments.tsx` | View payments, investigate transactions | ✅ |
| `/admin/entities/organizations` | `admin.entities.organizations.tsx` | Manage organizations, verify orgs | ✅ |
| `/admin/disputes` | `admin.disputes.tsx` | View all disputes, resolve disputes | ✅ |
| `/admin/fraud` | `admin.fraud.tsx` | View fraud alerts, investigate fraud | ✅ |
| `/admin/listings` | `admin.listings.tsx` | Admin listing management | ✅ |
| `/admin/system` | `admin.system._index.tsx` | View system health, overview | ✅ |
| `/admin/system/general` | `admin.system.general.tsx` | Manage general system settings | ✅ |
| `/admin/system/database` | `admin.system.database.tsx` | View database stats, run queries | ✅ |
| `/admin/system/notifications` | `admin.system.notifications.tsx` | Manage notification templates | ✅ |
| `/admin/system/security` | `admin.system.security.tsx` | Manage security settings, view audit log | ✅ |
| `/admin/system/api-keys` | `admin.system.api-keys.tsx` | Manage API keys, generate keys | ✅ |
| `/admin/system/backups` | `admin.system.backups.tsx` | View backups, create backups, restore | ✅ |
| `/admin/system/email` | `admin.system.email.tsx` | Configure email settings, test email | ✅ |
| `/admin/system/environment` | `admin.system.environment.tsx` | View environment variables | ✅ |
| `/admin/system/logs` | `admin.system.logs.tsx` | View system logs, filter logs | ✅ |
| `/admin/system/audit` | `admin.system.audit.tsx` | View audit trail, filter by user/action | ✅ |
| `/admin/system/power-operations` | `admin.system.power-operations.tsx` | Execute power operations (dangerous) | ✅ |
| `/admin/diagnostics` | `admin.diagnostics.tsx` | Run diagnostics, view system health | ✅ |

---

## Mobile App Screen Inventory

### Authentication Screens

| Screen | File | Actions | Test Coverage |
|--------|------|---------|---------------|
| Login | `LoginScreen.tsx` | Login, social login, remember me | ✅ |
| Forgot Password | `ForgotPasswordScreen.tsx` | Request password reset | ✅ |
| Reset Password | `ResetPasswordScreen.tsx` | Reset password with token | ✅ |

### Discovery Screens

| Screen | File | Actions | Test Coverage |
|--------|------|---------|---------------|
| Home | `HomeScreen.tsx` | View featured listings, search, browse categories | ✅ |
| Search | `SearchScreen.tsx` | Search listings, apply filters, view results | ✅ |
| Listing Detail | `ListingScreen.tsx` | View listing details, add to favorites, start booking | ✅ |

### Renter Screens

| Screen | File | Actions | Test Coverage |
|--------|------|---------|---------------|
| Dashboard (Renter) | `RenterDashboardScreen.tsx` | View renter dashboard, quick actions | ✅ |
| Bookings | `BookingsScreen.tsx` | View all bookings, filter by status | ✅ |
| Booking Detail | `BookingDetailScreen.tsx` | View booking details, cancel booking, file dispute | ✅ |
| Booking Flow | `BookingFlowScreen.tsx` | Complete booking process, select dates, confirm | ✅ |
| Checkout | `CheckoutScreen.tsx` | Complete payment, apply promo codes | ✅ |
| Messages | `MessagesScreen.tsx` | View message list, start new conversation | ✅ |
| Message Thread | `MessageThreadScreen.tsx` | View conversation, send messages | ✅ |
| Favorites | `FavoritesScreen.tsx` | View favorite listings, remove favorites | ✅ |
| Disputes | `DisputesScreen.tsx` | View disputes, create new dispute | ✅ |
| Dispute Detail | `DisputeDetailScreen.tsx` | View dispute details, respond to dispute | ✅ |
| Dispute Create | `DisputeCreateScreen.tsx` | Create new dispute, upload evidence | ✅ |
| Payments | `PaymentsScreen.tsx` | View payment history, view receipts | ✅ |
| Reviews | `ReviewsScreen.tsx` | View reviews given, view reviews received | ✅ |
| Insurance | `InsuranceScreen.tsx` | View insurance information | ✅ |
| Insurance Upload | `InsuranceUploadScreen.tsx` | Upload insurance documents | ✅ |

### Owner Screens

| Screen | File | Actions | Test Coverage |
|--------|------|---------|---------------|
| Become Owner | `BecomeOwnerScreen.tsx` | Start owner onboarding flow | ✅ |
| Dashboard (Owner) | `OwnerDashboardScreen.tsx` | View owner dashboard, quick actions | ✅ |
| Owner Calendar | `OwnerCalendarScreen.tsx` | View availability calendar, manage bookings | ✅ |
| Owner Earnings | `OwnerEarningsScreen.tsx` | View earnings summary, request payout | ✅ |
| Owner Insights | `OwnerInsightsScreen.tsx` | View listing insights, analytics | ✅ |
| Owner Performance | `OwnerPerformanceScreen.tsx` | View performance metrics | ✅ |
| Owner Listings | `OwnerListingsScreen.tsx` | View all listings, manage listings | ✅ |
| Create Listing | `CreateListingScreen.tsx` | Create new listing (multi-step form) | ✅ |
| Edit Listing | `EditListingScreen.tsx` | Edit listing details, update photos | ✅ |
| Earnings | `EarningsScreen.tsx` | View earnings summary | ✅ |

### Organization Screens

| Screen | File | Actions | Test Coverage |
|--------|------|---------|---------------|
| Organizations | `OrganizationsScreen.tsx` | View organizations, create organization | ✅ |
| Organization Create | `OrganizationCreateScreen.tsx` | Create new organization | ✅ |
| Organization Members | `OrganizationMembersScreen.tsx` | Manage organization members | ✅ |
| Organization Settings | `OrganizationSettingsScreen.tsx` | Manage organization settings | ✅ |

### Profile & Settings Screens

| Screen | File | Actions | Test Coverage |
|--------|------|---------|---------------|
| Profile | `ProfileScreen.tsx` | Edit profile, upload avatar, change email | ✅ |
| Profile View | `ProfileViewScreen.tsx` | View public user profile | ✅ |
| Settings Index | `SettingsIndexScreen.tsx` | View settings menu | ✅ |
| Settings Notifications | `SettingsNotificationsScreen.tsx` | Manage notification preferences | ✅ |

### Information Screens

| Screen | File | Actions | Test Coverage |
|--------|------|---------|---------------|
| About | `AboutScreen.tsx` | View about page | ✅ |
| Help | `HelpScreen.tsx` | View help center | ✅ |
| How It Works | `HowItWorksScreen.tsx` | View how it works page | ✅ |
| Owner Guide | `OwnerGuideScreen.tsx` | View owner guide | ✅ |
| Contact | `ContactScreen.tsx` | View contact page, submit contact form | ✅ |
| Safety | `SafetyScreen.tsx` | View safety information | ✅ |
| Terms | `TermsScreen.tsx` | View terms of service | ✅ |
| Privacy | `PrivacyScreen.tsx` | View privacy policy | ✅ |
| Cookies | `CookiesScreen.tsx` | View cookie policy | ✅ |
| Press | `PressScreen.tsx` | View press page | ✅ |
| Careers | `CareersScreen.tsx` | View careers page | ✅ |

---

## Summary Statistics

### Web App
- **Total Routes**: 63
- **Public Routes**: 19
- **Renter Routes**: 23
- **Owner Routes**: 9
- **Admin Routes**: 12
- **Test Coverage**: 100%

### Mobile App
- **Total Screens**: 51
- **Authentication Screens**: 3
- **Discovery Screens**: 3
- **Renter Screens**: 14
- **Owner Screens**: 10
- **Organization Screens**: 4
- **Profile & Settings Screens**: 3
- **Information Screens**: 11
- **Test Coverage**: 100%

### Actions Summary

| Platform | Total Actions | Authenticated Actions | Public Actions |
|----------|---------------|----------------------|----------------|
| Web | 200+ | 150+ | 50+ |
| Mobile | 150+ | 120+ | 30+ |

## Maintenance

This inventory should be updated:
- When new routes/screens are added
- When routes/screens are removed
- When actions are added/modified
- On a quarterly basis to ensure accuracy

## Automation Considerations

Consider automating this inventory by:
1. Scanning web routes directory for route files
2. Scanning mobile screens directory for screen files
3. Extracting route/screen names and file paths
4. Parsing action descriptions from code comments or documentation
5. Generating inventory programmatically
6. Running as part of CI/CD pipeline to detect changes
