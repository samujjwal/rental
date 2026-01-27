# Persistent Login Implementation

## Overview

The application now implements persistent login functionality that allows users to remain logged in across browser sessions without needing to log in repeatedly, unless their refresh token expires.

## How It Works

### 1. **Session Storage**

When a user logs in, the following information is stored in browser `localStorage`:

- `accessToken` - JWT token for API authentication (short-lived, typically 15min)
- `refreshToken` - Token used to request new access tokens (long-lived, typically 7 days)
- `user` - User profile information (cached)

Additionally, session information is stored in the **server-side session cookie** for server-side rendering and security.

### 2. **Session Restoration and Synchronization**

The application uses a **dual-sync restoration strategy** to handle both Server-Side (SSR) and Client-Side (CSR) initialization.

#### Server-Side Initialization (Loaders/Actions)

When a user navigates to a protected route (e.g., `/admin/users`):

1. The server-side **loader** calls `requireUser(request)` or `requireAdmin(request)`.
2. These utilities check the **HTTP-Only Session Cookie** (`__session`).
3. If the access token is missing or expired (401 from API):
   - The server automatically attempts a **Silent Refresh** using the `refreshToken` from the cookie.
   - If successful, it **redirects** the user back to the same page with a new `Set-Cookie` header.
   - This ensures the page never crashes or kicks the user out as long as the refresh token is valid.

#### Client-Side Syncing

To ensure `localStorage` stays in sync with the server cookie:

1. The **Root Loader** (`root.tsx`) extracts the current user and tokens from the session on every request.
2. The **Root Component** receives this data and updates the client-side `useAuthStore`.
3. This ensures that any refresh that happened on the server is immediately propagated to the client-side API client.

### 3. **Automatic Token Refresh (Client-Side Interceptor)**

If an asynchronous client-side API request (via Axios) receives a 401:

1. The `ApiClient` interceptor pauses the request.
2. It attempts to refresh the token using `localStorage`.
3. If successful, it retries the original request seamlessly.

## Configuration

To ensure persistence works correctly:

1. **SESSION_SECRET**: Must be set in your environment variables.
2. **API_URL**: Should point to your backend API.
3. **Remember Me**: When checked at login, sets the session cookie to expire in 30 days instead of 7.

## Key Implementation Files

- `apps/web/app/utils/auth.server.ts`: Server-side session management and silent refresh.
- `apps/web/app/root.tsx`: State synchronization between server and client.
- `apps/web/app/lib/api-client.ts`: Client-side interceptors for direct API calls.
- `apps/web/app/lib/store/auth.ts`: Zustand store for local persistence.
- `apps/web/app/hooks/useAuthInit.ts`: Mount-time session restoration.

### 4. **Auth Store State Management**

The auth store (`lib/store/auth.ts`) manages:

- `user` - Current user profile
- `accessToken` - Current access token
- `refreshToken` - Current refresh token
- `isInitialized` - Whether session restoration is complete
- `isLoading` - Whether session restoration is in progress

## Files Modified

### New Files

- `app/hooks/useAuthInit.ts` - Hook to initialize and restore user session

### Updated Files

1. **`app/lib/store/auth.ts`**
   - Added `isInitialized` and `isLoading` states
   - Added `restoreSession()` action for automatic session restoration
   - Added `setTokens()` action for token updates
   - Added token expiration checking logic

2. **`app/root.tsx`**
   - Integrated `useAuthInit()` hook
   - Added session restoration on app startup
   - Shows loading state while restoring session

3. **`app/lib/api-client.ts`**
   - Enhanced token refresh interceptor to update auth store
   - Properly clears auth state on refresh failure

4. **`app/routes/auth.login.tsx`**
   - Added import for auth store (for future enhancements)
   - Improved comments and structure

5. **`app/routes/auth.signup.tsx`**
   - Added import for auth store (for future enhancements)
   - Consistent with login implementation

## Usage

### For Users

1. Users log in with their email and password
2. Tokens and user info are automatically saved
3. When the user returns to the app:
   - If access token is valid: logged in automatically
   - If access token expired but refresh token valid: new token is fetched automatically
   - If both tokens expired: user must log in again

