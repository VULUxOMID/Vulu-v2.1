## VULU

A social streaming app with real-time chat, direct messages, and Discord-style dark UI. Built with React Native + Expo and Firebase.

### What you can do
- Create an account or continue as guest
- Join or host live audio rooms (dev build required for real audio)
- Chat in global channels and send direct messages
- Manage profiles; messaging shows consistent names/avatars

---

## Quick Start

Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI

Install & run
1. Clone this repo
2. Install dependencies
   - npm install
3. Start the app (Expo Go)
   - npx expo start

For real audio streaming (dev client)
- Build dev clients (includes native SDKs)
  - eas build --profile development --platform ios
  - eas build --profile development --platform android
- Run with dev client
  - npx expo start --dev-client

---

## Firebase Setup (required)
- Create a Firebase project (Auth, Firestore, Storage)
- **Enable Auth providers**: Email/Password, Google, Apple (iOS)
- **Enable App Check**: Use reCAPTCHA v3 for production or Debug provider for development
- **Add config**: Place Firebase config in `src/services/firebase.ts` (avoid public/unsafe defaults)
- **Publish Security Rules**: Deploy rules from `firestore.rules` file before seeding test data
- **Create indexes**: Create necessary indexes when console prompts appear

Recommended indexes
- conversations/{conversationId}/messages: isDeleted (ASC), timestamp (DESC)
- conversations: participants (ARRAY), lastMessageTime (DESC)
- friendRequests: recipientId (ASC), status (ASC), createdAt (DESC)
- friendRequests: senderId (ASC), status (ASC), createdAt (DESC)
- streams: isActive (ASC), startedAt (ASC)
- streams: isActive (ASC), endedAt (ASC)

---

## Scripts
- npm start: start Expo
- npm run ios: iOS simulator
- npm run android: Android emulator
- npm run web: web preview

---

## Notes
- Expo Go uses mock audio; build a dev client for live audio
- Profile changes (name/avatar) sync across chats and conversations
- Input is sanitized; very long messages are limited

---

## Tech
- React Native, Expo
- Firebase (Auth, Firestore, Storage)
- Discord-style dark theme

---

## License
Licensed under the MIT License; see [LICENSE](LICENSE) for details.
