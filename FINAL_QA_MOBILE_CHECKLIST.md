# Final QA Mobile Checklist + Device Matrix

Use this to track mobile-specific QA, layout, and behavior across devices.

## Device Matrix
- [ ] iPhone SE (small screen) — iOS current. Notes:
- [ ] iPhone 14/15 (standard) — iOS current. Notes:
- [ ] iPhone 14/15 Pro Max (large) — iOS current. Notes:
- [ ] Pixel 6/7 (standard) — Android current. Notes:
- [ ] Pixel XL / Galaxy S Ultra (large) — Android current. Notes:

## App Shell
- [ ] Safe area padding is correct on all screens. `PASS / FAIL` Notes:
- [ ] Navigation stack titles are accurate. `PASS / FAIL` Notes:
- [ ] Back navigation works everywhere. `PASS / FAIL` Notes:

## Auth
- [ ] Login works, error states render correctly. `PASS / FAIL` Notes:
- [ ] Signup works, role selection persists. `PASS / FAIL` Notes:
- [ ] Forgot password: request works. `PASS / FAIL` Notes:
- [ ] Reset password: token + new password works. `PASS / FAIL` Notes:
- [ ] Logout clears session and returns to login. `PASS / FAIL` Notes:

## Search + Listing
- [ ] Search results load and list renders correctly. `PASS / FAIL` Notes:
- [ ] Tapping listing opens detail. `PASS / FAIL` Notes:
- [ ] Listing detail renders title, price, location, images. `PASS / FAIL` Notes:
- [ ] Reviews load and paginate. `PASS / FAIL` Notes:

## Booking Flow
- [ ] Availability check works. `PASS / FAIL` Notes:
- [ ] Booking create works and routes to checkout. `PASS / FAIL` Notes:
- [ ] Checkout opens web flow and returns. `PASS / FAIL` Notes:
- [ ] Booking detail actions work: approve/reject/cancel/start/return. `PASS / FAIL` Notes:

## Messaging
- [ ] Conversations list loads. `PASS / FAIL` Notes:
- [ ] Thread opens and messages load. `PASS / FAIL` Notes:
- [ ] Send message works; attachments render. `PASS / FAIL` Notes:

## Favorites
- [ ] Favorites list loads and filters. `PASS / FAIL` Notes:
- [ ] Remove favorite updates list. `PASS / FAIL` Notes:

## Disputes
- [ ] Dispute list loads. `PASS / FAIL` Notes:
- [ ] Dispute detail loads; response + close works. `PASS / FAIL` Notes:
- [ ] Dispute create works. `PASS / FAIL` Notes:

## Organizations
- [ ] Organization list loads. `PASS / FAIL` Notes:
- [ ] Create org works. `PASS / FAIL` Notes:
- [ ] Update org settings works. `PASS / FAIL` Notes:
- [ ] Members list + invite/remove works. `PASS / FAIL` Notes:

## Profile + Settings
- [ ] Profile shows user data. `PASS / FAIL` Notes:
- [ ] Settings: profile update works. `PASS / FAIL` Notes:
- [ ] Settings: notifications update works. `PASS / FAIL` Notes:

## Performance + UX
- [ ] Loading states appear for slow API calls. `PASS / FAIL` Notes:
- [ ] Empty states are clear and friendly. `PASS / FAIL` Notes:
- [ ] No text overlap or clipped content in small screens. `PASS / FAIL` Notes:
