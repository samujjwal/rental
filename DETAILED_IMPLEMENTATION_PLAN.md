# Detailed Implementation Plan — Remaining Work
## GharBatai Rental Portal — Sprint-Level Task Breakdown

**Date:** February 18, 2026  
**Scope:** All remaining work items based on full-stack audit, requirements gap analysis, and legacy cleanup  
**Approach:** No backward compatibility — clean up all legacy/deprecated code as we go  
**Total Estimated Effort:** ~65-70 developer-days across 9 weeks

---

## Phase 1: Security & Critical Fixes (Week 1)
### Sprint Goal: Eliminate all security vulnerabilities, complete DTO validation, fix backend gaps

---

### 1.1 Secure Email Controller
**Priority:** 🔴 P0  
**File:** `apps/api/src/modules/notifications/controllers/email.controller.ts`  
**Issue:** 4 endpoints have NO authentication guards — anyone can send emails  
**Approach:** Remove public-facing controller entirely. Email sending should only be triggered internally by services (booking confirmation, password reset, etc.), never exposed as REST API.

**Tasks:**
1. Delete `email.controller.ts` entirely (or add `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('SUPER_ADMIN')` if admin testing endpoint is needed)
2. Verify all email sending flows work through internal service calls:
   - Booking confirmation → `NotificationService.sendBookingConfirmation()`
   - Password reset → `AuthService.requestPasswordReset()`
   - Welcome email → `AuthService.register()`
3. Remove the `GET /email/test` endpoint completely
4. Update any frontend code that calls email endpoints directly (there should be none)

**Verification:** `curl -X POST /api/email/send` returns 404 (endpoint removed) or 401 (guarded)

---

### 1.2 Secure SMS Controller
**Priority:** 🔴 P0  
**File:** `apps/api/src/modules/notifications/controllers/sms.controller.ts`  
**Issue:** 7 endpoints have NO authentication guards — anyone can send SMS at platform cost  
**Approach:** Same as email — remove or fully guard. Keep only `POST /sms/webhook` for Twilio callbacks (with Twilio signature verification).

**Tasks:**
1. Remove all endpoints except the Twilio webhook callback
2. Add Twilio request signature validation to the webhook endpoint
3. Ensure OTP flows (when implemented) trigger internally, not via public API
4. Remove `GET /sms/test` endpoint

---

### 1.3 Secure Dev Admin Endpoint
**Priority:** 🔴 P0  
**File:** `apps/api/src/modules/admin/controllers/dev.controller.ts`  
**Approach:** Remove entirely. Use seed scripts for admin creation.

**Tasks:**
1. Delete `dev.controller.ts`
2. Remove the `DevModule` import from `app.module.ts` (or just the controller)
3. Ensure `packages/database/prisma/seed-comprehensive.ts` creates an admin user
4. Document admin creation process in README

---

### 1.4 Fix In-App Notification Privilege Escalation
**Priority:** 🟠 P1  
**File:** `apps/api/src/modules/notifications/controllers/inapp-notification.controller.ts`

**Tasks:**
1. Replace every `@Body('userId')` and `@Query('userId')` with `@CurrentUser() user` decorator
2. Use `user.id` instead of the body/query parameter
3. Add `@UseGuards(JwtAuthGuard)` to all endpoints in this controller
4. Write test to verify a user cannot access another user's notifications

---

### 1.5 Create DTO Classes for Remaining Modules

**Approach:** For each module, extract inline DTOs from services into proper `dto/` directory files with `class-validator` decorators. Delete the old inline interface/type definitions.

#### 1.5a Users Module
**File to create:** `apps/api/src/modules/users/dto/update-profile.dto.ts`
```typescript
// Fields: firstName, lastName, phone, dateOfBirth, address, city, state, country, zipCode
// All @IsOptional, @IsString with @MaxLength, phone @Matches for format
```
**File to modify:** `apps/api/src/modules/users/services/users.service.ts` — remove inline type, import DTO  
**File to modify:** `apps/api/src/modules/users/controllers/users.controller.ts` — type `@Body()` with DTO class

#### 1.5b Categories Module
**File to create:** `apps/api/src/modules/categories/dto/category.dto.ts`
```typescript
// CreateCategoryDto: name (@IsString, @MaxLength(100)), description, icon, parentId (@IsOptional @IsUUID), 
// isActive (@IsBoolean), order (@IsInt), pricingMode (@IsEnum), templateSchema (@IsOptional @IsObject)
// UpdateCategoryDto: PartialType(CreateCategoryDto)
```
**File to modify:** `apps/api/src/modules/categories/services/categories.service.ts` — remove inline DTOs

