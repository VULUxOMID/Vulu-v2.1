import { Platform } from 'react-native';
import { logger } from '../utils/logger';
// Import GoogleSignin dynamically to avoid errors in Expo Go
let GoogleSignin: any = null;
let statusCodes: any = null;
try {
  const googleSigninModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSigninModule.GoogleSignin;
  statusCodes = googleSigninModule.statusCodes;
} catch (error) {
  logger.warn('Google Sign-In module not available (expected in Expo Go)');
}
import * as AppleAuthentication from 'expo-apple-authentication';
import { logger } from '../utils/logger';
import { signInWithCredential, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { logger } from '../utils/logger';
import { auth } from './firebase';
import { logger } from '../utils/logger';
import { firestoreService } from './firestoreService';
import { logger } from '../utils/logger';
import { authService } from './authService';
import { logger } from '../utils/logger';

export interface SocialAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: 'google' | 'apple';
}

class SocialAuthService {
  private isGoogleConfigured = false;
  private isAppleAvailable = false;

  constructor() {
    this.initializeServices();
  }

  private async initializeServices() {
    // Configure Google Sign-In
    try {
      // Check if GoogleSignin is available (development build required)
      if (!GoogleSignin || typeof GoogleSignin.configure !== 'function') {
        logger.debug('ℹ️ Google Sign-In native module not available. This is expected in Expo Go.');
        logger.debug('📱 To enable Google Sign-In, create a development build with: npx expo run:ios');
        this.isGoogleConfigured = false;
        return;
      }

      // Get client IDs from environment or config
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

      if (!webClientId) {
        logger.warn('❌ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not configured');
        this.isGoogleConfigured = false;
        return;
      }

      if (!iosClientId) {
        logger.warn('❌ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID not configured');
        this.isGoogleConfigured = false;
        return;
      }

      logger.debug('🔧 Configuring Google Sign-In...');
      GoogleSignin.configure({
        webClientId,
        iosClientId: Platform.OS === 'ios' ? iosClientId : undefined,
        offlineAccess: true,
        hostedDomain: '',
        forceCodeForRefreshToken: true,
      });
      this.isGoogleConfigured = true;
      logger.debug('✅ Google Sign-In configured successfully');
    } catch (error) {
      logger.warn('⚠️ Google Sign-In configuration failed (this is expected in Expo Go):', error);
      this.isGoogleConfigured = false;
    }

    // Check Apple Authentication availability
    if (Platform.OS === 'ios') {
      try {
        this.isAppleAvailable = await AppleAuthentication.isAvailableAsync();
        if (this.isAppleAvailable) {
          logger.debug('✅ Apple Sign-In is available');
        } else {
          logger.debug('ℹ️ Apple Sign-In is not available on this device');
        }
      } catch (error) {
        logger.warn('⚠️ Apple Authentication not available:', error);
        this.isAppleAvailable = false;
      }
    } else {
      logger.debug('ℹ️ Apple Sign-In is only available on iOS');
      this.isAppleAvailable = false;
    }
  }

  // Google Sign-In
  async signInWithGoogle(): Promise<SocialAuthUser> {
    if (!this.isGoogleConfigured) {
      throw new Error('Google Sign-In is not available in Expo Go. Please create a development build with "npx expo run:ios" to enable Google Sign-In functionality.');
    }

    try {
      logger.debug('🔄 Starting Google Sign-In process...');

      // Check if GoogleSignin methods are available
      if (!GoogleSignin.hasPlayServices || !GoogleSignin.signIn) {
        throw new Error('Google Sign-In native module not available. Development build required.');
      }

      // Check if device supports Google Play Services (Android only)
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }

      // Get user info from Google
      logger.debug('🔄 Requesting Google user info...');
      const userInfo = await GoogleSignin.signIn();

      logger.debug('✅ Google Sign-In successful, processing user data...');

      if (!userInfo.data?.idToken) {
        throw new Error('No ID token received from Google');
      }

      // Create Firebase credential
      const googleCredential = GoogleAuthProvider.credential(userInfo.data.idToken);

      // Sign in to Firebase
      logger.debug('🔄 Signing in to Firebase...');
      const userCredential = await signInWithCredential(auth, googleCredential);
      const firebaseUser = userCredential.user;

      // Clear any guest user data
      await authService.clearGuestUser();

      // Create or update user profile in Firestore
      const displayName = firebaseUser.displayName || userInfo.data.user.name || 'Google User';
      const username = `google_${firebaseUser.uid.substring(0, 8)}`;
      const userProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName,
        username,
        photoURL: firebaseUser.photoURL || userInfo.data.user.photo,
        provider: 'google' as const,
        gold: 1000, // Starting gold
        gems: 50,   // Starting gems
        level: 1,

        // Presence and status
        status: 'online' as const,
        isOnline: true,
        lastActivity: new Date(),

        // Privacy settings
        allowFriendRequests: true,
        allowMessagesFromStrangers: false,
        showOnlineStatus: true,

        // Friend system
        friends: [],
        blockedUsers: [],

        // Profile customization
        bio: '',
        customStatus: '',

        // Subscription info (default to inactive plan)
        subscriptionPlan: 'free' as const,
        subscriptionStatus: 'expired' as const,

        // Search fields (lowercase for case-insensitive search)
        displayNameLower: displayName.toLowerCase(),
        usernameLower: username.toLowerCase(),
        emailLower: (firebaseUser.email || '').toLowerCase(),

        createdAt: new Date(),
        lastSeen: new Date()
      };

