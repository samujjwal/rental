# Feature Coverage Matrix (Web + Mobile)

## Booking Flow
- Web: `routes/listings.$id.tsx` (booking CTA), `routes/checkout.$bookingId.tsx`, `routes/bookings.$id.tsx`
- Mobile: `BookingFlowScreen` (create booking), `CheckoutScreen`, `BookingDetailScreen`

## Messaging
- Web: `routes/messages.tsx` (threads)
- Mobile: `MessagesScreen`, `MessageThreadScreen`

## Reviews & Ratings
- Web: `routes/reviews.tsx`, listing detail reviews
- Mobile: `ReviewsScreen`

## Owner Dashboard
- Web: `routes/dashboard.owner.tsx`, `routes/dashboard.owner.*.tsx`
- Mobile: `OwnerDashboardScreen`

## Listings Create/Edit
- Web: `routes/listings.new.tsx`, `routes/listings.$id.edit.tsx`
- Mobile: `CreateListingScreen`, `EditListingScreen`

## Profile & Settings
- Web: `routes/settings.profile.tsx`, `routes/settings.notifications.tsx`
- Mobile: `ProfileScreen`, `SettingsScreen`

## Payments / Checkout
- Web: `routes/checkout.$bookingId.tsx`
- Mobile: `CheckoutScreen`