#### 1.5c Tax Module  
**File to create:** `apps/api/src/modules/tax/dto/tax.dto.ts`
```typescript
// CalculateTaxDto: amount (@IsNumber), fromAddress (nested ValidateNested), toAddress, lineItems 
// CreateTaxTransactionDto: bookingId, amounts
// TaxRegistrationDto: jurisdictions, taxIds
```

#### 1.5d Insurance Module
**File to create:** `apps/api/src/modules/insurance/dto/insurance.dto.ts`
```typescript
// CreatePolicyDto: policyNumber, bookingId, listingId, type (@IsEnum), provider, coverage, premium, dates, documents
// VerifyPolicyDto: status (@IsEnum)
```

#### 1.5e Notifications Module
**File to create:** `apps/api/src/modules/notifications/dto/notification.dto.ts`
```typescript
// UpdatePreferencesDto: emailNotifications, pushNotifications, smsNotifications (all @IsBoolean @IsOptional)
// RegisterDeviceDto: token (@IsString), platform (@IsEnum: 'ios'|'android'|'web')
```

#### 1.5f Favorites Module
**File to create:** `apps/api/src/modules/favorites/dto/favorite.dto.ts`
```typescript
// AddFavoriteDto: listingId (@IsUUID)
// BulkFavoriteDto: listingIds (@IsArray @IsUUID({ each: true }))
```

#### 1.5g AI Module
**File to create:** `apps/api/src/modules/ai/dto/ai.dto.ts`
```typescript
// GenerateDescriptionDto: title (@IsString @MaxLength(200)), category, condition, features (@IsArray @IsString({ each: true }))
```

#### 1.5h Admin Module
**File to create:** `apps/api/src/modules/admin/dto/admin.dto.ts`
```typescript
// UpdateUserRoleDto: role (@IsEnum(UserRole))
// UpdateEntityStatusDto: status (@IsString), reason (@IsOptional @IsString)
// AdminQueryDto: page, limit, search, sortBy, sortOrder, filters
```

---

### 1.6 Backend Stability Fixes

#### Settlement Retry CRON
**File to modify:** `apps/api/src/common/scheduler/scheduler.service.ts`
```typescript
// Add new daily CRON at 4 AM:
@Cron('0 4 * * *')
async retryFailedSettlements() {
  // Find bookings with status COMPLETED that haven't transitioned to SETTLED
  // and were completed more than 24 hours ago
  const staleBookings = await this.prisma.booking.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  for (const booking of staleBookings) {
    try {
      await this.bookingStateMachine.transition(booking.id, 'SETTLE', 'system');
    } catch (e) { 
      this.logger.error(`Settlement retry failed for booking ${booking.id}`, e);
    }
  }
}
```

#### Add `reject-return` Endpoint
**File to modify:** `apps/api/src/modules/bookings/controllers/bookings.controller.ts`
```typescript
@Post(':id/reject-return')
@UseGuards(JwtAuthGuard)
async rejectReturn(@Param('id') id: string, @CurrentUser() user, @Body() body: { reason: string }) {
  return this.bookingsService.rejectReturn(id, user.id, body.reason);
}
```

#### Handle `charge.dispute.created` Webhook
**File to modify:** `apps/api/src/modules/payments/webhook.service.ts`
- On `charge.dispute.created`: Create `Dispute` record in DB, notify admin, freeze related deposit

#### Consolidate Notification Controllers
**Approach:**
1. Merge `notifications.controller.ts` and `inapp-notification.controller.ts` into single controller
2. Keep `notification.controller.ts` (push-specific: device register/unregister)
3. Remove duplicate `GET/PUT /preferences` — keep one canonical version
4. Delete overlapping routes

#### Remove Duplicate Admin Routes
**File to modify:** `apps/api/src/modules/admin/controllers/admin.controller.ts`
- Remove `GET /admin/refunds` (keep `GET /admin/payments/refunds`)
- Remove `GET /admin/payouts` (keep `GET /admin/payments/payouts`)
- Remove `GET /admin/ledger` (keep `GET /admin/payments/ledger`)

---

## Phase 2: MUI Removal & Design System (Week 2)
### Sprint Goal: Completely remove MUI from codebase, implement full dark mode

---

### 2.1 Admin Route Migration

For each admin route file importing from `@mui/*`:

#### `routes/admin/_layout.tsx`
- Replace MUI `AppBar`, `Drawer`, `Toolbar` with Tailwind-based layout components
- Use existing `DashboardLayout` pattern

#### `routes/admin/_index.tsx` (Dashboard)
- Replace MUI `Grid`, `Card`, `CardContent`, `Typography` with existing Tailwind `Card`, `StatCard` components
- Replace MUI `Alert` with existing `components/ui/alert.tsx`
- Replace MUI charts with `recharts` (already a dependency)

