#!/bin/bash

# Navigation Migration Script
# Converts expo-router to React Navigation across all screen files

echo "🔄 Starting navigation migration..."
echo "📊 Files to migrate: 23"

# List of files that use expo-router
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

MIGRATED=0

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "📝 Migrating: $file"
    
    # 1. Replace expo-router imports with React Navigation
    # Replace: import { useRouter } from 'expo-router';
    # With: import { useNavigation } from '@react-navigation/native';
    sed -i '' "s/import { useRouter } from 'expo-router';/import { useNavigation } from '@react-navigation\/native';/g" "$file"
    
    # Replace: import { router } from 'expo-router';
    # With: import { useNavigation } from '@react-navigation/native';
    sed -i '' "s/import { router } from 'expo-router';/import { useNavigation } from '@react-navigation\/native';/g" "$file"
    
    # Replace: import { useRouter, useLocalSearchParams } from 'expo-router';
    # With: import { useNavigation, useRoute } from '@react-navigation/native';
    sed -i '' "s/import { useRouter, useLocalSearchParams } from 'expo-router';/import { useNavigation, useRoute } from '@react-navigation\/native';/g" "$file"
    
    # Replace: import { router, useLocalSearchParams } from 'expo-router';
    # With: import { useNavigation, useRoute } from '@react-navigation/native';
    sed -i '' "s/import { router, useLocalSearchParams } from 'expo-router';/import { useNavigation, useRoute } from '@react-navigation\/native';/g" "$file"
    
    MIGRATED=$((MIGRATED + 1))
  else
    echo "⚠️  File not found: $file"
  fi
done

echo ""
echo "✅ Migration complete!"
echo "📊 Files migrated: $MIGRATED/23"
echo ""
echo "⚠️  MANUAL STEPS REQUIRED:"
echo "1. Replace 'router.push()' → 'navigation.navigate()' in each file"
echo "2. Replace 'router.back()' → 'navigation.goBack()' in each file"
echo "3. Replace 'useLocalSearchParams()' → 'route.params' in each file"
echo "4. Add 'const navigation = useNavigation();' where useRouter() was used"
echo "5. Add 'const route = useRoute();' where useLocalSearchParams() was used"
echo ""
echo "Run 'npm run type-check' to find remaining issues"

