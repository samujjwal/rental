# Mobile E2E Tests — Maestro Flows
#
# Prerequisites:
#   1. Install Maestro: curl -Ls "https://get.maestro.mobile.dev" | bash
#   2. Start the Expo dev server:  cd apps/mobile && npx expo start
#   3. Run on simulator:           npx expo run:ios (or run:android)
#
# Running flows:
#   maestro test apps/mobile/.maestro/       # run all flows
#   maestro test apps/mobile/.maestro/auth-login.yaml   # run one
#
# CI setup (GitHub Actions):
#   - uses: mobile-dev-inc/action-maestro-cloud@v1
#     with:
#       api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
#       app-file: apps/mobile/build/app.apk
#       flows: apps/mobile/.maestro/

# Environment variables (set via maestro test --env):
#   API_URL: http://localhost:3400/api
#   TEST_EMAIL: renter@test.com
#   TEST_PASSWORD: Test123!@#