#### `routes/admin/analytics.tsx`
- Replace MUI card grid patterns with Tailwind
- Keep `recharts` for data visualization

#### `routes/admin/entities.$entity.tsx` (Data Table)
- Replace `material-react-table` with `@tanstack/react-table` (already installed)
- Create reusable `<DataTable>` component in `components/ui/data-table.tsx`:
  - Column definitions, sorting, filtering, pagination
  - Uses Tailwind for styling
  - Supports row actions (edit, delete)
  - Supports row selection for bulk operations

#### `routes/admin/power-operations.tsx`
- Replace MUI components with Tailwind equivalents

#### `components/admin/ModernTanStackForm.tsx`
- Replace MUI form components with Tailwind form elements
- Use existing `Input`, `Select`, `Textarea` from `components/ui/`

#### `components/admin/BulkActions.tsx`
- Replace MUI `Checkbox`, `Button`, `Menu` with Tailwind equivalents

#### `components/admin/enhanced/*`
- Migrate all enhanced admin components from MUI to Tailwind

### 2.2 Remove MUI Dependencies
**File:** `apps/web/package.json`
```bash
pnpm remove @mui/material @mui/icons-material @emotion/react @emotion/styled material-react-table -F web
```
Replace MUI icons with `lucide-react` icons (already installed and used elsewhere).

### 2.3 Apply Dark Mode

**Step 1: Verify CSS setup**
- Ensure `tailwind.css` has `@media (prefers-color-scheme: dark)` or class-based dark mode
- Verify `tailwind.config` has `darkMode: 'class'`

**Step 2: Update all UI components** (`components/ui/*.tsx`)
For each component, add `dark:` variants:
- `bg-white` → `bg-white dark:bg-gray-900`
- `text-gray-900` → `text-gray-900 dark:text-white`
- `border-gray-200` → `border-gray-200 dark:border-gray-700`
- `bg-gray-50` → `bg-gray-50 dark:bg-gray-800`

Components to update (estimated 20+ files):
- `card.tsx`, `badge.tsx`, `button.tsx`, `dialog.tsx`
- `input.tsx`, `select.tsx`, `textarea.tsx`
- `toast.tsx`, `tabs.tsx`, `pagination.tsx`
- `skeleton.tsx`, `dropdown-menu.tsx`, `avatar.tsx`
- All `layout/` components

**Step 3: Update all route pages**
Systematic pass through all 54+ route files adding `dark:` variants to:
- Page backgrounds, card backgrounds
- Text colors (headings, body, muted)
- Border colors
- Focus/hover states

**Step 4: Wire ThemeToggle**
- Add `ThemeToggle` button to `DashboardSidebar.tsx` footer
- Add `ThemeToggle` to navbar for marketing/public pages
- Ensure `ThemeProvider` wraps the app in `root.tsx`

### 2.4 Design Tokens
**File to modify:** `apps/web/app/theme/designTokens.ts`  
**File to modify:** `apps/web/tailwind.css`

Replace all hardcoded hex colors (`#111827`, `#6B7280`, `#3B82F6`, etc.) with CSS custom properties:
```css
:root {
  --color-bg-primary: theme('colors.white');
  --color-bg-secondary: theme('colors.gray.50');
  --color-text-primary: theme('colors.gray.900');
  --color-text-secondary: theme('colors.gray.600');
  --color-border: theme('colors.gray.200');
  --color-accent: theme('colors.blue.600');
  --color-success: theme('colors.green.600');
  --color-warning: theme('colors.amber.500');
  --color-error: theme('colors.red.600');
}

.dark {
  --color-bg-primary: theme('colors.gray.900');
  --color-bg-secondary: theme('colors.gray.800');
  --color-text-primary: theme('colors.gray.50');
  --color-text-secondary: theme('colors.gray.400');
  --color-border: theme('colors.gray.700');
  /* ... */
}
```

### 2.5 HydrateFallback
Add `export function HydrateFallback()` to top 10 high-traffic routes:
- `routes/home.tsx`
- `routes/search.tsx`
- `routes/listings.$id.tsx`
- `routes/bookings.tsx`
- `routes/dashboard.owner.tsx`
- `routes/dashboard.renter.tsx`
- `routes/messages.tsx`
- `routes/checkout.$bookingId.tsx`
- `routes/favorites.tsx`
- `routes/earnings.tsx`

Each returns a page-specific skeleton layout.

---

## Phase 3: Contract Alignment & Code Cleanup (Week 3)
### Sprint Goal: Single source of truth for types, clean database schema

---

### 3.1 Booking Contract Alignment
**Files:**
- `apps/web/app/lib/validation/booking.ts` — Zod schema
- `apps/api/src/modules/bookings/dto/booking.dto.ts` — Backend DTO

