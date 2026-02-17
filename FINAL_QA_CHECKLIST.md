# Final QA Checklist (Web + Mobile)

Use this to track end-to-end QA across web and mobile. Mark each item PASS/FAIL with notes.

## Auth
- [ ] Login with valid credentials → lands on `/dashboard`. `PASS / FAIL` Notes:
- [ ] Login with invalid credentials → error shown, no redirect. `PASS / FAIL` Notes:
- [ ] Signup (renter) → `/dashboard`, profile created. `PASS / FAIL` Notes:
- [ ] Signup (owner) → `/dashboard`, owner role set. `PASS / FAIL` Notes:
- [ ] Forgot password (web): submit email → success message shown. `PASS / FAIL` Notes:
- [ ] Reset password (web): token + new password → success + login. `PASS / FAIL` Notes:
- [ ] Logout → clears session and redirects to `/auth/login`. `PASS / FAIL` Notes:
- [ ] Mobile forgot/reset password → full flow via email token. `PASS / FAIL` Notes:

## Search + Listings
- [ ] Search with query only → results load, pagination works. `PASS / FAIL` Notes:
- [ ] Search with location (city) → lat/lng/radius applied. `PASS / FAIL` Notes:
- [ ] Search filters (price, condition, delivery, instant booking) → results update. `PASS / FAIL` Notes:
- [ ] Map view: markers render, “search this area” updates results. `PASS / FAIL` Notes:
- [ ] Listing detail renders: images, price, location, delivery options. `PASS / FAIL` Notes:
- [ ] Listing detail: reviews paginate, ratings display. `PASS / FAIL` Notes:
- [ ] Listing create (web): required fields enforced, images upload, success. `PASS / FAIL` Notes:
- [ ] Listing edit (web): updates persist; delivery radius unit correct. `PASS / FAIL` Notes:
- [ ] Owner listings (web): pause/activate/publish actions work. `PASS / FAIL` Notes:
- [ ] Mobile listing detail: reviews, price, photos render. `PASS / FAIL` Notes:
- [ ] Mobile create/edit listing: price validation, image handling. `PASS / FAIL` Notes:

## Bookings + Checkout
- [ ] Availability check: unavailable shows message, available shows pricing. `PASS / FAIL` Notes:
- [ ] Booking create: instant vs request flows behave correctly. `PASS / FAIL` Notes:
- [ ] Booking list: renter/owner toggles, filters work. `PASS / FAIL` Notes:
- [ ] Booking detail: approve/reject/cancel/return actions update. `PASS / FAIL` Notes:
- [ ] Checkout (web): Stripe loads, payment success redirects to booking. `PASS / FAIL` Notes:
- [ ] Mobile checkout: web checkout opens and completes. `PASS / FAIL` Notes:

## Messaging
- [ ] Messages list loads conversations. `PASS / FAIL` Notes:
- [ ] Thread opens, messages load, send works. `PASS / FAIL` Notes:
- [ ] Attachments upload and render. `PASS / FAIL` Notes:
- [ ] Profile “Contact” opens conversation and routes correctly. `PASS / FAIL` Notes:
- [ ] Booking → message flow works. `PASS / FAIL` Notes:

## Reviews
- [ ] Reviews page shows listing + user reviews. `PASS / FAIL` Notes:
- [ ] Create review (from booking) works and shows on listing/profile. `PASS / FAIL` Notes:

## Favorites
- [ ] Add favorite from listing, appears on favorites. `PASS / FAIL` Notes:
- [ ] Remove favorite (web + mobile), UI updates. `PASS / FAIL` Notes:

## Disputes
- [ ] Create dispute (web + mobile). `PASS / FAIL` Notes:
- [ ] Dispute list loads. `PASS / FAIL` Notes:
- [ ] Dispute detail: responses + close action work. `PASS / FAIL` Notes:

## Organizations
- [ ] Create organization (web + mobile). `PASS / FAIL` Notes:
- [ ] Settings update fields save (web). `PASS / FAIL` Notes:
- [ ] Invite member + role change + remove works. `PASS / FAIL` Notes:
- [ ] Organization listings page loads with city/state. `PASS / FAIL` Notes:

## Admin
- [ ] Admin dashboard loads analytics + activity feed. `PASS / FAIL` Notes:
- [ ] Entities CRUD + filters work. `PASS / FAIL` Notes:
- [ ] Disputes admin: status updates work. `PASS / FAIL` Notes:
- [ ] System pages (backups/logs/audit) load and are functional. `PASS / FAIL` Notes:
- [ ] Power operations (backup/clear cache) run successfully. `PASS / FAIL` Notes:

## Static / Legal / Help
- [ ] About, Careers, Press, How It Works, Safety, Help, Contact load. `PASS / FAIL` Notes:
- [ ] Terms/Privacy/Cookies load on web and mobile. `PASS / FAIL` Notes:

---

## Quick Smoke Sequence (10–12 minutes)
1. Login → dashboard.
2. Search with location → open listing.
3. Check availability → create booking.
4. Checkout (web) → payment success → booking detail.
5. Submit review → check listing reviews.
6. Open profile → contact → send message.
7. Favorites add/remove.
8. Dispute create → dispute detail response.
9. Owner dashboard → listings pause/activate.
10. Admin view: system logs and backups.
