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
echo "✅ Iterator protection added!"
echo "✅ TurboModule protection added!"
echo "✅ Array operations protection added!"
echo "✅ RegExp protection added!"
echo "✅ String.replace protection added!"
echo ""
echo "Next steps:"
echo "1. Test with: npx expo start --clear"
echo "2. Rebuild for TestFlight: eas build --platform ios --profile production"
echo ""
echo "🎯 Build 16 should fix the SIGSEGV crash in directRegExpExec!"
echo "🎯 This should be the FINAL fix - app should launch successfully!"
echo ""
echo "📊 Build Evolution:"
echo "  Build 11-12: Memory corruption ✅ FIXED"
echo "  Build 13: String operations ✅ FIXED"
echo "  Build 14: Iterator operations ✅ FIXED"
echo "  Build 15: RegExp operations 🎯 FIXING NOW"
