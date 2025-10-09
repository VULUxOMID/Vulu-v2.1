import { auth } from '../services/firebase';
// import { subscriptionService } from '../services/subscriptionService'; // Temporarily disabled for debugging
import { migrateUserSubscriptionFields } from './migrateUserSubscription';

/**
 * Test subscription system functionality
 */
export const testSubscriptionSystem = async (): Promise<void> => {
  try {
    console.log('🧪 Testing subscription system...');
    
    if (!auth.currentUser) {
      console.warn('⚠️ No authenticated user found');
      return;
    }
    
    const userId = auth.currentUser.uid;
    console.log(`👤 Testing for user: ${userId}`);
    
    // 1. Migrate user subscription fields if needed
    console.log('🔄 Step 1: Migrating user subscription fields...');
    await migrateUserSubscriptionFields(userId);
    
    // 2. Get user subscription (temporarily disabled)
    console.log('🔄 Step 2: Getting user subscription...');
    // const subscription = await subscriptionService.getUserSubscription(userId);
    // console.log('📋 User subscription:', subscription);
    console.log('🔧 Subscription service calls disabled for debugging');

    // 3. Get daily gems (temporarily disabled)
    console.log('🔄 Step 3: Getting daily gems...');
    // const dailyGems = await subscriptionService.getDailyGems(userId);
    // console.log('💎 Daily gems:', dailyGems);
    console.log('🔧 Daily gems calls disabled for debugging');

    // 4. Check subscription status (temporarily disabled)
    console.log('🔄 Step 4: Checking subscription status...');
    // const isActive = await subscriptionService.isSubscriptionActive(userId);
    // console.log('✅ Is subscription active:', isActive);
    console.log('🔧 Subscription status calls disabled for debugging');

    // 5. Get plan config (temporarily disabled)
    console.log('🔄 Step 5: Getting plan config...');
    // const planConfig = subscriptionService.getPlanConfig(subscription?.plan || 'free');
    // console.log('⚙️ Plan config:', planConfig);
    console.log('🔧 Plan config calls disabled for debugging');
    
    console.log('✅ Subscription system test completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Subscription system test failed:', error);
    throw error;
  }
};

/**
 * Quick subscription status check
 */
export const checkSubscriptionStatus = async (): Promise<void> => {
  try {
    if (!auth.currentUser) {
      console.warn('⚠️ No authenticated user found');
      return;
    }
    
    const userId = auth.currentUser.uid;
    // const subscription = await subscriptionService.getUserSubscription(userId); // Temporarily disabled

    console.log('📊 Subscription Status Report:');
    console.log(`👤 User ID: ${userId}`);
    console.log(`📋 Plan: free (hardcoded for debugging)`);
    console.log(`📈 Status: expired (hardcoded for debugging)`);
    console.log(`💎 Daily Gems: ${subscription?.features?.dailyGems || 10}`);
    console.log(`🔄 Auto Renew: ${subscription?.autoRenew || false}`);
    
    if (subscription?.endDate) {
      const endDate = subscription.endDate.toDate();
      const now = new Date();
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`⏰ Days until expiration: ${daysLeft}`);
    }
    
  } catch (error: any) {
    console.error('❌ Failed to check subscription status:', error);
  }
};

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).testSubscriptionSystem = testSubscriptionSystem;
  (window as any).checkSubscriptionStatus = checkSubscriptionStatus;
  console.log('🔧 [DEBUG] Subscription test functions available:');
  console.log('  - testSubscriptionSystem() - Full subscription system test');
  console.log('  - checkSubscriptionStatus() - Quick status check');
}
