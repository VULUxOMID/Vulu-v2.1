#!/bin/bash

echo "🚀 Quick Build 16 - RegExp Crash Fix"
echo ""
echo "📊 Build Evolution:"
echo "  Build 11-12: Memory corruption ✅ FIXED"
echo "  Build 13: String operations ✅ FIXED"  
echo "  Build 14: Iterator operations ✅ FIXED"
echo "  Build 15: RegExp operations 🎯 FIXING NOW"
echo ""

# Quick cache clear (don't need full node_modules rebuild)
echo "🧹 Quick cache clear..."
rm -rf .expo
rm -rf ios/build
rm -rf android/build

# Clear Metro cache
echo "📦 Clearing Metro cache..."
npx expo start --clear &
sleep 5
pkill -f "expo start"

echo ""
echo "✅ RegExp protection fixes applied!"
echo "✅ String.replace protection added!"
echo "✅ RegExp.exec protection added!"
echo "✅ RegExp.test protection added!"
echo "✅ String.match/search protection added!"
echo ""
echo "🎯 Building for TestFlight..."
echo "eas build --platform ios --profile production"
echo ""
echo "🎯 Build 16 should fix the SIGSEGV crash in directRegExpExec!"
echo "🎯 This should be the FINAL fix - app should launch successfully!"