**Tasks:**
1. Audit both files side by side
2. Resolve each mismatched field:
   - `deliveryMethod`: Add to backend DTO if business logic supports it, or remove from frontend
   - `deliveryAddress`: Same
   - `specialRequests`: Add to backend as optional string field
   - `guestCount`: Add to frontend form as optional number input
3. Update the booking form in `routes/listings.$id.tsx` to include/remove fields
4. Update mobile SDK `BookingCreatePayload` to match

### 3.2 Review Contract Alignment
**Files:**
- `apps/web/app/lib/validation/review.ts`
- `apps/api/src/modules/reviews/dto/review.dto.ts`

**Tasks:**
1. Standardize field names: use `rating` (not `overallRating`) as the primary field name
2. Flatten category ratings: Frontend should send `accuracyRating`, `communicationRating`, etc. directly (not nested under `categories`)
3. Ensure `reviewType` is sent by frontend (derive from booking role)

### 3.3 Listing Field Standardization
**File:** `apps/web/app/lib/api/listings.ts`

**Tasks:**
1. Remove `images` alias — use `photos` everywhere in frontend (backend uses `photos`)
2. Remove `pricePerDay` alias — use `basePrice` (backend field name)
3. Remove fabricated `deliveryOptions` — either implement delivery on backend or remove from UI
4. Update all components that reference `images` to use `photos`
5. Update all components that reference `pricePerDay` to use `basePrice`

### 3.4 Enum Single Source of Truth
**Approach:** Generate enums from Prisma schema → shared-types, eliminate duplication.

**Tasks:**
1. Create a generator script: `packages/shared-types/scripts/generate-enums.ts`
   - Reads `packages/database/prisma/schema.prisma`
   - Extracts all `enum` definitions
   - Generates TypeScript enums and `as const` objects
   - Writes to `packages/shared-types/src/enums.ts`
2. Add script to `packages/shared-types/package.json`: `"generate": "tsx scripts/generate-enums.ts"`
3. Add to turbo pipeline: `shared-types:generate` depends on `database:build`
4. Remove hand-maintained enum definitions from `@rental-portal/database/src/index.ts`
5. Have both `database` and `mobile-sdk` import enums from `shared-types`

### 3.5 Mobile SDK Type Consolidation
**File:** `packages/mobile-sdk/src/index.ts`

**Tasks:**
1. Import shared types from `@rental-portal/shared-types` instead of defining them inline
2. Re-export only SDK-specific types (like `MobileClientConfig`)
3. Remove all 30+ duplicate type definitions
4. Add `@rental-portal/shared-types` as a dependency in mobile-sdk `package.json`

### 3.6 Remove Duplicate Search Endpoint
**Tasks:**
1. Remove or deprecate `GET /listings/search` from `listings.controller.ts`
2. Ensure all frontend/mobile code uses `GET /search` endpoint
3. Transfer any unique query params from listings search to the main search endpoint

### 3.7 Database Schema Cleanup
**File:** `packages/database/prisma/schema.prisma`

**Tasks:**
1. Remove `propertyId` from `Review` model — use `listingId` only
2. Remove duplicate phone fields — standardize on `phone` (not `phoneNumber`)
3. Remove duplicate amount fields — standardize on `totalPrice` (not `totalAmount`)
4. Add explicit compound indices:
```prisma
model Booking {
  // ... existing
  @@index([renterId, status])
  @@index([ownerId, status])
  @@index([listingId, startDate, endDate])
}

model Listing {
  // ... existing
  @@index([ownerId, status])
  @@index([categoryId, status])
  @@index([deletedAt])
}

model User {
  // ... existing
  @@index([deletedAt])
}

model Payment {
  @@index([bookingId, status])
}

model LedgerEntry {
  @@index([bookingId])
  @@index([accountId, accountType])
}
```
5. Create migration: `pnpm db:migrate -- --name cleanup_aliases_add_indices`

### 3.8 Legacy Code Cleanup
**Tasks:**
1. Delete `apps/web/app/hooks/legacy/` directory
2. Delete duplicate debounce hook — keep `useDebounce` in `hooks/`, remove from individual components
3. Delete `apps/web/fix-all-button-tags.sh`, `fix-icon-props.sh`, `fix-remaining-buttons.sh`, `migrate-buttons.sh`
4. Remove unused markdown docs from `apps/web/` root (migration summaries, session logs)

---

## Phase 4: Mobile App Foundation (Week 4-5)
### Sprint Goal: Make mobile app buildable, add persistent auth, implement core UX patterns

---

### 4.1 Project Initialization (Day 1)

