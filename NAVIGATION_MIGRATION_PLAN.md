# Navigation Migration: expo-router → React Navigation

## Current State Analysis

### Dual Navigation System
- **expo-router**: `app/` directory with file-based routing
- **React Navigation**: `src/navigation/MainNavigator.tsx` with stack-based routing
- **Entry Point**: `package.json` → `"main": "expo-router/entry"`

### Files Using expo-router (23 files)
```
app/index.tsx
app/_layout.tsx
app/(main)/_layout.tsx
app/auth.tsx
app/auth/selection.tsx
src/screens/ChatScreen.tsx
src/screens/HomeScreen.tsx
src/screens/LiveScreen.tsx
src/screens/LiveStreamView.tsx
src/screens/DirectMessagesScreen.tsx
src/screens/AccountScreen.tsx
src/screens/AddFriendsScreen.tsx
src/screens/DiscordThemeDemo.tsx
src/screens/LiveStreamSetupScreen.tsx
src/screens/UserSearchScreen.tsx
src/screens/auth/** (5 files)
src/screens/ProfileScreen.tsx
src/screens/NotificationsScreen.tsx
src/screens/FriendRequestsScreen.tsx
src/screens/SubscriptionScreen.tsx
src/screens/LiveStreamViewSimple.tsx
src/screens/CloseFriendsScreen.tsx
src/screens/onboarding/HomeHandoffScreen.tsx
src/screens/MiningScreen.tsx
src/screens/NotificationSettingsScreen.tsx
src/screens/ViewerInfoScreen.tsx
```

## Migration Strategy

### Phase 1: Update Entry Point ✅
1. Change `package.json` main: `expo-router/entry` → `index.js`
2. Create `index.js` with React Navigation App wrapper

### Phase 2: Create Root Navigator ✅
1. Consolidate `src/navigation/MainNavigator.tsx` + `app/_layout.tsx`
2. Add auth flow (login/signup/guest)
3. Add main app flow (tabs + stack)

### Phase 3: Migrate Screen Files (23 files) 🔄
Replace:
```tsx
// BEFORE
import { router, useLocalSearchParams } from 'expo-router';
const params = useLocalSearchParams();
router.push('/path');
router.back();

// AFTER
import { useNavigation, useRoute } from '@react-navigation/native';
const navigation = useNavigation();
const route = useRoute();
const params = route.params;
navigation.navigate('ScreenName', params);
navigation.goBack();
```

### Phase 4: Remove app/ Directory ✅
- Archive `app/` → `app.old/` for reference
- Keep if needed for deep linking config

### Phase 5: Test & Validate ✅
- Auth flow (signup, login, guest)
- Main navigation (tabs, stack)
- Deep linking
- Back button behavior

## Implementation Steps

### Step 1: Create New Entry Point
```javascript
// index.js
import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
```

### Step 2: Create App.tsx
```tsx
// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import RootNavigator from './src/navigation/RootNavigator';
// ... all providers

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* All context providers */}
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

### Step 3: Update package.json
```json
{
  "main": "index.js",  // Changed from "expo-router/entry"
}
```

### Step 4: Migrate Each Screen
For each file in the 23-file list:
1. Remove expo-router imports
2. Add React Navigation imports
3. Replace `router.*` calls with `navigation.*`
4. Replace `useLocalSearchParams()` with `route.params`
5. Test navigation flow

## Risk Mitigation

### Backup Strategy
1. Create `app.old/` backup before deletion
2. Git commit after each phase
3. Keep fallback router in `HomeScreen.tsx` temporarily

### Testing Checklist
- [ ] Auth: Signup flow complete
- [ ] Auth: Login flow complete
- [ ] Auth: Guest mode works
- [ ] Navigation: Tab switching works
- [ ] Navigation: Stack navigation works
- [ ] Navigation: Back button works
- [ ] Navigation: Deep links work
- [ ] Streaming: Live stream navigation works
- [ ] Chat: Chat screen navigation works
- [ ] Profile: Profile navigation works

## Rollback Plan
If migration fails:
1. Revert `package.json` main to `expo-router/entry`
2. Restore `app/` directory
3. Keep existing dual-navigation state

## Time Estimate
- Phase 1-2: 1 hour (entry point, root navigator)
- Phase 3: 4-5 hours (23 files, ~15 min each)
- Phase 4-5: 2 hours (cleanup, testing)
**Total: 7-8 hours**

---

*Document created: 2025-10-12*
*Migration started: Now*

