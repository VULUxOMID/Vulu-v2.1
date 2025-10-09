import { auth, db } from '../services/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

/**
 * Quick subscription test and migration
 */
export const quickSubscriptionTest = async (): Promise<void> => {
  try {
    console.log('🧪 Quick Subscription Test Starting...');
    
    if (!auth.currentUser) {
      console.warn('⚠️ No authenticated user found');
      return;
    }
    
    const userId = auth.currentUser.uid;
    console.log(`👤 Testing for user: ${userId}`);
    
    // 1. Check current user document
    console.log('🔄 Step 1: Checking current user document...');
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('❌ User document not found');
      return;
    }
    
    const userData = userDoc.data();
    console.log('📋 Current user data:', {
      subscriptionPlan: userData.subscriptionPlan,
      subscriptionStatus: userData.subscriptionStatus,
      gems: userData.gems,
      displayName: userData.displayName,
      username: userData.username
    });
    
    // 2. Migrate subscription fields if needed
    if (!userData.subscriptionPlan || !userData.subscriptionStatus) {
      console.log('🔄 Step 2: Migrating subscription fields...');
      
      const updateData: any = {};
      
      if (!userData.subscriptionPlan) {
        updateData.subscriptionPlan = 'free';
      }
      
      if (!userData.subscriptionStatus) {
        updateData.subscriptionStatus = 'expired';
      }
      
      await updateDoc(userRef, updateData);
      console.log('✅ Successfully migrated subscription fields:', updateData);
    } else {
      console.log('✅ User already has subscription fields');
    }
    
    // 3. Check updated user document
    console.log('🔄 Step 3: Checking updated user document...');
    const updatedUserDoc = await getDoc(userRef);
    const updatedUserData = updatedUserDoc.data();
    
    console.log('📋 Updated user data:', {
      subscriptionPlan: updatedUserData?.subscriptionPlan,
      subscriptionStatus: updatedUserData?.subscriptionStatus,
      gems: updatedUserData?.gems,
      displayName: updatedUserData?.displayName,
      username: updatedUserData?.username
    });
    
    console.log('✅ Quick subscription test completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Quick subscription test failed:', error);
    throw error;
  }
};

// Make it available globally for debugging
if (typeof global !== 'undefined') {
  (global as any).quickSubscriptionTest = quickSubscriptionTest;
  console.log('🔧 [DEBUG] Quick subscription test function available:');
  console.log('  - quickSubscriptionTest() - Test and migrate subscription data');
}