### For Developers

#### Check if User is Authenticated

```tsx
import { useAuthStore } from '~/lib/store/auth';

function MyComponent() {
  const { user, accessToken, isInitialized } = useAuthStore();

  if (!isInitialized) return <LoadingSpinner />;
  if (!user) return <LoginRequired />;

  return <div>Welcome, {user.firstName}</div>;
}
```

#### Get Current User

```tsx
const { user } = useAuthStore();
```

#### Log Out User

```tsx
const { clearAuth } = useAuthStore();
clearAuth(); // This also clears localStorage
window.location.href = '/auth/login';
```

#### Update User Info

```tsx
const { updateUser } = useAuthStore();
updateUser({ firstName: 'John', lastName: 'Doe' });
```

#### Wait for Session Restoration

```tsx
import { useAuthInit } from '~/hooks/useAuthInit';

function MyComponent() {
  const { isInitialized } = useAuthInit();

  if (!isInitialized) return <LoadingSpinner />;
  // Safe to access auth state now
}
```

## Token Lifecycle

### Access Token

- **Lifespan**: 15 minutes (configurable in backend)
- **Purpose**: Used to authenticate API requests
- **Storage**: localStorage + session cookie

### Refresh Token

- **Lifespan**: 7 days (configurable in backend)
- **Purpose**: Used to obtain new access tokens
- **Storage**: localStorage + session cookie
- **Security**: Stored securely, never sent to frontend unless needed

## Security Considerations

1. **Token Storage**: Tokens are stored in `localStorage` which is vulnerable to XSS attacks. For production:
   - Consider using httpOnly cookies for tokens
   - Implement CSP headers to prevent XSS
   - Sanitize user input

2. **Token Validation**: The app validates token expiration client-side:
   - This is for UX optimization only
   - Backend always validates tokens

3. **Logout**: When user logs out:
   - All tokens are cleared from storage
   - Optional: Call backend logout endpoint to invalidate session

4. **Refresh Token Rotation**: The backend implements refresh token rotation:
   - Each refresh request returns a new refresh token
   - Old refresh tokens are invalidated
   - Prevents replay attacks

## Configuration

### Token Expiration Times

Set in backend environment variables:

- `JWT_ACCESS_TOKEN_EXPIRY` - Access token TTL (default: 15m)
- `JWT_REFRESH_TOKEN_EXPIRY` - Refresh token TTL (default: 7d)

### Session Cookie

Set in `app/utils/auth.server.ts`:

```typescript
const sessionSecret = process.env.SESSION_SECRET;
sessionStorage = createCookieSessionStorage({
  cookie: {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    // ... other config
  },
});
```

## Testing Persistent Login

1. **Verify Session Persistence**
   - Log in to the app
   - Close browser or clear browser cache/cookies
   - Return to app
   - Should be automatically logged in

2. **Verify Token Refresh**
   - Log in and wait for access token to expire
   - Make an API request
   - Should automatically refresh and succeed

3. **Verify Session Expiration**
   - Log in and wait for refresh token to expire
   - Make an API request
   - Should redirect to login page

4. **Verify Logout**
   - Log in
   - Click logout
   - Check localStorage is cleared
   - Verify unable to access protected routes

## Troubleshooting

### User Not Auto-Logging In

- Check browser `localStorage` has tokens
- Check tokens aren't malformed
- Check refresh token hasn't expired
- Check backend token validation

### Token Refresh Failing

- Verify refresh token is valid
- Check backend refresh endpoint is working
- Check CORS headers are correct

### Session Not Restoring

- Check `useAuthInit` is called in root component
- Check `isInitialized` state before accessing auth
- Check network tab for API errors

## Future Enhancements

1. Add Sentry for session restoration error tracking
2. Implement device fingerprinting to prevent token theft
3. Add option to store tokens in sessionStorage for extra security
4. Implement automatic logout on inactivity
5. Add option for "Remember Me" with extended expiration
