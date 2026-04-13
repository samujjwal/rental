# Mobile E2E Tests — Maestro Flows
#
# Prerequisites:
#   1. Install Maestro: curl -Ls "https://get.maestro.mobile.dev" | bash
#   2. Verify host readiness:      cd apps/mobile && pnpm run test:e2e:doctor
#   3. Start the Expo dev server:  cd apps/mobile && npx expo start
#   4. Run on simulator:           npx expo run:ios (or run:android)
#
# Validation without a device:
#   pnpm run test:e2e:syntax
#
# Running flows:
#   maestro test apps/mobile/.maestro/                     # run all flows
#   maestro test apps/mobile/.maestro/auth-login.yaml      # run one
#   maestro test apps/mobile/.maestro/comprehensive-suite.yaml  # run comprehensive suite
#
# Local runtime expectations:
#   - iOS: full Xcode installation with `xcrun --find simctl` working
#   - Android: ANDROID_HOME or ANDROID_SDK_ROOT set, with `adb` and `emulator` on PATH
#
# CI setup (GitHub Actions):
#   - uses: mobile-dev-inc/action-maestro-cloud@v1
#     with:
#       api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
#       app-file: apps/mobile/build/app.apk
#       flows: apps/mobile/.maestro/
#
# Environment variables (set via maestro test --env):
#   API_URL: http://localhost:3400/api
#   TEST_EMAIL: renter@test.com
#   TEST_PASSWORD: Test123!@#
#
# Available Test Flows:
#
# Authentication & Profile:
#   - auth-login.yaml: Sign-in flow
#   - auth-signup.yaml: Registration flow
#   - password-reset.yaml: Password reset request
#   - logout-flow.yaml: Logout and session clearing
#   - profile-settings.yaml: Profile viewing and settings navigation
#   - profile-update.yaml: Update profile information and password
#
# Core User Flows:
#   - browse-listings.yaml: Browse and view listings
#   - search-filter.yaml: Search by keyword and filter by category/price
#   - booking-flow.yaml: Create a booking
#   - favorites-flow.yaml: Add/remove favorites and view favorites list
#   - reviews-flow.yaml: Submit reviews and view listing/user reviews
#   - messaging-flow.yaml: Real-time messaging between renters and owners
#
# Payment & Financial:
#   - payment-flow.yaml: Payment processing, deposit holds, and refunds
#
# Owner Flows:
#   - owner_portal_test.yaml: Owner portal navigation
#   - owner-create-listing.yaml: Create new listing with all required fields
#   - owner-manage-bookings.yaml: View and manage booking requests (approve/reject)
#   - owner-earnings.yaml: View earnings dashboard and payout history
#
# Advanced Features:
#   - insurance-claims-flow.yaml: Insurance claims submission and management
#   - notifications-flow.yaml: Push notifications and notification center
#   - dispute-resolution-flow.yaml: Dispute creation and resolution
#   - deep-linking.yaml: Deep linking to listings, bookings, and profile
#   - network-error.yaml: Network error handling and offline mode
#   - app-lifecycle.yaml: App backgrounding, foregrounding, and restart
#   - biometric-auth.yaml: Biometric authentication (Face ID/Touch ID)
#   - permissions.yaml: Location and camera permission requests
