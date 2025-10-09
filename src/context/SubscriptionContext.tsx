import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthSafe } from './AuthContext';
import subscriptionService from '../services/subscriptionService';
// import { migrateUserSubscriptionFields } from '../utils/migrateUserSubscription';
import {
  UserSubscription,
  SubscriptionPlan,
  SubscriptionStatus,
  BillingCycle,
  SubscriptionPlanConfig,
  SubscriptionFeatures
} from '../services/types';

console.log('🔄 SubscriptionContext module loaded');

interface SubscriptionContextType {
  // Current subscription state
  subscription: UserSubscription | null;
  isLoading: boolean;
  error: string | null;

  // Subscription info
  currentPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  daysUntilRenewal: number;
  dailyGems: number;
  
  // Feature access
  hasFeature: (feature: keyof SubscriptionFeatures) => boolean;
  canAccessFeature: (feature: keyof SubscriptionFeatures) => boolean;
  
  // Plan information
  availablePlans: SubscriptionPlanConfig[];
  getPlanConfig: (plan: SubscriptionPlan) => SubscriptionPlanConfig;
  
  // Actions
  subscribeToPlan: (plan: SubscriptionPlan, billingCycle: BillingCycle, paymentMethodId?: string) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  
  // UI helpers
  getSubscriptionBadge: () => { name: string; color: string; icon: string } | null;
  isSubscriptionActive: () => boolean;
  isOnTrial: () => boolean;
  getTrialDaysRemaining: () => number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  console.log('🔄 SubscriptionProvider component initializing');

  const { user, isGuest, userProfile } = useAuthSafe();
  
  // State
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyGems, setDailyGems] = useState(0); // Default for inactive plan

  // Load subscription data
  const loadSubscription = async () => {
    if (!user || isGuest) {
      setSubscription(null);
      setDailyGems(10);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const userSubscription = await subscriptionService.getUserSubscription(user.uid);
      setSubscription(userSubscription);

      // Get daily gems
      const gems = await subscriptionService.getDailyGems(user.uid);
      setDailyGems(gems);

    } catch (err: any) {
      console.error('Failed to load subscription:', err);
      setError(err.message);
      setSubscription(null);
      setDailyGems(10);
    } finally {
      setIsLoading(false);
    }
  };

  // Set up real-time subscription listener
  useEffect(() => {
    console.log('🔄 SubscriptionContext useEffect triggered', {
      hasUser: !!user,
      isGuest,
      hasUserProfile: !!userProfile,
      userProfileFields: userProfile ? Object.keys(userProfile) : []
    });

    if (!user || isGuest) {
      console.log('🚫 No user or guest user, skipping subscription setup');
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    // Migrate user subscription fields if needed
    const initializeSubscription = async () => {
      try {
        console.log('🔄 Checking subscription fields for user:', user.uid);
        console.log('📊 User profile data:', userProfile);

        // Check if user profile has subscription fields, migrate if needed
        if (userProfile && (!userProfile.subscriptionPlan || !userProfile.subscriptionStatus)) {
          console.log('🔄 Migrating user subscription fields...');
          // await migrateUserSubscriptionFields(user.uid);
          console.log('⚠️ Migration temporarily disabled for debugging');
        } else if (!userProfile) {
          console.log('⚠️ User profile not available yet, skipping migration');
        } else {
          console.log('✅ User already has subscription fields:', {
            subscriptionPlan: userProfile.subscriptionPlan,
            subscriptionStatus: userProfile.subscriptionStatus
          });
        }
      } catch (error) {
        console.warn('⚠️ Failed to migrate subscription fields:', error);
      }
    };

    initializeSubscription();

    console.log('🔄 Setting up subscription listener for user:', user.uid);
    const unsubscribe = subscriptionService.onSubscriptionChange(user.uid, (newSubscription) => {
      console.log('📦 Subscription update received:', newSubscription);
      setSubscription(newSubscription);
      if (newSubscription) {
        setDailyGems(newSubscription.features.dailyGems);
      } else {
        setDailyGems(10);
      }
      setIsLoading(false);
    });

    return () => {
      console.log('🧹 Cleaning up subscription listener for user:', user.uid);
      unsubscribe();
    };
  }, [user, isGuest]);

  // Computed values
  const currentPlan: SubscriptionPlan = subscription?.plan || 'free';
  const subscriptionStatus: SubscriptionStatus = subscription?.status || 'expired';
  const daysUntilRenewal = subscription ? subscriptionService.getDaysUntilRenewal(subscription) : 0;

  // Feature access helpers
  const hasFeature = (feature: keyof SubscriptionFeatures): boolean => {
    if (!subscription || subscription.status !== 'active') {
      return subscriptionService.getPlanConfig('free').features[feature] as boolean;
    }
    return subscription.features[feature] as boolean;
  };

  const canAccessFeature = (feature: keyof SubscriptionFeatures): boolean => {
    if (isGuest) return false;
    return hasFeature(feature);
  };

  // Plan information
  const availablePlans = subscriptionService.getAllPlans();
  const getPlanConfig = (plan: SubscriptionPlan) => subscriptionService.getPlanConfig(plan);

  // Actions
  const subscribeToPlan = async (plan: SubscriptionPlan, billingCycle: BillingCycle, paymentMethodId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const newSubscription = await subscriptionService.subscribeToPlan(plan, billingCycle, paymentMethodId);
      setSubscription(newSubscription);
      setDailyGems(newSubscription.features.dailyGems);
      
    } catch (err: any) {
      console.error('Failed to subscribe:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSubscription = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await subscriptionService.cancelSubscription();
      // Subscription will be updated via the real-time listener
      
    } catch (err: any) {
      console.error('Failed to cancel subscription:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSubscription = async () => {
    await loadSubscription();
  };

  // UI helpers
  const getSubscriptionBadge = () => {
    if (!subscription || subscription.status !== 'active') return null;
    
    const planConfig = subscriptionService.getPlanConfig(subscription.plan);
    return planConfig.badge || null;
  };

  const isSubscriptionActive = (): boolean => {
    return subscription?.status === 'active' || subscription?.status === 'trial';
  };

  const isOnTrial = (): boolean => {
    return subscription?.status === 'trial';
  };

  const getTrialDaysRemaining = (): number => {
    if (!subscription || !subscription.trialEndDate) return 0;
    
    const now = new Date();
    const trialEnd = subscription.trialEndDate.toDate();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const contextValue: SubscriptionContextType = {
    // State
    subscription,
    isLoading,
    error,
    
    // Subscription info
    currentPlan,
    subscriptionStatus,
    daysUntilRenewal,
    dailyGems,
    
    // Feature access
    hasFeature,
    canAccessFeature,
    
    // Plan information
    availablePlans,
    getPlanConfig,
    
    // Actions
    subscribeToPlan,
    cancelSubscription,
    refreshSubscription,
    
    // UI helpers
    getSubscriptionBadge,
    isSubscriptionActive,
    isOnTrial,
    getTrialDaysRemaining
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export default SubscriptionContext;