**Tasks:**
1. Initialize Expo project in `apps/mobile/`:
```bash
npx create-expo-app@latest --template blank-typescript .
```
2. Keep existing `src/` directory, integrate with Expo structure
3. Create `app.json`:
```json
{
  "expo": {
    "name": "GharBatai",
    "slug": "gharbatai",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "gharbatai",
    "userInterfaceStyle": "automatic",
    "ios": { "bundleIdentifier": "com.gharbatai.mobile" },
    "android": { "package": "com.gharbatai.mobile" }
  }
}
```
4. Create `babel.config.js` with Expo preset
5. Create `metro.config.js` with workspace package resolution
6. Update `package.json` with all dependencies:
   - `expo`, `react-native`, `react`
   - `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`
   - `react-native-screens`, `react-native-safe-area-context`
   - `expo-secure-store`, `expo-image-picker`, `expo-image`
   - `@react-native-community/datetimepicker`
   - `react-native-gesture-handler`, `react-native-reanimated`
   - `socket.io-client`
   - `@stripe/stripe-react-native`
   - `react-native-toast-message`
7. Verify `npx expo start` launches on iOS simulator

### 4.2 Token Persistence (Day 2)

**File to modify:** `apps/mobile/src/api/authStore.ts`

Replace module-scoped variables with `expo-secure-store`:
```typescript
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';

export const authStore = {
  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async setTokens(access: string, refresh: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  },
  async clearTokens() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
};
```

**File to modify:** `apps/mobile/src/api/authContext.tsx`
- On mount, check `authStore.getToken()` — if exists, validate with `GET /auth/me` to restore session
- Add loading state while checking stored token

### 4.3 Token Refresh Interceptor (Day 2)

**File to modify:** `packages/mobile-sdk/src/index.ts` (or `apps/mobile/src/api/client.ts`)

Add 401 interceptor to the `request()` function:
```typescript
async function request(url, options) {
  let response = await fetch(url, options);
  
  if (response.status === 401 && !options._isRetry) {
    const refreshToken = await authStore.getRefreshToken();
    if (refreshToken) {
      const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      
      if (refreshResponse.ok) {
        const { accessToken, refreshToken: newRefresh } = await refreshResponse.json();
        await authStore.setTokens(accessToken, newRefresh);
        
        // Retry original request with new token
        options.headers.Authorization = `Bearer ${accessToken}`;
        options._isRetry = true;
        response = await fetch(url, options);
      } else {
        await authStore.clearTokens();
        // Navigate to login
      }
    }
  }
  return response;
}
```

### 4.4 Bottom Tab Navigator (Day 3)

**File to create:** `apps/mobile/src/navigation/TabNavigator.tsx`
```typescript
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator();

export function TabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: HomeIcon }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarIcon: SearchIcon }} />
      <Tab.Screen name="Bookings" component={BookingsScreen} options={{ tabBarIcon: CalendarIcon }} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarIcon: MessageIcon, tabBarBadge: unreadCount }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: UserIcon }} />
    </Tab.Navigator>
  );
}
```

**File to modify:** `apps/mobile/App.tsx`
- Replace flat `NativeStackNavigator` with nested navigation:
  - Root Stack: Auth screens (Login, Signup, ForgotPassword, ResetPassword)
  - Root Stack: Main (TabNavigator)
  - Root Stack: Modal screens (BookingDetail, ListingDetail, Checkout, Settings, etc.)
- Add conditional navigation based on auth state

### 4.5 Shared Theme (Day 3)

**File to create:** `apps/mobile/src/theme/index.ts`
```typescript
export const colors = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700', color: colors.text },
  h2: { fontSize: 22, fontWeight: '600', color: colors.text },
  body: { fontSize: 16, color: colors.text },
  caption: { fontSize: 14, color: colors.textSecondary },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const commonStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm + 4, fontSize: 16 },
  button: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.md, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
```

**Then:** Replace all inline `StyleSheet.create()` in 50+ screens with shared theme imports.

### 4.6 Error & Loading Infrastructure (Day 4)

**File to create:** `apps/mobile/src/components/ErrorBoundary.tsx`
- React class component that catches render errors
- Shows "Something went wrong" screen with retry button

**File to create:** `apps/mobile/src/components/Toast.tsx`
- Wrapper around `react-native-toast-message`
- `showSuccess()`, `showError()`, `showInfo()` helpers

**File to create:** `apps/mobile/src/components/LoadingSkeleton.tsx`
- Animated placeholder components for common layouts (list item, card, detail page)

**Apply to all screens:**
- Wrap root `App.tsx` with `ErrorBoundary`
- Replace `Alert.alert()` with toast notifications
- Replace `ActivityIndicator` with skeleton layouts where appropriate

### 4.7 Form Infrastructure (Day 4)

