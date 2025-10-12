# Social Authentication Setup Guide

## Current Status

✅ **Apple Sign-In**: Configured and ready (iOS only)  
⚠️ **Google Sign-In**: Requires development build (not available in Expo Go)

## Quick Setup for Development Build

### 1. Create Development Build (Required for Google Sign-In)

```bash
# Install EAS CLI if not already installed
npm install -g @expo/eas-cli

# Login to Expo
eas login

# Create development build for iOS
eas build --profile development --platform ios

# Or run locally (faster)
npx expo run:ios
```

### 2. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select your project
3. Enable Google Sign-In API
4. Create OAuth 2.0 credentials:
   - **Web client ID**: Already configured in `.env`
   - **iOS client ID**: Already configured in `.env`

### 3. Firebase Console Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`vulugo`)
3. Go to Authentication > Sign-in method
4. Enable Google and Apple sign-in providers
5. Download configuration files (already created):
   - `GoogleService-Info.plist` (iOS)
   - `google-services.json` (Android)

## Current Configuration

### Environment Variables (`.env`)
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=176096572047-saokihc7oia244st68eral7qui0uilbf.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=176096572047-g13t9sq1bi2oih8ih8l17o80qft03ugt.apps.googleusercontent.com
```

### App Configuration (`app.json`)
```json
{
  "plugins": [
    "@react-native-google-signin/google-signin",
    "expo-apple-authentication"
  ],
  "ios": {
    "usesAppleSignIn": true,
    "googleServicesFile": "./GoogleService-Info.plist"
  },
  "android": {
    "googleServicesFile": "./google-services.json"
  }
}
```

## Testing Social Authentication

### In Expo Go (Current)
- ❌ Google Sign-In: Not available (shows helpful message)
- ✅ Apple Sign-In: Available on iOS 13+ devices
- ✅ Email/Password: Fully functional

### In Development Build
- ✅ Google Sign-In: Fully functional
- ✅ Apple Sign-In: Fully functional
- ✅ Email/Password: Fully functional

## User Experience

The app now provides clear feedback when social authentication is not available:

1. **Expo Go**: Shows informative message about development build requirement
2. **Development Build**: Full social authentication functionality
3. **Fallback**: Email/password authentication always available

## Error Handling

The app includes comprehensive error handling for:
- Missing native modules
- Configuration issues
- Network problems
- User cancellation
- Platform limitations

## Next Steps

1. **For Testing**: Use email/password authentication in Expo Go
2. **For Full Features**: Create development build with `npx expo run:ios`
3. **For Production**: Use `eas build` for production builds

## Troubleshooting

### Google Sign-In Issues
- Ensure you're using a development build
- Check that client IDs are correctly configured
- Verify Firebase project settings

### Apple Sign-In Issues
- Only available on iOS 13+
- Requires physical device or iOS 13+ simulator
- Check Apple Developer account settings

### General Issues
- Clear Metro cache: `npx expo start --clear`
- Restart development build
- Check console logs for detailed error messages
