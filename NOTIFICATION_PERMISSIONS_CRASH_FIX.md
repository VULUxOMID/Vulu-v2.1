# Notification Permissions Crash Fix

## Issue Summary

### What Was Happening
The VULU iOS app was crashing on launch with a `SIGABRT` exception (abort trap) in the notification permissions module. The crash occurred in the React Native TurboModule bridge when attempting to request notification permissions.

### Root Cause Analysis

**Stack Trace Location:**
- **Thread 9** (Crashed): `facebook::react::ObjCTurboModule::performVoidMethodInvocation` → `objc_exception_rethrow` → `abort()`
- **Thread 3** (Blocked): `PermissionsModule.definition()` → `EXUserFacingNotificationsPermissionsRequester` → Semaphore wait

**The Problem:**
1. **Automatic Permission Request on Startup**: The `pushNotificationService.initialize()` was being called during app initialization in `app/_layout.tsx`
2. **Synchronous Blocking Call**: The initialization method was calling `registerForPushNotifications()` which immediately invoked `Notifications.requestPermissionsAsync()`
3. **Wrong Thread/Timing**: iOS permission dialogs require being shown on the main thread with proper UI context, but this was happening during app bootstrap
4. **Unhandled Exception**: The exception thrown by the iOS permissions system wasn't being properly caught, causing the React Native bridge to abort the app

### Why It's Happening
- iOS has strict rules about when and how permission dialogs can be shown
- Requesting permissions during app initialization (before UI is fully loaded) violates these rules
- The React Native bridge couldn't properly handle the exception, leading to a crash
- The app was blocking on a semaphore waiting for user response that never came

## The Fix

### Changes Made

#### 1. **pushNotificationService.ts** - Separated Permission Checking from Requesting

**Before:**
```typescript
async initialize(): Promise<void> {
  // ... setup code ...
  await this.registerForPushNotifications(); // ❌ Automatically requests permissions
  // ... more setup ...
}
```

**After:**
```typescript
async initialize(): Promise<void> {
  // ... setup code ...
  await this.checkExistingPermissions(); // ✅ Only checks, doesn't request
  // ... more setup ...
}

// New method to check without requesting
private async checkExistingPermissions(): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') {
    // Only get token if we already have permission
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    this.expoPushToken = token;
  }
}

// Updated to be called explicitly by user action
async registerForPushNotifications(): Promise<string | null> {
  // EXPLICITLY request permissions - only when user takes action
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  // ... rest of registration ...
}
```

#### 2. **app/_layout.tsx** - Updated Initialization Comment

```typescript
try {
  // Initialize push notification service (does NOT request permissions)
  // Permissions will be requested explicitly when user grants them in onboarding or settings
  await pushNotificationService.initialize();
  setupQuickReplyActions();
} catch (error) {
  console.error('Failed to initialize push notifications:', error);
  // Continue app initialization even if notifications fail
}
```

#### 3. **NotificationsPermissionScreen.tsx** - Actually Request Permissions

**Before:**
```typescript
const handleAllow = () => {
  updateOnboardingData({ notificationsEnabled: true }); // ❌ Just updates state
  navigation.navigate('AvatarPicker');
};
```

**After:**
```typescript
const handleAllow = async () => {
  try {
    setIsRequesting(true);
    // Actually request notification permissions from the system
    const token = await pushNotificationService.registerForPushNotifications();
    
    updateOnboardingData({ notificationsEnabled: !!token });
    navigation.navigate('AvatarPicker');
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    // Continue even if permission fails
    updateOnboardingData({ notificationsEnabled: false });
    navigation.navigate('AvatarPicker');
  } finally {
    setIsRequesting(false);
  }
};
```

## Key Improvements

### 1. **Deferred Permission Requests**
- Permissions are NO LONGER requested automatically on app startup
- Only checks for existing permissions during initialization
- Requests only happen when user explicitly grants them (onboarding or settings)

### 2. **Granular Permission Status Tracking** ⭐ NEW
- Added `PermissionStatus` type: `'unknown' | 'granted' | 'denied' | 'provisional' | 'undetermined'`
- Service tracks current permission state internally
- New methods: `getPermissionStatus()` and `isNotificationEnabled()`
- Better observability for debugging permission issues

### 3. **Retry Logic for Network Failures** ⭐ NEW
- Token registration now retries up to 3 times on failure
- Exponential backoff: 1s, 2s, 4s between attempts
- Handles transient network errors gracefully
- Detailed logging for each retry attempt

### 4. **Specific Error Types** ⭐ NEW
- New `NotificationPermissionError` class with typed reasons:
  - `'denied'` - User denied permission
  - `'device_not_supported'` - Running on simulator/unsupported device
  - `'network_error'` - Network connectivity issue
  - `'token_error'` - Failed to obtain push token
- UI can show specific, helpful error messages for each case
- Better error tracking and analytics potential

### 5. **Proper Error Handling**
- All permission requests wrapped in try-catch blocks
- App continues functioning even if notifications fail
- Better error logging for debugging
- User-friendly error messages based on error type

### 6. **Better User Experience**
- Loading state shows "Requesting..." while waiting for user response
- Non-blocking UI during permission request
- Clear feedback to user about permission status
- Specific error messages help users understand what went wrong

### 7. **iOS Compliance**
- Permission dialogs only shown in response to user action
- Proper threading and timing for iOS permission system
- No more crashes from premature permission requests

## Testing Checklist

### Core Functionality
- [x] App launches without crashing
- [ ] Permissions are NOT requested automatically on first launch
- [ ] Onboarding screen properly requests permissions when user taps "Allow Notifications"
- [ ] Settings screen can request permissions if user skipped them initially
- [ ] App continues to function if user denies permissions
- [ ] Existing users with granted permissions still have their tokens loaded
- [ ] No crashes on Thread 9 with TurboModule exceptions

### Enhanced Features
- [ ] Permission status correctly tracked (check logs for status updates)
- [ ] Retry logic works when network is slow/unstable
- [ ] Specific error messages shown for each error type:
  - Denied permission shows device settings message
  - Simulator shows "device not supported" message
  - Network errors show connection message
  - Token errors show retry message
- [ ] `getPermissionStatus()` returns correct status
- [ ] `isNotificationEnabled()` returns true only when granted + token exists

## Additional Notes

### For Future Development
- Always request permissions in response to user actions, never during initialization
- Use `getPermissionsAsync()` to check status, `requestPermissionsAsync()` only when user opts in
- Wrap all permission requests in proper error handling
- Test on physical iOS devices (simulators don't show real permission dialogs)

### Files Modified
1. `/src/services/pushNotificationService.ts` - Core fix + enhancements
   - Added `PermissionStatus` type and tracking
   - Added `NotificationPermissionError` class
   - Implemented retry logic with exponential backoff
   - New methods: `getPermissionStatus()`, `isNotificationEnabled()`
2. `/app/_layout.tsx` - Updated initialization
3. `/src/screens/onboarding/NotificationsPermissionScreen.tsx` - Request permissions with error handling
4. `/src/components/NotificationSettingsModal.tsx` - Enhanced error handling

## Deployment

After deploying this fix:
1. Clean build the iOS app: `cd ios && xcodebuild clean`
2. Delete and reinstall the app on test devices
3. Verify no crashes on fresh install
4. Test the full onboarding flow
5. Monitor crash analytics for any remaining permission-related issues

## References

- **Crash Report**: Incident B988610A-9BF5-4139-9202-917B89B30000
- **Exception Type**: EXC_CRASH (SIGABRT)
- **Crashed Thread**: Thread 9 (React Native TurboModule)
- **Root Cause**: Premature notification permission request during app initialization