**Tasks:**
1. Add `KeyboardAvoidingView` wrapper to all screens with forms (Login, Signup, CreateListing, EditListing, Settings, etc.)
2. Add `RefreshControl` to all `FlatList` and `ScrollView` screens
3. Replace text date inputs with `@react-native-community/datetimepicker`

### 4.8 Booking Action Buttons (Day 5)

**File to modify:** `apps/mobile/src/screens/BookingDetailScreen.tsx`

**Tasks:**
1. Fetch available transitions from `GET /bookings/:id/available-transitions`
2. Render action buttons based on available transitions and user role:
   - Owner sees: Approve, Reject, Start Rental, Approve Return, Reject Return
   - Renter sees: Cancel, Request Return, Dispute
3. Each button calls corresponding SDK method and shows toast on success/failure
4. Add confirmation dialog before destructive actions (cancel, reject)

### 4.9 Listing Management (Day 5)

**File to modify:** `apps/mobile/src/screens/OwnerListingsScreen.tsx`

**Tasks:**
1. Add action menu (long-press or swipe) on each listing card
2. Wire Publish, Pause, Activate, Delete actions
3. Show confirmation on Delete

### 4.10 Favorites Integration (Day 5)

**File to modify:** `apps/mobile/src/screens/ListingScreen.tsx`
- Add heart/favorite button to header
- Toggle calls `mobileClient.addFavorite()` / `mobileClient.removeFavorite()`

**File to modify:** `apps/mobile/src/components/ListingCard.tsx`
- Add small heart icon overlay on card

### 4.11 Image Upload (Day 6-7)

**File to create:** `apps/mobile/src/components/ImagePicker.tsx`
- Uses `expo-image-picker` for camera and gallery selection
- Multi-image selection support
- Preview with remove capability
- Upload to S3/MinIO via presigned URL or multipart form

**Integrate into:**
- `CreateListingScreen.tsx` — listing photos (multiple)
- `EditListingScreen.tsx` — add/remove listing photos
- `SettingsProfileScreen.tsx` — profile avatar (single)

### 4.12 Search Enhancements (Day 7)

**File to modify:** `apps/mobile/src/screens/SearchScreen.tsx`
- Add filter panel (bottom sheet or modal):
  - Price range slider
  - Category picker
  - Condition selector
  - Instant booking toggle
- Add pagination (`onEndReached` → load next page)
- Add pull-to-refresh

---

## Phase 5: Mobile Advanced Features (Week 6)
### Sprint Goal: Real-time messaging, push notifications, native payments

---

### 5.1 WebSocket Messaging (2 days)
**File to create:** `apps/mobile/src/api/socket.ts`
```typescript
import { io } from 'socket.io-client';

export function createSocketConnection(token: string) {
  const socket = io(API_BASE_URL, {
    auth: { token },
    transports: ['websocket'],
  });
  return socket;
}
```

**File to modify:** `apps/mobile/src/screens/MessageThreadScreen.tsx`
- Connect to WebSocket on mount
- Listen for `message:new` events
- Send messages through WebSocket (with HTTP fallback)
- Implement typing indicators

### 5.2 Push Notifications (2 days)
**Tasks:**
1. Set up Firebase project + download config files
2. Install `expo-notifications`, `@react-native-firebase/messaging`
3. Request notification permission on first login
4. Register device token via `POST /notifications/devices/register`
5. Handle notification received (background + foreground)
6. Navigate to relevant screen on notification tap
7. Unregister token on logout

### 5.3 Stripe Native SDK (2 days)
**File to modify:** `apps/mobile/src/screens/CheckoutScreen.tsx`

**Tasks:**
1. Install `@stripe/stripe-react-native`
2. Initialize Stripe with publishable key
3. Create payment intent via `POST /payments/intents/:bookingId`
4. Present Stripe payment sheet
5. Handle success/failure/cancellation
6. Navigate to booking detail on success

### 5.4 Deep Linking (1 day)
**File to modify:** `apps/mobile/app.json` — add scheme and intent filters  
**File to create:** `apps/mobile/src/navigation/linking.ts`
```typescript
export const linking = {
  prefixes: ['gharbatai://', 'https://gharbatai.com'],
  config: {
    screens: {
      Listing: 'listings/:id',
      Booking: 'bookings/:id',
      Messages: 'messages',
      // ...
    },
  },
};
```

### 5.5 Accessibility (1 day)
Systematic pass through all screens:
- Add `accessibilityLabel` to all `Pressable`, `TouchableOpacity`
- Add `accessibilityRole` ('button', 'link', 'heading', etc.)
- Add `accessibilityHint` for non-obvious actions
- Test with VoiceOver (iOS) and TalkBack (Android)

---

## Phase 6: Missing Requirements (Week 7)
### Sprint Goal: Close gaps against RequirementsForRentalSystem.md

---

