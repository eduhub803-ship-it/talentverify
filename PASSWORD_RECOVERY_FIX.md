# Password Recovery Redirect Fix

**Issue**: Production password recovery emails redirected to homepage instead of reset-password page.

**Root Cause**: The password reset redirect URL was using `window.location.origin` which may not match Supabase project settings registered redirect URLs.

---

## Solution

### 1. Environment Configuration
Added `VITE_AUTH_REDIRECT_URL` to `.env.example`:
```
VITE_AUTH_REDIRECT_URL=https://www.successeduhub.net
```

**In .env.local**, add:
```
VITE_AUTH_REDIRECT_URL=https://www.successeduhub.net
```

### 2. Code Changes
Updated `src/features/auth/api/auth.service.ts` to use the environment variable:

- `sendPasswordReset()`: Uses `VITE_AUTH_REDIRECT_URL/reset-password`
- `register()`: Uses `VITE_AUTH_REDIRECT_URL/login?verified=1`
- `resendSignupConfirmation()`: Uses `VITE_AUTH_REDIRECT_URL/login?verified=1`

Fallback: If `VITE_AUTH_REDIRECT_URL` is not set, falls back to `window.location.origin` for development.

### 3. Router Configuration
Route is public and properly exposed:
```typescript
{ path: '/reset-password', element: <ResetPasswordPage /> }
```

---

## Supabase Project Setup Required

### Add Redirect URLs to Supabase Project Settings:

1. Go to Supabase Dashboard → Project Settings → Authentication
2. Under "Redirect URLs", add **BOTH**:
   - `http://localhost:5173/**` (development)
   - `https://www.successeduhub.net/**` (production)

3. Click "Update" to save

These URLs tell Supabase where users can be redirected after auth flows (email confirmation, password reset, etc).

---

## Password Recovery Flow

1. User enters email in `/forgot-password`
2. `sendPasswordReset()` sends email with recovery link
3. Email link contains: `https://www.successeduhub.net/reset-password#access_token=xxx&type=recovery`
4. User clicks link → `/reset-password` page loads
5. Page reads token from URL fragment
6. User sets new password → `updatePassword()` consumed token
7. Success message → redirects to `/login`

---

## Files Changed

- `.env.example`: Added `VITE_AUTH_REDIRECT_URL`
- `src/features/auth/api/auth.service.ts`: Updated 3 auth email redirect functions

---

## Testing Checklist

- [x] Build passes (2.46s, no errors)
- [x] Routes properly configured
- [x] Development fallback works (localhost:5173)
- [x] Production domain configured

**Next: Ensure Supabase project redirect URLs include both localhost and production domain**

---

## GO / NO-GO Status

**✅ GO** - Code fix complete, build passing. Requires Supabase redirect URL configuration to complete.

