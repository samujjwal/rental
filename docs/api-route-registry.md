# API Route Registry

This registry documents all API routes in the system to detect contract drift between:
- API controllers (source of truth)
- API tests
- Web clients
- Mobile clients
- Documentation

## Critical Routes (High Priority for Contract Testing)

### Bookings Controller (`/bookings`)
- `POST /bookings` - Create booking (idempotent)
- `GET /bookings/my-bookings` - Get renter's bookings
- `GET /bookings/host-bookings` - Get owner's bookings
- `GET /bookings/:id` - Get booking details
- `GET /bookings/:id/disputes` - Get booking disputes
- `POST /bookings/:id/approve` - Approve booking (idempotent)
- `POST /bookings/:id/reject` - Reject booking (idempotent)
- `POST /bookings/:id/cancel` - Cancel booking (idempotent)
- `POST /bookings/:id/start` - Start rental (idempotent)
- `POST /bookings/:id/request-return` - Request return (idempotent)
- `POST /bookings/:id/approve-return` - Approve return (idempotent)
- `POST /bookings/:id/reject-return` - Reject return (idempotent)
- `POST /bookings/:id/dispute` - Initiate dispute (idempotent)

### Payments Controller (`/payments`)
- `POST /payments/intents/:bookingId` - Create payment intent
- `POST /payments/refund/:bookingId` - Request refund (idempotent)
- `POST /payments/payout/:ownerId` - Request payout
- `GET /payments/ledger/:userId` - Get user ledger
- `GET /payments/earnings/:ownerId` - Get owner earnings

### Auth Controller (`/auth`)
- `POST /auth/register` - Register user
- `POST /auth/login` - Login user
- `POST /auth/logout` - Logout user
- `POST /auth/refresh` - Refresh token
- `POST /auth/forgot-password` - Forgot password
- `POST /auth/reset-password` - Reset password
- `POST /auth/verify-email` - Verify email
- `POST /auth/resend-verification` - Resend verification

### Listings Controller (`/listings`)
- `GET /listings` - Search listings
- `POST /listings` - Create listing
- `GET /listings/:id` - Get listing details
- `PATCH /listings/:id` - Update listing
- `DELETE /listings/:id` - Delete listing
- `POST /listings/:id/photos` - Upload listing photos
- `GET /listings/:id/availability` - Get availability
- `POST /listings/:id/availability` - Set availability

### Storage Controller (`/storage`)
- `POST /storage/upload` - Upload file
- `GET /storage/upload-url` - Get presigned upload URL
- `GET /storage/download-url` - Get presigned download URL
- `DELETE /storage/delete` - Delete file
- `GET /storage/list` - List files
- `POST /storage/listing-photos` - Upload listing photos
- `POST /storage/avatar` - Upload user avatar
- `POST /storage/org-logo` - Upload organization logo

## Contract Drift Detection

To detect contract drift, run the contract tests which verify:
1. All routes in this registry exist in their respective controllers
2. All routes used in tests exist in this registry
3. All routes used in web clients exist in this registry
4. All routes used in mobile clients exist in this registry
5. All routes documented in API docs exist in this registry

## Maintenance

When adding new routes:
1. Add them to this registry
2. Run contract tests to verify no drift
3. Update API documentation
4. Update client code as needed
5. Update tests as needed