### 6.1 Social Login (3 days)

**Backend Tasks:**
1. Install `passport-google-oauth20`, `passport-apple`
2. Create OAuth strategy files in `apps/api/src/modules/auth/strategies/`
3. Add endpoints: `GET /auth/google`, `GET /auth/google/callback`
4. Add endpoints: `GET /auth/apple`, `GET /auth/apple/callback`
5. Link OAuth accounts to existing User records (by email match)

**Web Tasks:**
1. Add "Sign in with Google" / "Sign in with Apple" buttons to `auth.login.tsx` and `auth.signup.tsx`
2. Handle OAuth redirect/callback

**Mobile Tasks:**
1. Use `expo-auth-session` for Google OAuth
2. Use `expo-apple-authentication` for Apple Sign-In

### 6.2 OTP Login (2 days)

**Backend Tasks:**
1. Create `POST /auth/otp/request` — sends SMS OTP to phone number
2. Create `POST /auth/otp/verify` — validates OTP, issues tokens
3. Store OTP in Redis with TTL (5 minutes)
4. Rate limit: 3 OTP requests per phone per hour

**Frontend Tasks:**
1. Add "Login with OTP" option on login pages (web + mobile)
2. Phone input → OTP input screen → verify → redirect to dashboard

### 6.3 Email & Phone Verification Gates (1 day each)

**Email Verification:**
1. On registration, send verification email with token link
2. Create `GET /auth/verify-email/:token` endpoint
3. Add `emailVerified` boolean to User model (or check existing field)
4. Gate booking creation: if `!user.emailVerified`, show verification prompt

**Phone Verification:**
1. Create `POST /auth/phone/send-otp` — sends OTP
2. Create `POST /auth/phone/verify-otp` — verifies and marks phone verified
3. Gate relevant actions on phone verification

### 6.4 Account Lock (1 day)
1. Add `loginAttempts` and `lockedUntil` fields to User model
2. In `AuthService.login()`: increment attempts on failure, lock for 15min after 5 failures
3. On successful login, reset attempt counter
4. Return clear error message when locked

### 6.5 Invoice PDF Generation (2 days)
1. Install `@react-pdf/renderer` or use Puppeteer with HTML template
2. Create `GET /bookings/:id/invoice` — generate and return PDF
3. Include: item name, dates, price breakdown (base + fees + tax), booking ID, parties
4. Add "Download Invoice" button to booking detail (web) and share sheet (mobile)

### 6.6 Data Export / GDPR (1 day)
1. Create `GET /users/me/export` — returns JSON/ZIP of all user data
2. Include: profile, bookings, messages, reviews, favorites, payments
3. Queue as background job (Bull) for large datasets
4. Send email with download link when ready

### 6.7 Admin Role Levels (2 days)
1. Extend `UserRole` enum: add `OPERATIONS_ADMIN`, `FINANCE_ADMIN`, `SUPPORT_ADMIN`
2. Create permission matrix:
   - Super Admin: full access
   - Operations Admin: listings, bookings, moderation
   - Finance Admin: payments, payouts, refunds, ledger
   - Support Admin: users, disputes, messages
3. Update `RolesGuard` to check granular permissions
4. Update admin UI to show/hide sections based on role

### 6.8 Identity Verification / KYC (3 days)
1. Add `identityDocuments` model to Prisma:
   ```prisma
   model IdentityDocument {
     id        String   @id @default(uuid())
     userId    String
     type      DocumentType // GOVERNMENT_ID, DRIVING_LICENSE, PAN, ADDRESS_PROOF
     fileUrl   String
     status    VerificationStatus // PENDING, APPROVED, REJECTED
     reviewedBy String?
     reviewedAt DateTime?
   }
   ```
2. Create upload endpoint: `POST /users/me/documents`
3. Create admin review endpoints: `GET /admin/documents/pending`, `PATCH /admin/documents/:id/verify`
4. Gate vehicle booking on driving license verification
5. Show verification status on user profile

### 6.9 Category-Specific Booking Fields (2 days)
1. Use existing `Category.templateSchema` (JSON) to define per-category booking fields
2. When creating booking, validate category-specific required fields:
   - Vehicles: pickup location, drop-off location, driver license number
   - Clothing: size, measurements
   - Houses: check-in time, check-out time, guest count
3. Frontend: dynamically render form fields based on category template

---

## Phase 7: AI/ML Integration (Week 8)
### Sprint Goal: Semantic search, content moderation, smart features

---

### 7.1 Verify AI Description Generation
- Confirm `OPENAI_API_KEY` is set in env
- Test `POST /ai/generate-description` returns meaningful content
- Wire "Generate Description" button in web `listings.new.tsx` and mobile `CreateListingScreen`

