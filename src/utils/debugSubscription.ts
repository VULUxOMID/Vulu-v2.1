import { auth, db } from '../services/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

/**
 * Debug subscription system
 */
export const debugSubscription = async (): Promise<void> => {
  try {
    console.log('🔍 DEBUG: Starting subscription debug...');
    
    if (!auth.currentUser) {
      console.warn('⚠️ No authenticated user found');
      return;
    }
    
    const userId = auth.currentUser.uid;
    console.log(`👤 Debug for user: ${userId}`);
    
    // 1. Check user profile
    console.log('🔄 Step 1: Checking user profile...');
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('❌ User document not found');
      return;
    }
    
    const userData = userDoc.data();
    console.log('📋 User profile data:', {
      displayName: userData.displayName,
      username: userData.username,
      email: userData.email,
      subscriptionPlan: userData.subscriptionPlan,
      subscriptionStatus: userData.subscriptionStatus,
      gems: userData.gems,
      hasSubscriptionPlan: !!userData.subscriptionPlan,
      hasSubscriptionStatus: !!userData.subscriptionStatus
    });
    
    // 2. Check userSubscriptions document
    console.log('🔄 Step 2: Checking userSubscriptions document...');
    const subscriptionRef = doc(db, 'userSubscriptions', userId);
    const subscriptionDoc = await getDoc(subscriptionRef);
    
    if (subscriptionDoc.exists()) {
      console.log('📋 UserSubscriptions document exists:', subscriptionDoc.data());
    } else {
      console.log('❌ UserSubscriptions document does not exist');
    }
    
    // 3. Migrate user profile if needed
    if (!userData.subscriptionPlan || !userData.subscriptionStatus) {
      console.log('🔄 Step 3: Migrating user profile...');
      
      const updateData: any = {};
      
      if (!userData.subscriptionPlan) {
        updateData.subscriptionPlan = 'free';
      }
      
      if (!userData.subscriptionStatus) {
        updateData.subscriptionStatus = 'active';
      }
      
      await updateDoc(userRef, updateData);
      console.log('✅ Successfully migrated user profile:', updateData);
    } else {
      console.log('✅ User profile already has subscription fields');
    }
    
    // 4. Create userSubscriptions document if needed
    if (!subscriptionDoc.exists()) {
      console.log('🔄 Step 4: Creating userSubscriptions document...');
      
      const defaultSubscription = {
        userId,
        plan: 'free',
        status: 'active',
        features: {
          dailyGems: 10,
          maxActiveStreams: 1,
          prioritySupport: false,
          customEmojis: false,
          adFree: false
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        billingCycle: 'monthly'
      };
      
      await setDoc(subscriptionRef, defaultSubscription);
      console.log('✅ Successfully created userSubscriptions document:', defaultSubscription);
    } else {
      console.log('✅ UserSubscriptions document already exists');
    }
    
    // 5. Final check
    console.log('🔄 Step 5: Final verification...');
    const finalUserDoc = await getDoc(userRef);
    const finalSubscriptionDoc = await getDoc(subscriptionRef);
    
    console.log('📋 Final user profile:', {
      subscriptionPlan: finalUserDoc.data()?.subscriptionPlan,
      subscriptionStatus: finalUserDoc.data()?.subscriptionStatus
    });
    
    console.log('📋 Final subscription document exists:', finalSubscriptionDoc.exists());
    
    console.log('✅ Subscription debug completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Subscription debug failed:', error);
    throw error;
  }
};

// Make it available globally for debugging
try {
  if (typeof window !== 'undefined') {
    (window as any).debugSubscription = debugSubscription;
    console.log('🔧 [DEBUG] Subscription debug function available (window):');
    console.log('  - debugSubscription() - Debug and fix subscription system');
  } else if (typeof global !== 'undefined') {
    (global as any).debugSubscription = debugSubscription;
    console.log('🔧 [DEBUG] Subscription debug function available (global):');
    console.log('  - debugSubscription() - Debug and fix subscription system');
  } else {
    console.log('🔧 [DEBUG] No global object found for debugSubscription');
  }
} catch (error) {
  console.error('Failed to register debugSubscription globally:', error);
}

// Also run the debug function immediately to fix the subscription issue
setTimeout(async () => {
  try {
    console.log('🔧 [AUTO-FIX] Running automatic subscription debug...');
    await debugSubscription();
  } catch (error) {
    console.error('🔧 [AUTO-FIX] Failed to run automatic subscription debug:', error);
  }
}, 3000); // Wait 3 seconds for everything to initialize

// Also run it when the user profile loads
setTimeout(async () => {
  try {
    console.log('🔧 [AUTO-FIX-2] Running second automatic subscription debug...');
    await debugSubscription();
  } catch (error) {
    console.error('🔧 [AUTO-FIX-2] Failed to run second automatic subscription debug:', error);
  }
}, 10000); // Wait 10 seconds for user profile to load