      // Check if user already exists, if not create new profile
      const existingUser = await firestoreService.getUser(firebaseUser.uid);
      if (!existingUser) {
        await firestoreService.createUser(userProfile);
      } else {
        // Update last seen and any missing fields
        await firestoreService.updateUser(firebaseUser.uid, {
          lastSeen: new Date(),
          photoURL: userProfile.photoURL,
          displayName: userProfile.displayName,
        });
      }

      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        provider: 'google'
      };
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Google sign-in was cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        throw new Error('Google sign-in is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services not available');
      } else {
        throw new Error(error.message || 'Google sign-in failed');
      }
    }
  }

  // Apple Sign-In
  async signInWithApple(): Promise<SocialAuthUser> {
    if (!this.isAppleAvailable) {
      throw new Error('Apple Sign-In is not available on this device. Please ensure you are running on iOS 13+ and have Apple Sign-In enabled.');
    }

    try {
      logger.debug('🔄 Starting Apple Sign-In process...');

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      logger.debug('✅ Apple Sign-In successful, processing user data...');

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      // Create Firebase credential
      const provider = new OAuthProvider('apple.com');
      const appleCredential = provider.credential({
        idToken: credential.identityToken,
        rawNonce: undefined, // You might want to implement nonce for additional security
      });

      // Sign in to Firebase
      logger.debug('🔄 Signing in to Firebase...');
      const userCredential = await signInWithCredential(auth, appleCredential);
      const firebaseUser = userCredential.user;

      // Clear any guest user data
      await authService.clearGuestUser();

      // Apple might not provide email/name on subsequent sign-ins
      const displayName = credential.fullName 
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : firebaseUser.displayName || 'Apple User';

      // Create or update user profile in Firestore
      const username = `apple_${firebaseUser.uid.substring(0, 8)}`;
      const userProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || credential.email,
        displayName,
        username,
        photoURL: firebaseUser.photoURL,
        provider: 'apple' as const,
        gold: 1000, // Starting gold
        gems: 50,   // Starting gems
        level: 1,

        // Presence and status
        status: 'online' as const,
        isOnline: true,
        lastActivity: new Date(),

        // Privacy settings
        allowFriendRequests: true,
        allowMessagesFromStrangers: false,
        showOnlineStatus: true,

        // Friend system
        friends: [],
        blockedUsers: [],

        // Profile customization
        bio: '',
        customStatus: '',

        // Subscription info (default to inactive plan)
        subscriptionPlan: 'free' as const,
        subscriptionStatus: 'expired' as const,

        // Search fields (lowercase for case-insensitive search)
        displayNameLower: displayName.toLowerCase(),
        usernameLower: username.toLowerCase(),
        emailLower: (firebaseUser.email || credential.email || '').toLowerCase(),

        createdAt: new Date(),
        lastSeen: new Date()
      };

      // Check if user already exists, if not create new profile
      const existingUser = await firestoreService.getUser(firebaseUser.uid);
      if (!existingUser) {
        await firestoreService.createUser(userProfile);
      } else {
        // Update last seen and any missing fields
        await firestoreService.updateUser(firebaseUser.uid, {
          lastSeen: new Date(),
          displayName: userProfile.displayName,
        });
      }

      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        provider: 'apple'
      };
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        throw new Error('Apple sign-in was cancelled');
      } else {
        throw new Error(error.message || 'Apple sign-in failed');
      }
    }
  }

  // Sign out from social providers
  async signOut(): Promise<void> {
    try {
      // Sign out from Google if configured
      if (this.isGoogleConfigured) {
        const isSignedIn = await GoogleSignin.isSignedIn();
        if (isSignedIn) {
          await GoogleSignin.signOut();
        }
      }
      
      // Note: Apple doesn't require explicit sign-out
      // The Firebase sign-out will handle the session
    } catch (error) {
      logger.warn('Error signing out from social providers:', error);
      // Don't throw error as Firebase sign-out is more important
    }
  }

  // Check availability of social auth methods
  getAvailableMethods(): { google: boolean; apple: boolean } {
    return {
      google: this.isGoogleConfigured,
      apple: this.isAppleAvailable,
    };
  }

  // Get current Google user info (if signed in)
  async getCurrentGoogleUser() {
    if (!this.isGoogleConfigured) return null;
    
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        return await GoogleSignin.getCurrentUser();
      }
      return null;
    } catch (error) {
      logger.warn('Error getting current Google user:', error);
      return null;
    }
  }
}

export const socialAuthService = new SocialAuthService();
export default socialAuthService;