### 7.2 Content Moderation Pipeline
**Files to modify:** listing service, messaging service, review service

1. Add moderation check to listing create/update:
   ```typescript
   const modResult = await this.moderationService.moderateText(dto.title + ' ' + dto.description);
   if (modResult.flagged && modResult.severity === 'HIGH') {
     throw new BadRequestException('Content violates community guidelines');
   }
   if (modResult.flagged && modResult.severity === 'MEDIUM') {
     data.status = 'PENDING_REVIEW';
   }
   ```
2. Add moderation to message send (flag but don't block — notify admin)
3. Add moderation to review create (block if high severity)

### 7.3 Semantic Search with pgvector
1. Create embedding generation service:
   ```typescript
   @Injectable()
   export class EmbeddingService {
     async generateEmbedding(text: string): Promise<number[]> {
       const response = await this.openai.embeddings.create({
         model: 'text-embedding-3-small',
         input: text,
       });
       return response.data[0].embedding;
     }
   }
   ```
2. On listing create/update, generate embedding from `title + description + category + features`:
   ```sql
   UPDATE "Listing" SET embedding = $1::vector WHERE id = $2
   ```
3. Add semantic search endpoint or enhance existing search:
   ```sql
   SELECT *, embedding <=> $1::vector AS semantic_distance
   FROM "Listing"
   WHERE status = 'ACTIVE'
   ORDER BY embedding <=> $1::vector
   LIMIT 20;
   ```
4. Backfill embeddings for existing listings (background job)

### 7.4 Data-Driven Price Suggestions
**File to modify:** `apps/api/src/modules/listings/services/listings.service.ts`

Replace any regex-based pricing with DB aggregation:
```typescript
async getPriceSuggestion(categoryId: string, condition: string, city: string) {
  const comparables = await this.prisma.listing.findMany({
    where: { categoryId, status: 'ACTIVE', city: { contains: city, mode: 'insensitive' } },
    select: { basePrice: true },
    take: 100,
  });
  const prices = comparables.map(l => Number(l.basePrice)).sort();
  return {
    suggestedPrice: median(prices),
    range: { low: percentile(prices, 25), high: percentile(prices, 75) },
    comparableCount: prices.length,
  };
}
```

### 7.5 Recommendation Engine
**File to create:** `apps/api/src/modules/search/services/recommendation.service.ts`

Collaborative filtering based on booking/favorite overlap:
1. Get user's interacted listings (booked + favorited)
2. Find similar users (overlap in interactions)
3. Get listings those users interacted with that current user hasn't seen
4. Rank by overlap score
5. Expose via `GET /search/recommendations`

### 7.6 Listing Completeness Score
**Backend:** Calculate score based on filled fields, photo count, description length  
**Frontend:** Show progress indicator during listing creation

---

## Phase 8: Polish & Production Readiness (Week 9)
### Sprint Goal: Performance, resilience, quality

---

### 8.1 Partial Failure Loading
Update dashboard loaders to use `Promise.allSettled`:
- Each API call wraps independently
- Failed sections show "Failed to load" with retry button
- Successful sections render normally

### 8.2 Loading Skeletons
Wire remaining skeletons into all route loading states.

### 8.3 Deposit Partial Capture
Create explicit `deposit-capture` event for partial amount deduction (damage scenarios).

### 8.4 Webhook Idempotency
Add Stripe event ID tracking to prevent double-processing.

### 8.5 CSV/PDF Export
Add "Export" button to earnings and transactions pages.

### 8.6 Optimistic UI
Wire `useOptimisticMutation` for:
- Favorite toggle (instant heart change)
- Message send (instant message display)
- Booking actions (instant status update)

### 8.7 Bundle Optimization
- Code splitting for admin routes (lazy load)
- Image optimization pipeline
- Tree-shaking audit after MUI removal

### 8.8 Final QA
Run complete FINAL_QA_CHECKLIST.md and FINAL_QA_MOBILE_CHECKLIST.md on staging environment.

---

## Appendix: Task Count Summary

| Phase | Week | Tasks | Dev-Days |
|-------|------|-------|----------|
| 1. Security & Critical | 1 | 17 | 8-9 |
| 2. MUI Removal & Design | 2 | 12 | 8-9 |
| 3. Contract Cleanup | 3 | 11 | 6-7 |
| 4. Mobile Foundation | 4-5 | 20 | 12-14 |
| 5. Mobile Advanced | 6 | 6 | 8-9 |
| 6. Requirements | 7 | 10 | 10-12 |
| 7. AI/ML | 8 | 7 | 7-8 |
| 8. Polish & QA | 9 | 10 | 6-7 |
| **Total** | **9 weeks** | **93 tasks** | **65-75** |

---

**Document Version:** 1.0  
**Created:** February 18, 2026
