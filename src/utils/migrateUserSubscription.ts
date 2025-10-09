import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { SubscriptionPlan, SubscriptionStatus } from '../services/types';

/**
 * Migrate existing user profiles to include subscription fields
 */
export const migrateUserSubscriptionFields = async (userId: string): Promise<void> => {
  try {
    console.log(`🔄 Migrating subscription fields for user: ${userId}`);
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.warn(`⚠️ User document not found: ${userId}`);
      return;
    }
    
    const userData = userDoc.data();
    
    // Check if subscription fields already exist
    if (userData.subscriptionPlan && userData.subscriptionStatus) {
      console.log(`✅ User ${userId} already has subscription fields`);
      return;
    }
    
    // Add missing subscription fields
    const updateData: {
      subscriptionPlan?: SubscriptionPlan;
      subscriptionStatus?: SubscriptionStatus;
    } = {};
    
    if (!userData.subscriptionPlan) {
      updateData.subscriptionPlan = 'free';
    }
    
    if (!userData.subscriptionStatus) {
      updateData.subscriptionStatus = 'expired';
    }
    
    await updateDoc(userRef, updateData);
    
    console.log(`✅ Successfully migrated subscription fields for user: ${userId}`, updateData);
    
  } catch (error: any) {
    console.error(`❌ Failed to migrate subscription fields for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Global function to migrate current user (for debugging)
 */
export const migrateCurrentUser = async (): Promise<void> => {
  const { auth } = await import('../services/firebase');
  
  if (!auth.currentUser) {
    console.warn('⚠️ No authenticated user found');
    return;
  }
  
  await migrateUserSubscriptionFields(auth.currentUser.uid);
};

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).migrateCurrentUser = migrateCurrentUser;
}
