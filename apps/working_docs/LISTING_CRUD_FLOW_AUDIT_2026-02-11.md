# Listing CRUD And Management Flow Audit (2026-02-11)

## Scope
- Web listing create/edit/manage/search/detail/admin flows.
- API listing lifecycle endpoints and admin moderation paths.
- Persona coverage: renter, owner (rentee/lister), admin, operator (admin-ops).

## Persona Flow Matrix
- Owner (rentee/lister): Create listing wizard -> edit listing wizard -> publish/pause/activate/delete from My Listings. Status: PARTIAL (works, but category-specific dynamic fields are missing).
- Renter: Discover listings -> view details -> check availability -> book listing. Status: PARTIAL (core path present; no voice command flow for renter-side listing actions).
- Admin: View all listings -> moderation/status changes -> delete/archive. Status: PARTIAL (admin tooling exists, but some moderation semantics are inconsistent).
- Operator (admin-ops): Admin entity/table management and listing controls. Status: PARTIAL (works in dev, but dev auth bypass and pending filters are risky).

## Detailed Flows

### 1) Owner Create Listing (Web + API)
- Entry: `/listings/new` (`apps/web/app/routes/listings.new.tsx`).
- Preconditions:
  - Authenticated owner/admin via loader guard.
  - Category list loaded from `/categories`.
- Form steps:
  - Step 1 basic info: title, description, category.
  - Step 2 pricing: daily/weekly/monthly, deposit, condition.
  - Step 3 location: address/city/state/country/postal + lat/lng.
  - Step 4 rental details: delivery options, rental period, cancellation, rules, instant booking.
  - Step 5 images: upload + preview + delete.
- Persistence:
  - Images uploaded first via upload API, returned URLs embedded into payload.
  - Listing create POST `/listings` with schema-validated payload.
- Visualization:
  - Step indicator and image previews.
  - Validation feedback inline.
- Voice UX:
  - Voice assistant integrated into create form (`apps/web/app/components/listings/VoiceListingAssistant.tsx` + `apps/web/app/routes/listings.new.tsx`).
  - Supports commands like title/description/category/price/location/next step.
- Status: PARTIAL
  - Gap: no category-driven dynamic form sections for `categorySpecificData`.

### 2) Owner Edit Listing (Web + API)
- Entry: `/listings/:id/edit` (`apps/web/app/routes/listings.$id.edit.tsx`).
- Preconditions:
  - Authenticated.
  - Owner check (or admin).
  - Listing exists.
- Form:
  - Same step structure as create.
  - Existing values prefilled.
  - Supports image replacement/add/remove.
- Persistence:
  - Optional image upload for new files.
  - PATCH `/listings/:id` with validated payload.
  - Delete flow requires explicit `DELETE` confirmation and calls DELETE `/listings/:id`.
- Voice UX:
  - Same assistant integrated into edit page.
- Status: PARTIAL
  - Gap: no category-specific field UI/rendering.

### 3) Owner Manage Listings
- Entry: `/listings` (`apps/web/app/routes/listings._index.tsx`).
- Flow:
  - Load own listings.
  - Filter by status/search.
  - Actions per listing: publish, pause, activate, delete.
- API:
  - `GET /listings/my-listings`
  - `POST /listings/:id/publish|pause|activate`
  - `DELETE /listings/:id`
- Status: PARTIAL
  - Gap: activation requires verified listing at backend; owner cannot complete verification directly in this flow.

### 4) Renter Listing Discovery And Visualization
- Entry: `/search` (`apps/web/app/routes/search.tsx`).
- Flow:
  - Keyword/category/price/location filters.
  - View modes: grid/list/map.
  - Map marker visualization and bounds interactions.
- API:
  - `/listings/search` and `/search` fallback behavior in client.
- Status: PASS (core search + visualization present).

### 5) Renter Listing Detail To Booking
- Entry: `/listings/:id` (`apps/web/app/routes/listings.$id.tsx`).
- Flow:
  - Image gallery, metadata, owner info, reviews.
  - Availability check before booking.
  - Price calculation and booking request.
- API:
  - `GET /listings/:id`
  - `POST /listings/:id/check-availability`
  - bookings endpoints for quote + create.
- Status: PASS (core path present).

### 6) Admin Listing Moderation
- Entry: admin listings routes + dynamic admin entity pages.
- Flow:
  - List/filter listings.
  - Change status.
  - Delete/archive.
- API:
  - `/admin/listings`, `/admin/listings/:id`, `/admin/listings/:id/status`, `/admin/listings/pending`.
- Status: PARTIAL
  - Gap: pending endpoint currently returns `AVAILABLE` listings, not true pending-review.

### 7) Operator/Admin-Ops Entity Management
- Entry: `/admin/entities/listings`.
- Flow:
  - Generic data-table operations, edit/view/delete, bulk actions.
- Status: PARTIAL
  - Gap: in development mode, admin verification allows any authenticated user.

## Key Gaps Found
- Category-specific listing forms are not implemented end-to-end in web flow despite backend template infrastructure.
  - Backend template definitions: `apps/api/src/modules/categories/services/category-template.service.ts`.
  - Backend validates only if payload contains category-specific data: `apps/api/src/modules/listings/services/listings.service.ts`.
  - Web schema has no `categorySpecificData` field: `apps/web/app/lib/validation/listing.ts`.
- Admin pending listings semantics are incorrect:
  - `getPendingListings` filters `PropertyStatus.AVAILABLE`.
- Dev-mode admin access bypass:
  - `verifyAdmin` allows any authenticated user in development.
- E2E listing tests are stale against current UI field names/selectors:
  - Example selectors still expect `dailyRate`, `weeklyRate`, and many missing test IDs.

## Changes Applied In This Audit Pass
- Added simple voice CRUD helper for listing create/edit:
  - `apps/web/app/components/listings/VoiceListingAssistant.tsx`.
  - Integrated in:
    - `apps/web/app/routes/listings.new.tsx`
    - `apps/web/app/routes/listings.$id.edit.tsx`
- Added/standardized test IDs in listing forms:
  - `step-indicator`, `category-select`, `image-upload-area`, `image-preview`.
- Fixed route ordering risk for slug lookup:
  - `@Get('slug/:slug')` now declared before `@Get(':id')` in `apps/api/src/modules/listings/controllers/listings.controller.ts`.
- Updated listings service unit test mock to match current service (`findFirst`):
  - `apps/api/src/modules/listings/services/listings.service.spec.ts`.

## Validation Run
- Passed:
  - `pnpm -C apps/api test -- listings.service.spec.ts`
  - `pnpm -C apps/web exec eslint app/routes/listings.new.tsx app/routes/listings.$id.edit.tsx app/components/listings/VoiceListingAssistant.tsx`
- Known unrelated baseline issues:
  - Full web typecheck has pre-existing errors outside listing voice changes.

