import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  updatePassword,
  updateEmail,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  sendEmailVerification,
  applyActionCode,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { auth, getFirebaseServices, isFirebaseInitialized } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestoreService } from './firestoreService';
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/storageUtils';
import FirebaseErrorHandler from '../utils/firebaseErrorHandler';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isGuest?: boolean;
}

// Guest user interface
export interface GuestUser {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string;
  isGuest: true;
  guestId: string;
}

class AuthService {
  // In-memory storage for guest user (will be lost on app restart)
  private guestUserStorage: GuestUser | null = null;
  private readonly GUEST_USER_KEY = '@vulugo_guest_user';

  // Generate unique guest ID
  private generateGuestId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `guest_${timestamp}_${randomStr}`;
  }

  // Check if Firebase is ready for authentication operations
  private ensureFirebaseReady(): void {
    if (!isFirebaseInitialized()) {
      const status = getFirebaseServices();
      if (!status.isInitialized) {
        throw new Error(`Firebase not initialized: ${status.initializationError?.message || 'Unknown error'}`);
      }
    }
  }

  // Persist guest user to AsyncStorage
  private async persistGuestUser(guestUser: GuestUser): Promise<void> {
    const result = await safeSetItem(this.GUEST_USER_KEY, JSON.stringify(guestUser));
    if (!result.success) {
      console.warn('Failed to persist guest user:', result.error);
      // In development environment, this is expected and not critical
      if (result.error?.includes('Development environment')) {
        console.info('Guest user will be stored in memory only (development limitation)');
      }
    }
  }

  // Validate guest user data structure
  private isValidGuestUser(data: any): data is GuestUser {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.uid === 'string' &&
      typeof data.displayName === 'string' &&
      typeof data.photoURL === 'string' &&
      data.isGuest === true &&
      typeof data.guestId === 'string' &&
      data.uid.startsWith('guest_')
    );
  }

  // Load guest user from AsyncStorage with validation
  private async loadPersistedGuestUser(): Promise<GuestUser | null> {
    const result = await safeGetItem(this.GUEST_USER_KEY);

    if (!result.success) {
      if (result.error && !result.error.includes('Development environment')) {
        console.warn('Failed to load persisted guest user:', result.error);
      }
      return null;
    }

    if (!result.data) return null;

    try {
      const parsed = JSON.parse(result.data);

      // Validate the parsed data structure
      if (!this.isValidGuestUser(parsed)) {
        console.warn('Invalid guest user data found in storage, clearing...');
        await this.clearPersistedGuestUser();
        return null;
      }

      return parsed;
    } catch (parseError) {
      console.warn('Failed to parse persisted guest user:', parseError);
      // Clear corrupted data
      await this.clearPersistedGuestUser();
      return null;
    }
  }

  // Clear persisted guest user
  private async clearPersistedGuestUser(): Promise<void> {
    const result = await safeRemoveItem(this.GUEST_USER_KEY);
    if (!result.success && result.error && !result.error.includes('Development environment')) {
      console.warn('Failed to clear persisted guest user:', result.error);
    }
  }

  // Sign in as guest
  async signInAsGuest(): Promise<GuestUser> {
    try {
      const guestId = this.generateGuestId();
      const guestUser: GuestUser = {
        uid: guestId,
        email: null,
        displayName: 'Guest',
        photoURL: null, // No default avatar
        isGuest: true,
        guestId: guestId
      };

      // Store guest user in memory and persist to AsyncStorage
      this.guestUserStorage = guestUser;
      await this.persistGuestUser(guestUser);

      return guestUser;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  // Get guest user from memory or AsyncStorage
  async getGuestUser(): Promise<GuestUser | null> {
    // First check memory
    if (this.guestUserStorage) {
      return this.guestUserStorage;
    }

    // Then check AsyncStorage
    const persisted = await this.loadPersistedGuestUser();
    if (persisted) {
      this.guestUserStorage = persisted;
      return persisted;
    }

    return null;
  }

  // Clear guest user data
  async clearGuestUser(): Promise<void> {
    this.guestUserStorage = null;
    await this.clearPersistedGuestUser();
  }

  // Check if current user is guest
  isGuestUser(user: User | GuestUser | null): boolean {
    if (!user) return false;
    return 'isGuest' in user && user.isGuest === true;
  }

  // Sign up with email and password
  async signUp(email: string, password: string, displayName?: string, username?: string): Promise<AuthUser> {
    try {
      this.ensureFirebaseReady();

      if (!auth) {
        throw new Error('Firebase Auth not available');
      }

      // Validate input parameters
      if (!email || !email.trim()) {
        throw new Error('Email is required');
      }
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      console.log('🔄 Starting signup process...', {
        email: email.trim(),
        hasDisplayName: !!displayName,
        hasUsername: !!username
      });

      // Check if username is already taken (if provided) with circuit breaker protection
      if (username) {
        try {
          const isUsernameTaken = await firestoreService.isUsernameTaken(username);
          if (isUsernameTaken) {
            const error = new Error('Username is already taken. Please choose a different one.');
            (error as any).code = 'auth/username-already-in-use';
            throw error;
          }
        } catch (usernameError: any) {
          // If it's our custom username error, re-throw it
          if (usernameError.code === 'auth/username-already-in-use') {
            throw usernameError;
          }

          // For any other username check errors, re-throw them to prevent registration
          // This ensures users get proper error messages instead of crashes
          console.error('Username availability check failed:', usernameError.message);
          const error = new Error('Unable to verify username availability. Please try again.');
          (error as any).code = 'auth/username-check-failed';
          throw error;
        }
      }

      // Use circuit breaker protection for auth operations
      const userCredential = await FirebaseErrorHandler.executeWithProtection(async () => {
        return await createUserWithEmailAndPassword(auth, email.trim(), password);
      }, 'auth');

      const user = userCredential.user;
      console.log('✅ Firebase user created successfully:', user.uid);

      // Update profile with display name if provided
      if (displayName) {
        try {
          await updateProfile(user, { displayName: displayName.trim() });
          console.log('✅ User profile updated with display name');
        } catch (profileError) {
          console.warn('Failed to update user profile:', profileError);
          // Don't fail the signup for profile update errors
        }
      }

      // Create user profile in Firestore with username and messaging fields
      const userProfile = {
        uid: user.uid,
        email: user.email,
        displayName: displayName || user.displayName || 'User',
        username: username || `user_${user.uid.substring(0, 8)}`, // Generate username if not provided
        photoURL: user.photoURL,
        gold: 0, // Starting gold
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
        displayNameLower: (displayName || user.displayName || 'User').toLowerCase(),
        usernameLower: (username || `user_${user.uid.substring(0, 8)}`).toLowerCase(),
        emailLower: (user.email || '').toLowerCase(),

        createdAt: new Date(),
        lastSeen: new Date()
      };

      await firestoreService.createUser(userProfile);

      // Clear any guest user data when signing up
      await this.clearGuestUser();

      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      };
    } catch (error: any) {
      console.error('❌ signUp failed:', {
        errorCode: error.code,
        errorMessage: error.message,
        email: email?.trim(),
        hasDisplayName: !!displayName,
        hasUsername: !!username
      });

      // Re-throw the original error to preserve Firebase error codes
      // This ensures proper error handling in the UI components
      throw error;
    }
  }

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<AuthUser> {
    try {
      this.ensureFirebaseReady();

      if (!auth) {
        throw new Error('Firebase Auth not available');
      }

      // DIAGNOSTIC: Enhanced logging for authentication debugging
      console.log('🔐 AuthService.signIn called:', {
        email: email,
        emailLength: email.length,
        passwordLength: password.length,
        authDomain: auth.config.authDomain,
        timestamp: new Date().toISOString()
      });

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log('✅ AuthService.signIn successful:', {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName
      });

      // Clear any guest user data when signing in
      await this.clearGuestUser();

      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      };
    } catch (error: any) {
      // DIAGNOSTIC: Enhanced error logging
      console.error('❌ AuthService.signIn failed:', {
        errorCode: error.code,
        errorMessage: error.message,
        email: email,
        emailDomain: email.split('@')[1],
        timestamp: new Date().toISOString()
      });

      // Re-throw the original error to preserve error codes
      throw error;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      // Clear guest user data if signing out
      await this.clearGuestUser();
      await signOut(auth);
    } catch (error: any) {
      console.error('signOut failed:', error);
      throw new Error('Failed to sign out. Please try again.');
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    return auth.currentUser;
  }

  // Listen to auth state changes with enhanced persistence support
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    console.log('🔄 Setting up Firebase auth state listener...');

    return onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('✅ Firebase auth state restored:', {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          displayName: user.displayName
        });
      } else {
        console.log('🚫 No Firebase user found in auth state');
      }

      callback(user);
    });
  }

  // Check if user should remain authenticated (for session persistence)
  shouldMaintainSession(): boolean {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    // Check if user was recently active (within last 30 days)
    const lastSignInTime = currentUser.metadata.lastSignInTime;
    if (lastSignInTime) {
      const lastSignIn = new Date(lastSignInTime);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return lastSignIn > thirtyDaysAgo;
    }

    return true; // Default to maintaining session
  }

  // Check if email is already registered
  async isEmailRegistered(email: string): Promise<boolean> {
    try {
      this.ensureFirebaseReady();

      if (!auth) {
        throw new Error('Firebase Auth not available');
      }

      console.log('🔄 Checking if email is registered:', email);

      // Use Firebase's fetchSignInMethodsForEmail to check if email exists
      const signInMethods = await fetchSignInMethodsForEmail(auth, email.trim());
      const isRegistered = signInMethods.length > 0;

      console.log('✅ Email registration check result:', { email, isRegistered, methods: signInMethods });
      return isRegistered;
    } catch (error: any) {
      console.error('❌ Email registration check failed:', error);

      // If it's a network error or permission error, assume email is available
      if (error.code === 'auth/network-request-failed' ||
          error.code === 'auth/too-many-requests' ||
          FirebaseErrorHandler.isPermissionError(error)) {
        console.warn('Network/permission error during email check, assuming email is available');
        return false;
      }

      // For other errors, assume email is available to avoid blocking registration
      return false;
    }
  }

  // Update user password
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      this.ensureFirebaseReady();

      if (!auth || !auth.currentUser) {
        throw new Error('No authenticated user found');
      }

      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Get user email from user object or provider data
      let userEmail = user.email;
      if (!userEmail && user.providerData && user.providerData.length > 0) {
        userEmail = user.providerData[0].email;
      }

      if (!userEmail) {
        throw new Error('No email address found for user. Cannot update password.');
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(userEmail, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        throw new Error('Current password is incorrect');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('New password is too weak');
      } else {
        throw new Error(error.message || 'Failed to update password');
      }
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      this.ensureFirebaseReady();

      if (!auth) {
        throw new Error('Firebase Auth not available');
      }

      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email address');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many password reset attempts. Please try again later');
      } else {
        throw new Error(error.message || 'Failed to send password reset email');
      }
    }
  }

  // Verify password reset code
  async verifyPasswordResetCode(code: string): Promise<string> {
    try {
      this.ensureFirebaseReady();

      if (!auth) {
        throw new Error('Firebase Auth not available');
      }

      const email = await verifyPasswordResetCode(auth, code);
      return email;
    } catch (error: any) {
      if (error.code === 'auth/invalid-action-code') {
        throw new Error('Invalid or expired reset code');
      } else if (error.code === 'auth/expired-action-code') {
        throw new Error('Reset code has expired. Please request a new one');
      } else {
        throw new Error(error.message || 'Failed to verify reset code');
      }
    }
  }

  // Confirm password reset with new password
  async confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    try {
      this.ensureFirebaseReady();

      if (!auth) {
        throw new Error('Firebase Auth not available');
      }

      await confirmPasswordReset(auth, code, newPassword);
    } catch (error: any) {
      if (error.code === 'auth/invalid-action-code') {
        throw new Error('Invalid or expired reset code');
      } else if (error.code === 'auth/expired-action-code') {
        throw new Error('Reset code has expired. Please request a new one');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('New password is too weak. Please choose a stronger password');
      } else {
        throw new Error(error.message || 'Failed to reset password');
      }
    }
  }

  // Send email verification
  async sendEmailVerification(): Promise<void> {
    try {
      this.ensureFirebaseReady();

      if (!auth || !auth.currentUser) {
        throw new Error('No authenticated user found');
      }

      const user = auth.currentUser;
      await sendEmailVerification(user);
    } catch (error: any) {
      if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many verification emails sent. Please try again later');
      } else {
        throw new Error(error.message || 'Failed to send verification email');
      }
    }
  }

  // Verify email with action code
  async verifyEmail(code: string): Promise<void> {
    try {
      this.ensureFirebaseReady();

      if (!auth) {
        throw new Error('Firebase Auth not available');
      }

      await applyActionCode(auth, code);
    } catch (error: any) {
      if (error.code === 'auth/invalid-action-code') {
        throw new Error('Invalid or expired verification code');
      } else if (error.code === 'auth/expired-action-code') {
        throw new Error('Verification code has expired. Please request a new one');
      } else {
        throw new Error(error.message || 'Failed to verify email');
      }
    }
  }

  // Check if current user's email is verified
  isEmailVerified(): boolean {
    return auth?.currentUser?.emailVerified ?? false;
  }

  // Update user email
  async updateEmail(newEmail: string, currentPassword: string): Promise<void> {
    try {
      this.ensureFirebaseReady();

      if (!auth || !auth.currentUser) {
        throw new Error('No authenticated user found');
      }

      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Get user email from user object or provider data
      let userEmail = user.email;
      if (!userEmail && user.providerData && user.providerData.length > 0) {
        userEmail = user.providerData[0].email;
      }

      if (!userEmail) {
        throw new Error('No email address found for user. Cannot update email.');
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(userEmail, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update email
      await updateEmail(user, newEmail);

      // Update email in Firestore
      await firestoreService.updateUser(user.uid, { email: newEmail });

      // Send verification email to new address
      await sendEmailVerification(user);
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        throw new Error('Current password is incorrect');
      } else if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email address is already in use by another account');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address');
      } else if (error.code === 'auth/requires-recent-login') {
        throw new Error('Please sign out and sign back in before changing your email');
      } else {
        throw new Error(error.message || 'Failed to update email');
      }
    }
  }

  // Delete user account
  async deleteAccount(currentPassword: string): Promise<void> {
    try {
      this.ensureFirebaseReady();

      if (!auth || !auth.currentUser) {
        throw new Error('No authenticated user found');
      }

      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Get user email from user object or provider data
      let userEmail = user.email;
      if (!userEmail && user.providerData && user.providerData.length > 0) {
        userEmail = user.providerData[0].email;
      }

      if (!userEmail) {
        throw new Error('No email address found for user. Cannot delete account.');
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(userEmail, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Delete user data from Firestore first
      await firestoreService.deleteUser(user.uid);

      // Delete the Firebase Auth user
      await deleteUser(user);

      // Clear any guest user data
      await this.clearGuestUser();
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        throw new Error('Current password is incorrect');
      } else if (error.code === 'auth/requires-recent-login') {
        throw new Error('Please sign out and sign back in before deleting your account');
      } else {
        throw new Error(error.message || 'Failed to delete account');
      }
    }
  }
}

export const authService = new AuthService();
export default authService; 