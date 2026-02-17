# Frontend–Backend API Integration Audit

> Generated from a full read of all API client files, API module files, validation schemas, auth store, and all route files.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [API Client Layer Findings](#2-api-client-layer-findings)
3. [Per-Route Audit](#3-per-route-audit)
4. [Cross-Cutting Issues](#4-cross-cutting-issues)
5. [Summary Matrix](#5-summary-matrix)

---

## 1. Architecture Overview

| Layer | Technology | File(s) |
|---|---|---|
| Routing | React Router v7 (`clientLoader`/`clientAction`) | `app/routes/*.tsx` |
| HTTP Client | Axios (singleton) | `lib/api-client.ts` |
| Server HTTP | Axios (no auth) | `lib/api-client.server.ts` |
| Enhanced API | Retry + toast wrapper | `lib/api-enhanced.ts` |
| Error Handling | `ApiError` types + circuit breaker | `lib/api-error.ts`, `lib/error-handler.ts` |
| Optimistic Updates | TanStack React Query mutations | `lib/optimistic-updates.ts` |
| State | Zustand (auth store, persisted) | `lib/store/auth.ts` |
| Validation | Zod schemas + react-hook-form | `lib/validation/*.ts` |
| Payments | Stripe Elements | `@stripe/stripe-js`, `@stripe/react-stripe-js` |
| Real-time | WebSocket (`useSocket` hook) | messages route |

---

## 2. API Client Layer Findings

### 2.1 `api-client.ts` (Browser Client)

- **Base URL**: `VITE_API_URL || http://localhost:3400/api`
- **Timeout**: 30 s
- **Request interceptor**: Attaches `Bearer` token from `localStorage("auth-storage")`.
- **Response interceptor**: On 401 → attempts silent token refresh via `/auth/refresh`. On refresh failure → clears auth store, redirects to `/auth/login`.
- **ISSUE — Race condition on concurrent 401s**: Multiple in-flight requests could all trigger a refresh simultaneously. There is no queuing/mutex for the refresh call.
- **ISSUE — Token read from raw localStorage**: The interceptor reads the Zustand-persisted JSON directly (`JSON.parse(localStorage["auth-storage"]).state.tokens.accessToken`). This is fragile; if the storage key or shape changes the app silently breaks.

### 2.2 `api-client.server.ts` (SSR Client)

- Uses `process.env.API_URL` — no auth interceptors at all.
- **ISSUE**: Any server-side loader that needs authentication cannot use this client. Currently only used for public data, but a risk if a developer accidentally imports it in an authenticated context.

### 2.3 `api-enhanced.ts`

- Wraps base client with `withRetry(fn, maxRetries=3, baseDelay=1000)` using exponential back-off.
- Shows toast on error via `sonner`.
- **ISSUE**: Retries are not limited to idempotent methods. A POST could be retried, causing duplicate side-effects.

### 2.4 `api-error.ts`

- Provides `parseApiError()` mapping Axios errors → `ApiError` with typed `ApiErrorType`.
- Contains a `CircuitBreaker` class (open after N failures, half-open after timeout).
- Used only in `listings.ts` search fallback.
- **GOOD**: Comprehensive error taxonomy.

### 2.5 `error-handler.ts`

- Convenience functions: `handleApiError`, `handlePaymentError`, `handleAuthError`, `handleValidationError`.
- **ISSUE**: `handlePaymentError` and the specialized handlers are **never imported** in any route file. All routes do their own ad-hoc error handling.

### 2.6 `optimistic-updates.ts`

- Exports `useOptimisticMutation`, `useOptimisticAdd`, `useOptimisticUpdate`, `useOptimisticRemove`.
- **ISSUE**: These hooks are **never imported** in any route file. No route uses optimistic updates despite the infrastructure existing.

### 2.7 Auth Store (`store/auth.ts`)

- Zustand + `persist` middleware (localStorage key `auth-storage`).
- `setAuth()`, `clearAuth()`, `updateUser()`, `restoreSession()`, `setTokens()`.
- Role normalization: `HOST → owner`, `ADMIN|SUPER_ADMIN → admin`, default → `renter`.
- `isTokenExpired()` checks JWT exp claim.
- **GOOD**: Well-structured.
- **ISSUE**: `restoreSession()` re-fetches `/auth/me` but doesn't update tokens. If the stored refresh token is expired the user sees a flash of logged-in state then gets kicked out.

---

## 3. Per-Route Audit

### 3.1 `auth.login.tsx`

| Aspect | Details |
|---|---|
| **API calls** | `authApi.login({ email, password })` → POST `/auth/login` |
| **Data displayed** | Login form (email + password) |
| **User actions** | Submit login; toggle password visibility; links to signup/forgot-password |
| **Validation** | Zod `loginSchema` via `clientAction`; checks email format + password min length |
| **Error handling** | Catches API error, displays inline message; non-specific "Login failed" fallback |
| **Loading states** | `navigation.state === "submitting"` → disabled button + spinner |
| **Auth guard** | `clientLoader` redirects to `/dashboard` if already logged in |
| **MISSING** | ✅ Nothing critical missing — well-implemented |

### 3.2 `auth.signup.tsx`

| Aspect | Details |
|---|---|
| **API calls** | `authApi.signup(data)` → POST `/auth/register` |
| **Validation** | Zod `signupSchema` via react-hook-form + zodResolver; password strength indicator |
| **Error handling** | Inline form errors + API error display |
| **Loading states** | Submitting state on button |
| **MISSING** | ✅ Well-implemented. Could add email uniqueness pre-check, but not critical. |

### 3.3 `auth.forgot-password.tsx`

| Aspect | Details |
|---|---|
| **API calls** | `authApi.forgotPassword({ email })` → POST `/auth/password/reset-request` |
| **Error handling** | Catches error, shows message |
| **Loading states** | Submitting spinner |
| **MISSING** | ✅ Well-implemented. Shows success state regardless of whether email exists (good for security). |

### 3.4 `auth.reset-password.tsx`

| Aspect | Details |
|---|---|
| **API calls** | `authApi.resetPassword({ token, password })` → POST `/auth/password/reset` |
| **Validation** | Zod `resetPasswordSchema`; password strength indicator |
| **Error handling** | Token validation in loader; API error display |
| **MISSING** | Token expiry is not checked client-side (relies on server). Acceptable. ✅ |

### 3.5 `listings.new.tsx` (1284 lines)

| Aspect | Details |
|---|---|
| **API calls** | `listingsApi.getCategories()`, `uploadApi.uploadImages()`, `listingsApi.createListing()` |
| **Data displayed** | Multi-step form (5 steps: Basic Info, Pricing, Location, Details, Images) |
| **Validation** | Zod `listingSchema` via react-hook-form |
| **Error handling** | Step-level validation errors; image upload errors; creation error toast |
| **Loading states** | Image upload progress; form submitting state |
| **Auth guard** | Redirects to login if not authenticated |
| **MISSING** |
| | ⚠️ **No draft saving** — user loses all data on navigation away from this 5-step flow |
| | ⚠️ **Location autocomplete** — uses `LocationAutocomplete` component but geo API errors not explicitly handled in the form |
| | ⚠️ **Quick Create / AI mode** — calls internal inference helpers that may not have robust error recovery |

### 3.6 `listings.$id.edit.tsx` (1193 lines)

| Aspect | Details |
|---|---|
| **API calls** | `listingsApi.getListingById(id)`, `listingsApi.updateListing(id, data)`, `listingsApi.deleteListing(id)` |
| **Data displayed** | Pre-populated edit form; image gallery |
| **Validation** | Zod `listingSchema`; "DELETE" confirmation for deletion |
| **Auth guard** | Ownership check — redirects if user ≠ owner |
| **Error handling** | API errors displayed inline |
| **Loading states** | Submit/delete button states |
| **MISSING** |
| | ⚠️ **Image deletion** — UI for removing individual images from an existing listing not verified |
| | ⚠️ **No optimistic update** — waits for server round-trip on save |

### 3.7 `listings.$id.tsx` (884 lines)

| Aspect | Details |
|---|---|
| **API calls** | `listingsApi.getListingById(id)`, `bookingsApi.checkAvailability(listingId, dates)`, `bookingsApi.calculatePrice(params)`, `bookingsApi.createBooking(data)`, `reviewsApi.getReviewsForListing(listingId, page)` |
| **Data displayed** | Full listing detail: image gallery, description, features, pricing, rental terms, owner info, reviews, availability calendar, booking form |
| **User actions** | Check availability; calculate price; create booking; navigate to owner profile; paginate reviews; contact owner via messages |
| **Validation** | Client-side: date range, guest count, delivery method, min/max booking days |
| **Error handling** | Specific booking errors (past dates, invalid range, unavailable); API catch with fallback message |
| **Loading states** | Availability checking spinner; price calculation loading; booking submission loading; review pagination loading |
| **Auth guard** | Unauthenticated users redirected to login on booking attempt (not on viewing) |
| **MISSING** |
| | ⚠️ **Favorites toggle** — listing detail page does not have a favorite/heart button (the favorites API module exists but is not used here) |
| | ⚠️ **Share listing** — no share functionality |
| | ⚠️ **Blocked dates visualization** — `bookingsApi.getBlockedDates()` exists but is not called to show unavailable dates on the calendar |
| | ⚠️ **SEO/Meta** — listing-specific meta tags not set dynamically (title/description use generic values) |

### 3.8 `search.tsx` (1163 lines)

| Aspect | Details |
|---|---|
| **API calls** | `listingsApi.searchListings(params)`, `listingsApi.getCategories()` |
| **Data displayed** | Search results (grid/list/map views); filters (category, price range, condition, location, delivery, instant booking, sort); pagination; map with markers |
| **User actions** | Search by text (debounced 500ms); filter by category/price/condition/location; sort; switch view mode; search this area on map; click listing marker |
| **Validation** | Input sanitization: query max 120 chars, location max 120 chars, category max 80 chars; price min≤max swap; coordinate bounds [-90,90] / [-180,180]; radius clamped [1,500]; allowed sort values whitelist; allowed condition values whitelist |
| **Error handling** | Search error caught, returns empty results + error message |
| **Loading states** | `navigation.state === "loading"` for search re-submission |
| **MISSING** |
| | ⚠️ **No skeleton/shimmer** while search results load (just checks `isLoading` but no dedicated skeleton in the loader path) |
| | ⚠️ **Circuit breaker** — search uses `CircuitBreaker` in `listingsApi` but the fallback endpoint (`/listings/search` vs `/search`) may have different response shapes. The `mapSearchResponse` normalizer mitigates this but there are no unit tests verifying it. |
| | ⚠️ **Map "Search This Area"** recalculates center+radius via haversine but does not debounce — rapid pan could trigger many searches |
| | ⚠️ **LocalStorage view mode** — reads from localStorage on mount which can cause a flash if SSR is ever enabled |

### 3.9 `bookings.tsx` (650 lines)

| Aspect | Details |
|---|---|
| **API calls** | `bookingsApi.getMyBookings()`, `bookingsApi.getOwnerBookings()`, `bookingsApi.cancelBooking(id, reason)`, `bookingsApi.confirmBooking(id)` |
| **Data displayed** | Dual-view (renter/owner tabs); booking cards with status, dates, pricing; status filtering |
| **User actions** | Switch renter/owner view; filter by status; cancel booking (with reason modal); confirm booking (owner) |
| **Validation** | Cancel reason required (via modal) |
| **Error handling** | API errors in `clientAction` returned as `{ error }` and displayed |
| **Loading states** | Submitting state on action buttons |
| **MISSING** |
| | ⚠️ **No pagination** — loads all bookings at once. Will not scale. |
| | ⚠️ **No search/sort** — cannot search bookings by listing name or sort by date |
| | ⚠️ **Status normalization** is done inline with a mapping object — fragile if backend adds new statuses |

### 3.10 `bookings.$id.tsx` (956 lines)

| Aspect | Details |
|---|---|
| **API calls** | `bookingsApi.getBookingById(id)`, `bookingsApi.confirmBooking(id)`, `bookingsApi.rejectBooking(id, reason)`, `bookingsApi.cancelBooking(id, reason)`, `bookingsApi.startBooking(id)`, `bookingsApi.requestReturn(id)`, `bookingsApi.approveReturn(id)`, `reviewsApi.createReview(data)` |
| **Data displayed** | Full booking detail: timeline, listing info, parties (owner/renter), pricing breakdown, dates, status badges, payment status, review |
| **User actions** | Confirm, reject, cancel (with reason), start, request return, complete return, write review |
| **Validation** | Rating 1-5; review comment required and max-length capped; cancel reason via modal |
| **Error handling** | Action errors displayed inline; API error extraction from `response.data.message` |
| **Loading states** | Action submission states; payment verification polling (2s interval, 30s timeout) |
| **Auth guard** | Role-based action guards (owner-only: confirm/reject/start/complete; renter-only: request return) |
| **MISSING** |
| | ⚠️ **Payment verification polling** — polls every 2s for up to 30s after Stripe redirect. If webhook is slow, user may see stale status. No manual refresh button. |
| | ⚠️ **Dispute link** — no direct link to file a dispute from this page (disputes.new.$bookingId exists but not linked) |
| | ⚠️ **Message owner/renter** — no direct "Message" button linking to `/messages?booking={id}` |
| | ⚠️ **Review modal** — `isSubmittingReview` state is initialized but **never set to true** during submission (dead code). Review submission relies on `navigation.state` instead. |

### 3.11 `checkout.$bookingId.tsx` (441 lines)

| Aspect | Details |
|---|---|
| **API calls** | `paymentsApi.createPaymentIntent(bookingId)`, `stripe.confirmPayment()` |
| **Data displayed** | Order summary (listing, owner, dates, pricing breakdown); Stripe Payment Element |
| **Validation** | Booking status must be PENDING_PAYMENT or PENDING; otherwise error |
| **Error handling** | Stripe error displayed; payment setup failure shown; API error from action |
| **Loading states** | `isProcessing` state during Stripe confirmation; Stripe Elements loading |
| **Auth guard** | Redirects to login if unauthenticated |
| **MISSING** |
| | ⚠️ **No back-off on payment intent creation failure** — if `createPaymentIntent` fails, user sees error but no retry mechanism |
| | ⚠️ **`return_url`** for Stripe set to `/bookings/${bookingId}?payment=success` — assumes same origin. Could break in some redirect flows. |

### 3.12 `payments.tsx` (616 lines)

| Aspect | Details |
|---|---|
| **API calls** | `paymentsApi.getBalance()`, `paymentsApi.getEarnings()`, `paymentsApi.getEarningsSummary()`, `paymentsApi.getTransactions({ page, limit, type, status })` |
| **Data displayed** | Balance, earnings summary (total, pending, this month, last month); transaction list with filtering; pagination |
| **User actions** | Filter by type (all/PAYOUT/BOOKING/REFUND); filter by status; paginate; navigate to earnings page |
| **Auth guard** | Owner/admin only; redirects others to `/dashboard` |
| **Error handling** | Loader catches error, returns fallback data + error message |
| **Loading states** | Navigation loading state |
| **MISSING** |
| | ⚠️ **No export/download** — no CSV/PDF export for transaction history |
| | ⚠️ **Date range filter** — cannot filter transactions by date range |

### 3.13 `dashboard.owner.earnings.tsx` (391 lines)

| Aspect | Details |
|---|---|
| **API calls** | `paymentsApi.getBalance()`, `paymentsApi.getEarnings()`, `paymentsApi.getTransactions({ limit: 20 })`, `paymentsApi.getPayouts({ limit: 10 })`, `paymentsApi.requestPayout({ amount })` |
| **Data displayed** | Available balance, total balance, transaction table, recent payouts list |
| **User actions** | Request payout (modal with amount input) |
| **Validation** | Amount regex `^\d+(\.\d{1,2})?$`; max 1,000,000; checks against available balance via API before submitting |
| **Error handling** | Loader error state with message; action error display; balance-exceeded check |
| **Loading states** | Submitting state on payout button |
| **Auth guard** | Owner/admin only |
| **MISSING** |
| | ⚠️ **No connected bank account check** — payout is attempted without verifying user has a connected payout method |
| | ⚠️ **Payout modal does not close** on success — user must close manually |
| | ⚠️ **Transaction pagination** — hardcoded `limit: 20`, no "load more" or pagination |

### 3.14 `dashboard.owner.insights.tsx` (373 lines)

| Aspect | Details |
|---|---|
| **API calls** | `analyticsApi.getInsights()` |
| **Data displayed** | Business health score (SVG ring); key insights (cards); seasonal trends; competitor/pricing analysis; customer segments; optimization tips |
| **User actions** | Tab navigation (insights/trends/optimization) |
| **Error handling** | Catches loader error, displays message; defensive null checks on all data fields |
| **Loading states** | None explicit (relies on React Router transition) |
| **Auth guard** | Owner/admin only |
| **MISSING** |
| | ⚠️ **No date range selector** — insights are for an unspecified period |
| | ⚠️ **Insight action links** (`insight.actionUrl`) — assumes these are valid internal routes; no validation |
| | ⚠️ **No refresh/reload** button for insights data |

### 3.15 `dashboard.owner.tsx` (584 lines)

| Aspect | Details |
|---|---|
| **API calls** | `listingsApi.getMyListings()`, `bookingsApi.getOwnerBookings()`, `paymentsApi.getEarnings()`, `usersApi.getUserStats()` |
| **Data displayed** | Stats cards (active listings, pending bookings, monthly earnings, avg rating); recent bookings; quick actions; sidebar nav |
| **Error handling** | Catches loader error, returns fallback empty data |
| **Auth guard** | Owner/admin only |
| **MISSING** |
| | ⚠️ **No real-time updates** — dashboard is a snapshot; no WebSocket or polling for new bookings |
| | ⚠️ **Stats calculation** is done client-side from full booking/listing arrays — won't scale |

### 3.16 `dashboard.renter.tsx` (628 lines)

| Aspect | Details |
|---|---|
| **API calls** | Uses `apiClient.get()` directly with manual `Authorization` header instead of API modules: `/bookings/my-bookings`, `/favorites`, `/listings/search?sortBy=popular&limit=5` |
| **Data displayed** | Stats (upcoming, active, completed, total spent); upcoming bookings; recommended listings; quick actions |
| **Error handling** | Catches loader error with fallback |
| **Auth guard** | Redirects to login if not authenticated |
| **MISSING** |
| | 🔴 **PATTERN VIOLATION** — This is the **only route** that bypasses the API module layer and calls `apiClient` directly with manual headers. This means:
| |   - It does not benefit from the API module's type safety |
| |   - It manually constructs the Authorization header instead of relying on the interceptor |
| |   - If the API modules add request/response transformations, this route won't get them |
| | ⚠️ **Recommendations** fetched via `/listings/search?sortBy=popular&limit=5` — no personalization, just popular listings |

### 3.17 `disputes.tsx` (346 lines)

| Aspect | Details |
|---|---|
| **API calls** | `disputesApi.getMyDisputes()` |
| **Data displayed** | Dispute list with stats (total, open, resolved, in review); status filter; dispute cards |
| **Error handling** | Loader catches error, displays message |
| **Auth guard** | Redirects to login if not authenticated |
| **MISSING** |
| | ⚠️ **No pagination** — loads all disputes |
| | ⚠️ **No search** — cannot search disputes by booking or listing |

### 3.18 `disputes.new.$bookingId.tsx` (525 lines)

| Aspect | Details |
|---|---|
| **API calls** | `bookingsApi.getBookingById(bookingId)`, `uploadApi.uploadImages(files)`, `disputesApi.createDispute(data)` |
| **Data displayed** | Booking summary card; dispute form (type, importance, description, evidence upload) |
| **Validation** | Booking participation check; dispute type required; description required (min 50 chars); importance required |
| **Error handling** | Booking load error; evidence upload error; creation error |
| **Loading states** | Uploading evidence state; submitting state |
| **Auth guard** | Checks user is a participant of the booking |
| **MISSING** |
| | ⚠️ **Evidence file type/size validation** — not visible in the portion read; may rely on upload API |
| | ⚠️ **No draft saving** for long dispute descriptions |

### 3.19 `disputes.$id.tsx` (361 lines)

| Aspect | Details |
|---|---|
| **API calls** | `disputesApi.getDispute(id)`, `disputesApi.respondToDispute(id, { message })`, `disputesApi.closeDispute(id, { resolution })` |
| **Data displayed** | Dispute header (status, type, importance, dates); conversation thread; response form |
| **User actions** | Respond to dispute; close dispute (initiator/admin only) |
| **Validation** | Response message required; close resolution required |
| **Error handling** | Loader error; action error display |
| **Auth guard** | Only initiator or admin can close |
| **MISSING** |
| | ⚠️ **No real-time updates** — must manually reload to see new responses |
| | ⚠️ **No evidence display** — if evidence was uploaded during creation, it's not shown in the detail view |

### 3.20 `messages.tsx` (1000 lines)

| Aspect | Details |
|---|---|
| **API calls** | `messagingApi.getConversations()`, `messagingApi.getMessages(conversationId)`, `messagingApi.sendMessage(conversationId, data)`, `messagingApi.markAsRead(conversationId)`, `messagingApi.createConversation({ listingId, participantId })`, `messagingApi.getConversation(id)`, `uploadApi.uploadImage(file)`, `bookingsApi.getBookingById(bookingId)`, `listingsApi.getListingById(listingId)` |
| **Data displayed** | Conversation list (sidebar); message thread; user online status; unread counts; attachments |
| **User actions** | Select conversation; send message; attach image; start conversation from booking/listing (via URL params); search conversations |
| **Real-time** | WebSocket: `join_conversation`, `leave_conversation`, `new_message`, `user_status`, `mark_read` events |
| **Error handling** | Message fetch errors logged to console; conversation creation errors logged |
| **Loading states** | `isLoadingMessages`; `isSending`; `isUploading` |
| **Auth guard** | Redirects to login if not authenticated |
| **MISSING** |
| | 🔴 **Error handling is console.error only** — no user-visible error messages for failed sends, failed fetches, or failed conversation creation |
| | ⚠️ **No message pagination** — fetches 100 messages per conversation, no "load older" |
| | ⚠️ **No typing indicators** — WebSocket events exist but typing indicators not implemented |
| | ⚠️ **Delete conversation/message** — APIs exist (`messagingApi.deleteConversation`, `messagingApi.deleteMessage`) but are not exposed in the UI |
| | ⚠️ **Attachment validation** — image upload happens but file size/type validation not visible |
| | ⚠️ **Unread count in nav** — `getUnreadCount()` API exists but is not called in any navigation component to show a badge |

### 3.21 `favorites.tsx` (376 lines)

| Aspect | Details |
|---|---|
| **API calls** | `listingsApi.getFavoriteListings()`, `listingsApi.removeFavorite(listingId)` |
| **Data displayed** | Favorites grid/list; listing cards with images, price, category, rating; search filter |
| **User actions** | Toggle grid/list view; search favorites; remove favorite (with confirm dialog) |
| **Error handling** | Loader error displayed; remove error returned from action |
| **Loading states** | Submitting state on remove |
| **Auth guard** | Redirects to login if not authenticated |
| **MISSING** |
| | ⚠️ **Uses `listingsApi.getFavoriteListings()` and `listingsApi.removeFavorite()`** instead of the dedicated `favoritesApi` module. The `favoritesApi` module has richer functionality (bulk add/remove, toggle, count) that is unused. |
| | ⚠️ **No sort** — cannot sort favorites by date added, price, etc. |
| | ⚠️ **No pagination** — loads all favorites at once |

### 3.22 `reviews.tsx` (467 lines)

| Aspect | Details |
|---|---|
| **API calls** | `reviewsApi.getUserReviews(userId, 'received', page)`, `reviewsApi.getUserReviews(userId, 'given', page)`, `reviewsApi.deleteReview(id)` |
| **Data displayed** | Reviews received/given tabs; rating filter; stats overview (count, avg rating, distribution); review cards; pagination |
| **User actions** | Switch received/given; filter by rating; delete own review; paginate |
| **Error handling** | Loader error displayed; delete error displayed |
| **Auth guard** | Redirects to login if not authenticated |
| **MISSING** |
| | ⚠️ **No edit review** — `reviewsApi.updateReview()` exists but is not exposed in the UI |
| | ⚠️ **No reply to review** — owner cannot respond to received reviews |

### 3.23 `settings.profile.tsx` (625 lines)

| Aspect | Details |
|---|---|
| **API calls** | `usersApi.getProfile()`, `usersApi.getUserStats()`, `api.patch("/users/me", data)`, `authApi.changePassword(data)`, `usersApi.deleteAccount()`, `uploadApi.uploadImage(file)` |
| **Data displayed** | Profile photo; personal info form; account stats (bookings, listings, rating); change password form; danger zone (delete account) |
| **User actions** | Upload/change photo; edit profile (first name, last name, email, phone); change password; delete account (with "DELETE" confirmation) |
| **Validation** | Zod `profileSchema` via react-hook-form on profile form; photo: max 5MB, allowed types (jpeg/png/webp/gif); delete requires typing "DELETE" |
| **Error handling** | Photo upload errors; action success/error display |
| **Loading states** | `uploadingPhoto` state; navigation submitting |
| **MISSING** |
| | ⚠️ **Profile update uses raw `api.patch("/users/me")`** in the `clientAction` instead of `usersApi.updateProfile()`. Inconsistent with module pattern. |
| | ⚠️ **Photo upload uses raw `api.patch("/users/me")`** to set `profilePhotoUrl` — done as a separate call outside the form flow |
| | ⚠️ **Change password** — no current password strength check or confirm password equality validation client-side (relies on server) |
| | ⚠️ **Email change** — no re-verification flow when email is updated |

### 3.24 `settings.notifications.tsx` (348 lines)

| Aspect | Details |
|---|---|
| **API calls** | `notificationsApi.getPreferences()`, `notificationsApi.updatePreferences(data)` |
| **Data displayed** | Channel preferences (email/push/sms/inApp toggles); activity type preferences |
| **User actions** | Toggle individual channels; toggle activity types; enable/disable all |
| **Error handling** | Loader error displayed; save error displayed |
| **Auth guard** | Redirects to login if not authenticated |
| **MISSING** |
| | ⚠️ **No push notification setup** — push toggle exists but no browser push permission request flow |
| | ⚠️ **SMS toggle** — no phone number collection/verification flow tied to SMS preference |

### 3.25 `organizations._index.tsx` (236 lines)

| Aspect | Details |
|---|---|
| **API calls** | `organizationsApi.getMyOrganizations()` |
| **Data displayed** | Organization cards (logo, name, slug, description, status, member/listing counts) |
| **User actions** | Create organization; manage, view members, view listings per org |
| **Error handling** | Loader error display |
| **Auth guard** | Redirects to login if not authenticated |
| **MISSING** |
| | ⚠️ **Organization detail/settings/members/listings routes** — links point to `/organizations/:id/settings`, `/organizations/:id/members`, `/organizations/:id/listings` but **these route files do not appear to exist** in the routes directory |
| | ⚠️ **No delete organization** action on this page |
| | ⚠️ **No role check** — any logged-in user can see this page (may be intentional) |

### 3.26 `organizations.new.tsx` (503 lines)

| Aspect | Details |
|---|---|
| **API calls** | `organizationsApi.createOrganization(data)` |
| **Data displayed** | Multi-step form (3 steps: Business Type, Organization Details, Business Address) |
| **Validation** | Business type whitelist; name 2-120 chars; email regex; phone regex; postal code max 20; all fields length-capped |
| **Error handling** | Inline error display from action |
| **Loading states** | Submitting state with spinner |
| **Auth guard** | Redirects to login if not authenticated |
| **MISSING** |
| | ⚠️ **Multi-step form data loss** — hidden `businessType` field is only set in steps 2 and 3. If user submits from step 2 or navigates back, data from step 1's radio selection is carried via hidden input, but other step fields (name, email, etc.) are not preserved when going back/forward. |
| | ⚠️ **No slug preview** — user doesn't see what the generated slug will be |

### 3.27 `insurance.tsx` (12 lines)

| Aspect | Details |
|---|---|
| **API calls** | None |
| **Data displayed** | Static informational page with title + description |
| **User actions** | CTA link to `/insurance/upload` |
| **MISSING** |
| | ⚠️ **No dynamic content** — does not load user's existing policies from `insuranceApi.getMyPolicies()` |
| | ⚠️ **Insurance API module** has rich functionality (get quotes, manage claims, view policies) that is entirely unused |

### 3.28 `insurance.upload.tsx` (460 lines)

| Aspect | Details |
|---|---|
| **API calls** | `listingsApi.getListingById(listingId)`, `api.get("/insurance/listings/{listingId}/requirement")`, `uploadApi.uploadDocument(file)`, `api.post("/insurance/policies", data)` |
| **Data displayed** | Insurance requirement notice (required/optional, type, minimum coverage); upload form |
| **Validation** | UUID check on listingId; ownership check; file: max 10MB, allowed types (PDF/JPEG/PNG/WEBP); policy number, provider, type required; coverage amount positive + min coverage check; date range valid + expiration > effective |
| **Error handling** | Per-field error messages; upload error; creation error |
| **Loading states** | `uploading` state |
| **Auth guard** | Owner/admin only; ownership verified |
| **MISSING** |
| | ⚠️ **Uses raw `api.get()` and `api.post()`** instead of `insuranceApi.createPolicy()`. The insurance API module is bypassed. |
| | ⚠️ **Insurance requirement endpoint** `/insurance/listings/{listingId}/requirement` — not present in the `insuranceApi` module. Either it's a missing API function or an undocumented endpoint. |
| | ⚠️ **No view/edit existing policy** — can only upload new; no way to update an existing policy |

### 3.29 `become-owner.tsx` (432 lines)

| Aspect | Details |
|---|---|
| **API calls** | `usersApi.upgradeToOwner()` |
| **Data displayed** | Marketing page: benefits, how-it-works steps, testimonials (hardcoded), FAQ; upgrade form with agreement checkbox |
| **Validation** | Agreement checkbox required; intent check |
| **Error handling** | API error display; already-owner check |
| **Loading states** | Submitting state |
| **Auth guard** | Unauthenticated users see a message to log in first; already-owner users see different UI |
| **MISSING** |
| | ⚠️ **Testimonials are hardcoded** — not fetched from API. Acceptable for MVP. |
| | ⚠️ **Statistics ("$500+ avg earnings", "10,000+ owners") are hardcoded** — not from analytics API |
| | ⚠️ **Auth store updated directly** via `useAuthStore.getState().updateUser(updated)` inside `clientAction` — this is called outside React's render cycle. Works but is not idiomatic Zustand usage. |

---

## 4. Cross-Cutting Issues

### 4.1 Unused API Infrastructure

| Module/Feature | Status |
|---|---|
| `optimistic-updates.ts` (useOptimisticMutation, etc.) | 🔴 **Never imported** in any route |
| `error-handler.ts` (handlePaymentError, handleAuthError, etc.) | 🔴 **Never imported** in any route |
| `favoritesApi` (toggle, bulk, count) | ⚠️ Bypassed — routes use `listingsApi` favorites instead |
| `insuranceApi` (policies, quotes, claims) | ⚠️ Largely unused — `insurance.upload.tsx` uses raw `api` calls |
| `notificationsApi.getNotifications()`, `.markAsRead()`, `.deleteNotification()` | ⚠️ No notifications list page exists |
| `messagingApi.deleteConversation()`, `.deleteMessage()` | ⚠️ Not exposed in messages UI |
| `messagingApi.getUnreadCount()` | ⚠️ Not used for nav badge |
| `analyticsApi.getPerformance()`, `.getListingAnalytics()`, `.getRevenue()`, `.getCustomers()` | ⚠️ Only `getInsights()` is used |
| `fraudApi.getHighRiskUsers()` | ⚠️ No admin route uses this |
| `adminApi` (684 lines) | ⚠️ No admin routes exist in the frontend |

### 4.2 Inconsistent API Call Patterns

| Route | Issue |
|---|---|
| `dashboard.renter.tsx` | 🔴 Uses `apiClient.get()` directly with manual `Authorization` header |
| `settings.profile.tsx` | ⚠️ Uses `api.patch("/users/me")` directly instead of `usersApi.updateProfile()` |
| `insurance.upload.tsx` | ⚠️ Uses raw `api.get()` and `api.post()` instead of `insuranceApi` |
| All other routes | ✅ Use API modules correctly |

### 4.3 Missing Pages

| Expected Feature | Status |
|---|---|
| **Notifications list page** | 🔴 No route exists — API module is complete but no UI |
| **Admin dashboard** | 🔴 No admin routes — 684-line admin API module unused |
| **Organization detail/settings/members** | 🔴 Links in `organizations._index.tsx` point to routes that don't exist |
| **User public profile** | ⚠️ Not audited — may or may not exist |
| **Insurance policies list** | ⚠️ `insuranceApi.getMyPolicies()` exists but no page lists policies |
| **Insurance claims** | ⚠️ `insuranceApi.getMyClaims()` exists but no page |

### 4.4 Pagination Issues

| Route | Issue |
|---|---|
| `bookings.tsx` | No pagination — loads all bookings |
| `disputes.tsx` | No pagination — loads all disputes |
| `favorites.tsx` | No pagination — loads all favorites |
| `dashboard.owner.earnings.tsx` | Hardcoded `limit: 20` with no pagination |
| `messages.tsx` | Fetches 100 messages, no "load older" |

### 4.5 Error Handling Quality

| Quality Level | Routes |
|---|---|
| **Good** (inline errors, toast, specific messages) | auth.login, auth.signup, auth.forgot-password, auth.reset-password, bookings.$id, checkout, settings.profile |
| **Adequate** (catches + displays generic message) | search, bookings, payments, disputes, organizations, become-owner, earnings, insights |
| **Poor** (console.error only or missing) | 🔴 `messages.tsx` — errors on send/fetch are only `console.error`, no user-visible feedback |

### 4.6 Security Observations

- ✅ All routes perform auth checks in `clientLoader`/`clientAction`.
- ✅ Input sanitization (`.trim()`, `.slice()`, max lengths) is applied consistently across most routes.
- ✅ UUID validation before API calls (messages, insurance).
- ✅ Ownership checks on edit/delete operations.
- ⚠️ Token stored in localStorage (standard for SPAs but vulnerable to XSS).
- ⚠️ No CSRF protection visible (Axios-based, not cookie-based auth, so mitigated by Bearer token pattern).

---

## 5. Summary Matrix

| Route | API Integration | Error Handling | Loading States | Validation | Overall |
|---|---|---|---|---|---|
| auth.login | ✅ | ✅ | ✅ | ✅ | ✅ Solid |
| auth.signup | ✅ | ✅ | ✅ | ✅ | ✅ Solid |
| auth.forgot-password | ✅ | ✅ | ✅ | ✅ | ✅ Solid |
| auth.reset-password | ✅ | ✅ | ✅ | ✅ | ✅ Solid |
| listings.new | ✅ | ⚠️ | ✅ | ✅ | ⚠️ Good (no drafts) |
| listings.$id.edit | ✅ | ✅ | ✅ | ✅ | ✅ Solid |
| listings.$id | ✅ | ✅ | ✅ | ✅ | ⚠️ Good (missing favorites, blocked dates) |
| search | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ Good (skeleton, debounce) |
| bookings | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ Functional (no pagination) |
| bookings.$id | ✅ | ✅ | ✅ | ✅ | ⚠️ Good (dead review state) |
| checkout | ✅ | ✅ | ✅ | ✅ | ✅ Solid |
| payments | ✅ | ⚠️ | ✅ | N/A | ⚠️ Functional |
| earnings | ✅ | ✅ | ✅ | ✅ | ⚠️ Good (no bank check) |
| insights | ✅ | ✅ | ⚠️ | N/A | ⚠️ Functional |
| dashboard.owner | ✅ | ⚠️ | ⚠️ | N/A | ⚠️ Functional |
| dashboard.renter | 🔴 | ⚠️ | ⚠️ | N/A | 🔴 Pattern violation |
| disputes | ✅ | ⚠️ | ✅ | N/A | ⚠️ Functional |
| disputes.new | ✅ | ✅ | ✅ | ✅ | ✅ Solid |
| disputes.$id | ✅ | ✅ | ✅ | ✅ | ⚠️ Good (no evidence view) |
| messages | ✅ | 🔴 | ✅ | ⚠️ | 🔴 Errors silent |
| favorites | ⚠️ | ✅ | ✅ | N/A | ⚠️ Wrong API module |
| reviews | ✅ | ✅ | ✅ | N/A | ⚠️ Good (no edit) |
| settings.profile | ⚠️ | ✅ | ✅ | ✅ | ⚠️ Inconsistent API usage |
| settings.notifications | ✅ | ✅ | ✅ | N/A | ✅ Solid |
| organizations._index | ✅ | ⚠️ | ⚠️ | N/A | 🔴 Links to missing routes |
| organizations.new | ✅ | ✅ | ✅ | ✅ | ⚠️ Good (multi-step data loss) |
| insurance | 🔴 | N/A | N/A | N/A | 🔴 Static page, no API |
| insurance.upload | ⚠️ | ✅ | ✅ | ✅ | ⚠️ Bypasses API module |
| become-owner | ✅ | ✅ | ✅ | ✅ | ✅ Solid |

### Legend
- ✅ = Good / Complete
- ⚠️ = Functional but has gaps
- 🔴 = Significant issue

---

## Priority Fixes

### P0 — Must Fix
1. **`messages.tsx`**: Add user-visible error handling for send failures, fetch failures, and conversation creation failures.
2. **`dashboard.renter.tsx`**: Refactor to use API modules (`bookingsApi`, `favoritesApi`, `listingsApi`) instead of raw `apiClient` with manual headers.
3. **`organizations._index.tsx`**: Create the missing organization detail/settings/members routes, or remove the broken links.

### P1 — Should Fix
4. **Add a notifications list page** to use the already-built `notificationsApi`.
5. **Add unread message count badge** in the navigation using `messagingApi.getUnreadCount()`.
6. **`listings.$id.tsx`**: Call `bookingsApi.getBlockedDates()` to display unavailable dates in the booking calendar.
7. **`favorites.tsx`**: Switch from `listingsApi.getFavoriteListings()` to `favoritesApi.getFavorites()` for consistency and richer features.
8. **`insurance.tsx`**: Load user's policies from `insuranceApi.getMyPolicies()` instead of being a static page.
9. **`insurance.upload.tsx`**: Refactor to use `insuranceApi.createPolicy()`.
10. **Pagination**: Add pagination to bookings, disputes, and favorites lists.

### P2 — Nice to Have
11. Wire up `optimistic-updates.ts` for favorites toggle, message send, and booking actions.
12. Wire up `error-handler.ts` centralized handlers instead of ad-hoc error catching.
13. Add admin dashboard routes to use the `adminApi` module.
14. Add listing draft saving in the multi-step creation flow.
15. Add typing indicators to the messages page.
16. Add CSV/PDF export to payments/transactions.
