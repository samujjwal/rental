# Mobile App (React Native)

This folder provides a page-by-page reference implementation for the React Native app.

## Screens
- `HomeScreen` – search + location autocomplete + CTA
- `SearchScreen` – results list
- `ListingScreen` – listing detail placeholder
- `LoginScreen` – auth entry
- `SignupScreen` – account creation
- `BookingsScreen` – renter bookings list
- `MessagesScreen` – conversations list
- `ProfileScreen` – account summary
- `SettingsScreen` – notification toggles
- `CheckoutScreen` – payment placeholder
- `CreateListingScreen` – new listing form placeholder
- `EditListingScreen` – edit listing placeholder
- `BookingFlowScreen` – booking creation flow
- `MessageThreadScreen` – conversation detail
- `ReviewsScreen` – listing reviews + create review
- `OwnerDashboardScreen` – owner stats

## Notes
- Uses `@rental-portal/mobile-sdk` for typed API access.
- Intended as a reference implementation (wire into Expo or RN CLI as needed).

## Mobile E2E
- `pnpm run test:e2e:syntax` validates every Maestro YAML flow without needing a connected device.
- `pnpm run test:e2e:doctor` checks whether this host has enough iOS or Android tooling to run Maestro locally.
- `pnpm run test:e2e` still requires a booted iOS simulator or Android emulator plus the Expo app running on it.
