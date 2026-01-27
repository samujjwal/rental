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

### 2. **Session Restoration on App Load**

When the application starts, the `useAuthInit()` hook is called from the root component (`root.tsx`) to:

1. Check if tokens exist in `localStorage`
2. Verify if the access token is still valid (not expired)
3. If access token is expired but refresh token is valid:
   - Automatically request a new access token using the refresh token
   - Update tokens in both storage and auth store
4. If refresh token is also expired:
   - Clear all stored auth data
   - User must log in again
5. If tokens are valid, restore the user session automatically

### 3. **Automatic Token Refresh**

If an API request receives a 401 (Unauthorized) response:
1. The API client interceptor automatically attempts to refresh the token
2. If refresh succeeds, the failed request is retried with the new token
3. If refresh fails, user is logged out and redirected to login page

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
  }
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
