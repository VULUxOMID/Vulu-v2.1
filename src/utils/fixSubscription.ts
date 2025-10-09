import { auth, db } from '../services/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

/**
 * Fix subscription system by creating missing documents and fields
 */
export const fixSubscription = async (): Promise<void> => {
  try {
    console.log('🔧 [FIX] Starting subscription fix...');
    
    if (!auth.currentUser) {
      console.warn('⚠️ No authenticated user found');
      return;
    }
    
    const userId = auth.currentUser.uid;
    console.log(`👤 Fixing subscription for user: ${userId}`);
    
    // 1. Check and fix user profile
    console.log('🔄 Step 1: Checking user profile...');
    const userProfileRef = doc(db, 'users', userId);
    const userProfileSnap = await getDoc(userProfileRef);
    
    if (userProfileSnap.exists()) {
      const userData = userProfileSnap.data();
      console.log('✅ User profile exists');
      
      // Check if subscription fields exist
      if (!userData.subscriptionPlan || !userData.subscriptionStatus) {
        console.log('🔄 Adding missing subscription fields to user profile...');
        await updateDoc(userProfileRef, {
          subscriptionPlan: 'free',
          subscriptionStatus: 'active'
        });
        console.log('✅ Added subscription fields to user profile');
      } else {
        console.log('✅ User profile already has subscription fields');
      }
    } else {
      console.error('❌ User profile does not exist');
      return;
    }
    
    // 2. Check and create userSubscriptions document
    console.log('🔄 Step 2: Checking userSubscriptions document...');
    const subscriptionRef = doc(db, 'userSubscriptions', userId);
    const subscriptionSnap = await getDoc(subscriptionRef);
    
    if (!subscriptionSnap.exists()) {
      console.log('🔄 Creating userSubscriptions document...');
      const defaultSubscription = {
        userId: userId,
        plan: 'free',
        status: 'active',
        startDate: new Date(),
        endDate: null,
        features: {
          dailyGems: 10,
          maxStreams: 1,
          prioritySupport: false,
          customEmojis: false
        },
        billing: {
          cycle: null,
          amount: 0,
          currency: 'USD',
          nextBillingDate: null
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(subscriptionRef, defaultSubscription);
      console.log('✅ Created userSubscriptions document');
    } else {
      console.log('✅ userSubscriptions document already exists');
    }
    
    console.log('🎉 Subscription fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Failed to fix subscription:', error);
  }
};

// Make it available globally for debugging
try {
  if (typeof window !== 'undefined') {
    (window as any).fixSubscription = fixSubscription;
    console.log('🔧 [FIX] Subscription fix function available (window):');
    console.log('  - fixSubscription() - Fix subscription system');
  } else if (typeof global !== 'undefined') {
    (global as any).fixSubscription = fixSubscription;
    console.log('🔧 [FIX] Subscription fix function available (global):');
    console.log('  - fixSubscription() - Fix subscription system');
  }
} catch (error) {
  console.error('Failed to register fixSubscription globally:', error);
}

// Run the fix function automatically after user loads
console.log('🔧 [FIX-INIT] Subscription fix utility loaded');

// Try to run the fix immediately if user is already loaded
if (auth.currentUser) {
  console.log('🔧 [IMMEDIATE-FIX] User already loaded, running fix...');
  fixSubscription().catch(error => {
    console.error('🔧 [IMMEDIATE-FIX] Failed:', error);
  });
}

// Also run after a delay
setTimeout(async () => {
  try {
    if (auth.currentUser) {
      console.log('🔧 [AUTO-FIX] Running automatic subscription fix...');
      await fixSubscription();
    } else {
      console.log('🔧 [AUTO-FIX] No user found, waiting...');
      // Wait for user to load and try again
      setTimeout(async () => {
        if (auth.currentUser) {
          console.log('🔧 [AUTO-FIX-RETRY] Running automatic subscription fix...');
          await fixSubscription();
        } else {
          console.log('🔧 [AUTO-FIX-RETRY] Still no user found');
        }
      }, 5000);
    }
  } catch (error) {
    console.error('🔧 [AUTO-FIX] Failed to run automatic subscription fix:', error);
  }
}, 3000);
