# Admin Backend Wiring Complete

The following admin modules have been successfully wired to the backend API. The mock data has been replaced with real data fetchers using React Router `loader` functions.

## wired Components

| Component    | Route                        | API Endpoint                     | Service Method |
| ------------ | ---------------------------- | -------------------------------- | -------------- |
| **Reviews**  | `/admin/content/reviews`     | `GET /admin/reviews`             | `getReviews`   |
| **Messages** | `/admin/content/messages`    | `GET /admin/messages`            | `getMessages`  |
| **Refunds**  | `/admin/finance/refunds`     | `GET /admin/finance/refunds`     | `getRefunds`   |
| **Payouts**  | `/admin/finance/payouts`     | `GET /admin/finance/payouts`     | `getPayouts`   |
| **Ledger**   | `/admin/finance/ledger`      | `GET /admin/finance/ledger`      | `getLedger`    |
| **Disputes** | `/admin/moderation/disputes` | `GET /admin/moderation/disputes` | `getDisputes`  |

## Implementation Details

### Data Fetching Strategy

- **Authentication**: All loaders use `requireAdmin(request)` to ensure only admins can access these routes.
- **Authorization**: `getUserToken(request)` retrieves the JWT for the internal API call.
- **Pagination**: URL parameters `page` and `limit` are passed to the backend.
- **Filtering**:
  - Reviews: `status`, `search`
  - Messages: `flagged`
  - Refunds: `status`
  - Payouts: `status`
  - Ledger: `type`
  - Disputes: `status`

### Frontend-Backend Mapping

The `loader` functions transform the backend DTOs into the shape expected by the frontend `DataTable` columns.

**Example: Reviews**

- Backend: `overallRating` -> Frontend: `rating`
- Backend: `reviewer.firstName` + `lastName` -> Frontend: `author`
- Backend: `status` (uppercase) -> Frontend: `status` (lowercase)

## Next Steps

1. **Verify pagination UI**: Ensure the `DataTable` pagination controls correctly update the URL query parameters.
2. **Implement Actions**: The "Actions" buttons (e.g., Approve Refund, Resolve Dispute) currently do not trigger API calls. They need `action` functions in the routes.
3. **Advanced Filtering**: Add date range pickers and more complex filters to the UI to leverage backend capabilities.
