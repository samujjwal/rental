# Mobile Spec (React Native)

## Goals
- Deliver a native-feeling search experience aligned with the web app.
- Keep API contracts stable and reusable across web and mobile.
- Provide explicit behaviors for location, search suggestions, and map search.

## Supported Screens
- Home
- Search Results
- Listing Details (basic behavior notes)
- Login
- Signup
- Bookings
- Messages
- Profile
- Settings
- Checkout
- Create Listing
- Edit Listing
- Booking Flow
- Message Thread
- Reviews
- Owner Dashboard

## API Contract (Mobile-Ready)

### Geo Autocomplete
- `GET /api/geo/autocomplete?q=<text>&limit=6&lat=&lon=&zoom=&location_bias_scale=&layer=city`
- Response
```json
{
  "results": [
    {
      "label": "San Francisco, California, United States",
      "city": "San Francisco",
      "state": "California",
      "country": "United States",
      "lat": 37.7793,
      "lon": -122.4193
    }
  ]
}
```

### Geo Reverse
- `GET /api/geo/reverse?lat=<x>&lon=<y>&lang=en`
- Response
```json
{
  "result": {
    "label": "San Francisco, California, United States",
    "city": "San Francisco",
    "state": "California",
    "country": "United States",
    "lat": 37.7793,
    "lon": -122.4193
  }
}
```

### Listings Search (Geo)
- `GET /api/search?query=&categoryId=&lat=&lon=&radius=&minPrice=&maxPrice=&page=&size=&sort=`
- Response
```json
{
  "results": [
    {
      "id": "listing-id",
      "title": "Camera Kit",
      "description": "...",
      "categoryName": "Photography",
      "categorySlug": "photography",
      "city": "San Francisco",
      "state": "California",
      "country": "United States",
      "location": { "lat": 37.7793, "lon": -122.4193 },
      "basePrice": 45,
      "currency": "USD",
      "photos": ["https://..."],
      "ownerName": "Alex Kim",
      "ownerRating": 4.8,
      "averageRating": 4.6,
      "totalReviews": 21,
      "bookingMode": "INSTANT_BOOK",
      "condition": "good",
      "features": ["Delivery"],
      "score": 0.83
    }
  ],
  "total": 210,
  "page": 1,
  "size": 20,
  "aggregations": {}
}
```

### Listings Search (Non-Geo)
- `GET /api/listings/search?query=&category=&location=&minPrice=&maxPrice=&sortBy=&page=&limit=`
- Response
```json
{
  "listings": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 0
}
```

## Screen Specs

### Home Screen
**Components**
- Search input (autosuggest listings)
- Location input (autosuggest places)
- “Use my location” button
- Search CTA

**Behavior**
- Search suggestions appear after 2 characters, debounce 300ms.
- Selecting a suggestion navigates to Search Results with `query`.
- Location suggestions appear after 2 characters, debounce 300ms.
- Selecting a location saves `label` + `lat/lon` for geo search.
- “Use my location” triggers GPS + reverse geocode.

**Navigation**
- CTA navigates to `Search Results` with `query`, `location`, and `lat/lon` when available.

### Search Results Screen
**Components**
- Search bar (with suggestions)
- Filter drawer
- Listings list
- Map toggle (optional, if RN map SDK is enabled)

**Filters**
- Category
- Location (autocomplete)
- Radius
- Price
- Instant booking
- Delivery
- Condition

**Behavior**
- Changes to filters trigger fetch (debounced or on submit).
- Map “Search this area” sends `lat/lon/radius`.

### Listing Details
**Components**
- Images carousel
- Price per day
- Location label
- Reviews summary
- CTA “Book”

**Behavior**
- CTA navigates to booking flow.

### Login / Signup
**Components**
- Email + password inputs
- Primary CTA
- Link between login and signup

**Behavior**
- Login and register call `/api/auth/login` or `/api/auth/register`.
- Store access token for authenticated calls.

### Bookings
**Behavior**
- Requires auth.
- Shows list from `/api/bookings/my-bookings`.

### Booking Flow
**Behavior**
- Collect listing ID and dates.
- Create booking via `/api/bookings`.
- Navigate to Checkout with booking ID.

### Messages
**Behavior**
- Requires auth.
- Shows conversations from `/api/conversations`.

### Message Thread
**Behavior**
- Fetch messages from `/api/conversations/:id/messages`.

### Profile
**Behavior**
- Shows basic user info.
- Links to Settings.
- Sign out action.

### Settings
**Behavior**
- Push/email toggles stored locally for now.
- Preference fields (language, currency, timezone) persist via `/api/users/me`.

### Checkout
**Behavior**
- Collect booking ID and request `/api/payments/intents/:bookingId`.
- Integrate Stripe SDK on mobile to confirm payment intent using returned client secret.

### Create Listing / Edit Listing
**Behavior**
- Collect required listing fields for `/api/listings` create/update.
- Uses category ID and geo coordinates to satisfy backend validation.

### Reviews
**Behavior**
- Load listing reviews from `/api/reviews/listing/:listingId`.
- Create review via `/api/reviews` with booking ID.

### Owner Dashboard
**Behavior**
- Load stats from `/api/users/me/stats`.

## Data & State Management (RN)
- Use React Query or SWR (recommended) for caching + background refresh.
- Store last location selection locally to bias autocomplete.
- Save recent searches for fast access.

## Mobile SDK Wrapper
- Package: `@rental-portal/mobile-sdk`
- Provides typed helpers for geo + search endpoints.
- Example:
```ts
import { createMobileClient } from "@rental-portal/mobile-sdk";

const client = createMobileClient({
  baseUrl: "https://api.example.com/api",
  getAuthToken: () => token,
});

const { results } = await client.search({ query: "camera", page: 1, size: 20 });
```

## Suggested Libraries (RN)
- Networking: `axios` or `react-query`
- Maps: `react-native-maps` (Google/Apple) or `react-native-mapbox-gl`
- Location: `react-native-geolocation-service`

## Error Handling
- Geo autocomplete errors should return empty suggestions without breaking UI.
- If reverse geocode fails, allow manual entry.
- If search fails, show inline error with retry.

## Accessibility
- Inputs should use accessible labels and role hints.
- Provide keyboard navigation for suggestions on tablets.

## Implementation Notes
- Mobile should always call `/api/geo/*` (never the provider directly).
- For best performance, store `lat/lon` in search params when location is selected.
- Add `radius` defaults to 25km unless user overrides.
