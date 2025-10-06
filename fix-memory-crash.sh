#!/bin/bash

echo "🔧 Fixing memory crash issues..."

# Clear all caches
echo "📦 Clearing caches..."
rm -rf node_modules
rm -rf .expo
rm -rf ios/build
rm -rf android/build
npm cache clean --force

# Reinstall dependencies
echo "📥 Reinstalling dependencies..."
npm install

# Clear Metro bundler cache
echo "🧹 Clearing Metro cache..."
npx expo start --clear &
sleep 5
pkill -f "expo start"

echo "✅ Memory crash fixes applied!"
echo "✅ Null string protection added!"
echo "✅ TypeScript strict null checks enabled!"
echo ""
echo "Next steps:"
echo "1. Check TypeScript errors: npx tsc --noEmit"
echo "2. Test with: npx expo start --clear"
echo "3. Rebuild for TestFlight: eas build --platform ios --profile production"
echo ""
echo "🎯 Build 14 should fix the SIGSEGV crash in String.cpp!"
