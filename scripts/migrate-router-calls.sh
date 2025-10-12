#!/bin/bash

# Phase 2: Replace router method calls with navigation
# This handles the actual router.push/back/etc calls

echo "🔄 Phase 2: Migrating router method calls..."

FILES=(
  "src/screens/auth/AuthSelectionScreen.tsx"
  "src/screens/ChatScreen.tsx"
  "src/screens/LiveScreen.tsx"
  "src/screens/LiveStreamView.tsx"
  "src/screens/DirectMessagesScreen.tsx"
  "src/screens/AccountScreen.tsx"
  "src/screens/AddFriendsScreen.tsx"
  "src/screens/DiscordThemeDemo.tsx"
  "src/screens/LiveStreamSetupScreen.tsx"
  "src/screens/HomeScreen.tsx"
  "src/screens/UserSearchScreen.tsx"
  "src/screens/auth/registration/DateOfBirthScreen.tsx"
  "src/screens/ProfileScreen.tsx"
  "src/screens/NotificationsScreen.tsx"
  "src/screens/FriendRequestsScreen.tsx"
  "src/screens/SubscriptionScreen.tsx"
  "src/screens/LiveStreamViewSimple.tsx"
  "src/screens/CloseFriendsScreen.tsx"
  "src/screens/onboarding/HomeHandoffScreen.tsx"
  "src/screens/auth/NewAuthScreen.tsx"
  "src/screens/MiningScreen.tsx"
  "src/screens/NotificationSettingsScreen.tsx"
  "src/screens/ViewerInfoScreen.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "📝 Processing: $file"
    
    # Add navigation and route hooks after imports if file uses router
    # This is a simplified approach - we'll add them at component start
    
    # Replace router.back() → navigation.goBack()
    sed -i '' 's/router\.back()/navigation.goBack()/g' "$file"
    
    # Replace router.push( → navigation.navigate(
    sed -i '' 's/router\.push(/navigation.navigate(/g' "$file"
    
    # Replace router.replace( → navigation.replace(
    sed -i '' 's/router\.replace(/navigation.replace(/g' "$file"
    
    # Replace useLocalSearchParams() → route.params
    sed -i '' 's/const params = useLocalSearchParams();/const route = useRoute();\n  const params = route.params || {};/g' "$file"
    
    # Replace const router = useRouter() → const navigation = useNavigation()
    sed -i '' 's/const router = useRouter();/const navigation = useNavigation();/g' "$file"
    
    # Replace let router; try { router = useRouter() → const navigation = useNavigation()
    sed -i '' 's/let router;/\/\/ Navigation migrated to React Navigation/g' "$file"
    sed -i '' 's/router = useRouter();/const navigation = useNavigation();/g' "$file"
    
  fi
done

echo "✅ Phase 2 complete!"
echo ""
echo "🔍 Checking for remaining expo-router references..."
grep -r "expo-router" src/screens --include="*.tsx" || echo "✅ No expo-router imports found!"
echo ""
echo "🔍 Checking for remaining 'router\\.' calls..."
grep -r "router\\..*\(" src/screens --include="*.tsx" | head -20 || echo "✅ No router calls found!"

