import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration for VULU
const firebaseConfig = {
  apiKey: "AIzaSyBHL5BpkQRDe-03hE5-7TYcbr2aad1ezqg",
  authDomain: "vulugo.firebaseapp.com",
  projectId: "vulugo",
  // Correct storage bucket host for Firebase Storage
  storageBucket: "vulugo.appspot.com",
  messagingSenderId: "876918371895",
  appId: "1:876918371895:web:49d57bd00939d49889b1b2",
  measurementId: "G-LLTSS9NFCD"
};

// Firebase service instances
let app!: FirebaseApp;
let auth!: Auth;
let db!: Firestore;
let storage!: FirebaseStorage;
let functions!: Functions;

// Initialization status
let initializationAttempted = false;
let initializationError: Error | null = null;

/**
 * Initialize Firebase services with comprehensive error handling
 */
const initializeFirebase = (): { success: boolean; error?: Error } => {
  if (initializationAttempted) {
    return { success: !!app, error: initializationError };
  }

  initializationAttempted = true;

  try {
    logger.debug('🔥 Initializing Firebase services...');

    // Initialize Firebase app
    app = initializeApp(firebaseConfig);
    logger.debug('✅ Firebase app initialized');

    // Initialize Auth with AsyncStorage persistence (fallback-safe)
    try {
      // Use initializeAuth with AsyncStorage persistence for React Native
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
      logger.debug('✅ Firebase Auth initialized with AsyncStorage persistence');

      // Verify persistence is working
      logger.debug('🔄 Checking Firebase Auth persistence...');
      const currentUser = auth.currentUser;
      if (currentUser) {
        logger.debug('✅ Auth state restored from persistence:', {
          uid: currentUser.uid,
          email: currentUser.email
        });
      } else {
        logger.debug('ℹ️ No persisted auth state found (user not signed in)');
      }
    } catch (authError: any) {
      logger.error('❌ Firebase Auth initialization failed:', authError);

      // Try fallback initialization without explicit persistence
      try {
        logger.debug('🔄 Attempting fallback auth initialization...');
        auth = getAuth(app);
        logger.debug('✅ Firebase Auth initialized with fallback method');
      } catch (fallbackError) {
        logger.error('❌ Fallback auth initialization also failed:', fallbackError);
        throw authError; // Throw original error
      }
    }

    // Initialize Firestore
    db = getFirestore(app);
    logger.debug('✅ Firestore initialized');

    // Initialize Storage
    storage = getStorage(app);
    logger.debug('✅ Firebase Storage initialized');

    // Initialize Functions
    functions = getFunctions(app);
    logger.debug('✅ Firebase Functions initialized');

    // Development environment setup
    if (__DEV__) {
      logger.debug('🔧 Development mode: Firebase services ready');
      // Note: Emulator connection would go here if needed
      // connectFirestoreEmulator(db, 'localhost', 8080);
    }

    logger.debug('🎉 All Firebase services initialized successfully');
    return { success: true };

  } catch (error: any) {
    logger.error('❌ Firebase initialization failed:', error);
    initializationError = error;

    // Keep service variables uninitialized; accessors will guard usage

    return { success: false, error };
  }
};

/**
 * Get Firebase services with initialization check
 */
export const getFirebaseServices = () => {
  const result = initializeFirebase();

  if (!result.success) {
    logger.warn('⚠️ Firebase services not available:', result.error?.message);
  }

  return {
    app,
    auth,
    db,
    storage,
    functions,
    isInitialized: result.success,
    initializationError: result.error
  };
};

/**
 * Check if Firebase is properly initialized
 */
export const isFirebaseInitialized = (): boolean => {
  return !!app && !!auth && !!db && !!storage && !!functions;
};

/**
 * Get initialization status and error details
 */
export const getFirebaseStatus = () => {
  return {
    attempted: initializationAttempted,
    initialized: isFirebaseInitialized(),
    error: initializationError,
    services: {
      app: !!app,
      auth: !!auth,
      db: !!db,
      storage: !!storage,
      functions: !!functions
    }
  };
};

// Initialize Firebase immediately
const initResult = initializeFirebase();

// Initialize Firebase utilities after successful initialization
if (initResult.success) {
  // Dynamically import to avoid circular dependencies
  setTimeout(() => {
    import('../utils/firebaseOperationWrapper').then(({ default: FirebaseOperationWrapper }) => {
      try {
        FirebaseOperationWrapper.initialize();
        logger.debug('✅ Firebase utilities initialized successfully');
      } catch (error) {
        logger.warn('⚠️ Failed to initialize Firebase utilities:', error);
      }
    }).catch(error => {
      logger.warn('⚠️ Failed to import Firebase utilities:', error);
    });
  }, 100); // Small delay to ensure Firebase is fully initialized
}

// Export services (may be null if initialization failed)
export { auth, db, storage, functions };
export default app;