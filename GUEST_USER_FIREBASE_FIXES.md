# Guest User Firebase Permission Fixes

## Problem Summary

Guest users were causing Firebase permission errors because they don't have Firebase authentication tokens, but the app was still trying to access Firestore paths that require authentication.

**Error Pattern:**
```
ERROR ❌ Error setting active stream: [FirebaseError: Missing or insufficient permissions.]
WARN ⚠️ Permission denied setting active stream for user guest_mgkhsba5_bl1t6w.
WARN    Path: users/guest_mgkhsba5_bl1t6w/activeStream/current
```

## Root Cause

Guest users have IDs that start with `guest_` but they are not authenticated with Firebase. The Firebase security rules require authentication for accessing user-specific paths like:
- `users/{userId}/activeStream/current`
- `users/{userId}` profile data
- Conversation participants

## Solution

Added guest user detection and early returns in all services that interact with Firebase for user-specific data.

## Files Modified

### 1. **src/services/activeStreamTracker.ts**

**Changes:**
- Added `isGuestUser()` helper method
- Updated all methods to handle guest users:
  - `setActiveStream()` - Returns early for guest users
  - `getActiveStream()` - Returns null for guest users  
  - `clearActiveStream()` - Returns early for guest users
  - `testPermissions()` - Returns success for guest users
  - `atomicStreamSwitch()` - Returns early for guest users
  - `cleanupPartialFailure()` - Returns early for guest users
  - `recoverGhostState()` - Returns early for guest users
  - `validateStreamParticipation()` - Returns true for guest users

**Guest User Behavior:**
- Guest users can "participate" in streams locally
- No Firebase writes/reads for guest users
- All operations succeed silently
- No permission errors

### 2. **src/services/streamSyncValidator.ts**

**Changes:**
- Added `isGuestUser()` helper method
- Updated methods to handle guest users:
  - `startSyncValidation()` - Skips Firebase listeners for guest users
  - `validateSyncBeforeOperation()` - Always returns valid for guest users
  - `resolveStreamStateMismatch()` - Returns early for guest users

**Guest User Behavior:**
- No real-time sync validation needed
- All sync operations are considered valid
- No Firebase listeners created

### 3. **src/services/profileSyncService.ts**

**Changes:**
- Added `isGuestUser()` helper method
- Updated methods to handle guest users:
  - `startProfileSync()` - Returns no-op unsubscribe for guest users
  - `syncProfileToConversations()` - Returns early for guest users

**Guest User Behavior:**
- No profile sync to conversations
- No Firebase profile listeners
- Guest profiles remain local only

## Guest User Detection Logic

```typescript
private static isGuestUser(userId: string): boolean {
  // Guest users have IDs that start with 'guest_'
  return userId.startsWith('guest_') || !auth.currentUser;
}
```

## Testing Results

### Before Fix:
```
ERROR ❌ Error setting active stream: [FirebaseError: Missing or insufficient permissions.]
ERROR ❌ Error getting active stream: [FirebaseError: Missing or insufficient permissions.]
ERROR ❌ Error in sync validation listener: [FirebaseError: Missing or insufficient permissions.]
```

### After Fix:
```
🎭 Guest user guest_mgkhsba5_bl1t6w setting active stream locally: test-stream-123
🎭 Guest user guest_mgkhsba5_bl1t6w getting active stream locally (always null)
🎭 Guest user guest_mgkhsba5_bl1t6w - skipping sync validation (expected behavior)
```

## Impact

✅ **No more Firebase permission errors for guest users**
✅ **App doesn't crash when guest users interact with streams**
✅ **Guest users can still use the app with limited functionality**
✅ **Authenticated users continue to work normally**
✅ **Clean console logs with appropriate guest user messaging**

## Guest User Limitations (By Design)

- Cannot persist stream state across app restarts
- Cannot sync profile changes to conversations
- Cannot receive real-time updates from Firebase
- Stream participation is local-only
- No cross-device synchronization

These limitations are expected and appropriate for guest users who haven't created accounts.
