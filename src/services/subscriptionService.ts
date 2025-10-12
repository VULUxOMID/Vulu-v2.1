import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  runTransaction,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { 
  UserSubscription, 
  SubscriptionPlan, 
  SubscriptionStatus, 
  BillingCycle,
  SubscriptionPlanConfig,
  SubscriptionFeatures
} from './types';
import FirebaseErrorHandler from '../utils/firebaseErrorHandler';

// Subscription plan configurations
export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, SubscriptionPlanConfig> = {
  free: {
    id: 'free',
    name: 'Inactive',
    description: 'Upgrade to unlock premium features',
    features: {
      dailyGems: 0, // No free gems - gems are paid only
      maxStreams: 1,
      prioritySupport: false,
      customEmojis: false,
      profileBadge: false,
      ghostMode: false,
      profileViews: false,
      advancedAnalytics: false,
      exclusiveContent: false,
      adFree: false
    },
    pricing: {
      monthly: 0,
      yearly: 0
    }
  },
  gem_plus: {
    id: 'gem_plus',
    name: 'Gem Plus',
    description: 'Enhanced experience with daily gems and premium features',
    features: {
      dailyGems: 200,
      maxStreams: 3,
      prioritySupport: true,
      customEmojis: true,
      profileBadge: true,
      ghostMode: true,
      profileViews: true,
      advancedAnalytics: false,
      exclusiveContent: true,
      adFree: true
    },
    pricing: {
      monthly: 9.99,
      yearly: 99.99
    },
    badge: {
      name: 'GEM+',
      color: '#B768FB',
      icon: 'diamond'
    },
    isPopular: true,
    trialDays: 7
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Advanced features for power users',
    features: {
      dailyGems: 500,
      maxStreams: 10,
      prioritySupport: true,
      customEmojis: true,
      profileBadge: true,
      ghostMode: true,
      profileViews: true,
      advancedAnalytics: true,
      exclusiveContent: true,
      adFree: true
    },
    pricing: {
      monthly: 19.99,
      yearly: 199.99
    },
    badge: {
      name: 'PRO',
      color: '#FFD700',
      icon: 'crown'
    },
    trialDays: 14
  },
  vip: {
    id: 'vip',
    name: 'VIP',
    description: 'Ultimate experience with all features unlocked',
    features: {
      dailyGems: 1000,
      maxStreams: -1, // Unlimited
      prioritySupport: true,
      customEmojis: true,
      profileBadge: true,
      ghostMode: true,
      profileViews: true,
      advancedAnalytics: true,
      exclusiveContent: true,
      adFree: true
    },
    pricing: {
      monthly: 49.99,
      yearly: 499.99,
      lifetime: 999.99
    },
    badge: {
      name: 'VIP',
      color: '#FF6B6B',
      icon: 'star'
    },
    trialDays: 30
  }
};

class SubscriptionService {
  private currentSubscription: UserSubscription | null = null;
  private subscriptionListeners: Map<string, () => void> = new Map();

  /**
   * Get current user's subscription
   */
  async getUserSubscription(userId?: string): Promise<UserSubscription | null> {
    try {
      const targetUserId = userId || auth.currentUser?.uid;
      if (!targetUserId) {
        throw new Error('User not authenticated');
      }

      const subscriptionDoc = await getDoc(doc(db, 'userSubscriptions', targetUserId));
      
      if (!subscriptionDoc.exists()) {
        // Create free subscription for new users
        return await this.createFreeSubscription(targetUserId);
      }

      const subscription = {
        id: subscriptionDoc.id,
        ...subscriptionDoc.data()
      } as UserSubscription;

      // Check if subscription is expired
      const now = new Date();
      let endDate: Date;

      // Handle both endDate and currentPeriodEnd field names for compatibility
      if ((subscription as any).currentPeriodEnd) {
        endDate = (subscription as any).currentPeriodEnd.toDate();
      } else if (subscription.endDate) {
        endDate = subscription.endDate.toDate();
      } else {
        // Fallback to far future date to avoid expiration
        endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      }

      if (subscription.status === 'active' && endDate < now) {
        // Auto-expire subscription
        await this.expireSubscription(targetUserId);
        subscription.status = 'expired';
      }

      if (!userId || userId === auth.currentUser?.uid) {
        this.currentSubscription = subscription;
      }

      return subscription;

    } catch (error: any) {
      FirebaseErrorHandler.logError('getUserSubscription', error);
      return null;
    }
  }

  /**
   * Create inactive subscription for new users
   */
  private async createFreeSubscription(userId: string): Promise<UserSubscription> {
    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year from now

      const subscription: UserSubscription = {
        id: userId,
        userId,
        plan: 'free',
        status: 'active',
        billingCycle: 'yearly',
        startDate: Timestamp.fromDate(now),
        endDate: Timestamp.fromDate(endDate),
        features: SUBSCRIPTION_PLANS.free.features,
        priceUsd: 0,
        currency: 'USD',
        autoRenew: false,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      };

      await setDoc(doc(db, 'userSubscriptions', userId), subscription);
      
      logger.debug(`✅ Created free subscription for user: ${userId}`);
      return subscription;

    } catch (error: any) {
      FirebaseErrorHandler.logError('createFreeSubscription', error);
      throw error;
    }
  }

  /**
   * Subscribe to a plan
   */
  async subscribeToPlan(
    plan: SubscriptionPlan,
    billingCycle: BillingCycle,
    paymentMethodId?: string
  ): Promise<UserSubscription> {
    try {
      if (!auth.currentUser) {
        throw new Error('User not authenticated');
      }

      const userId = auth.currentUser.uid;
      const planConfig = SUBSCRIPTION_PLANS[plan];
      
      if (!planConfig) {
        throw new Error('Invalid subscription plan');
      }

      const now = new Date();
      let endDate: Date;
      let price: number;

      // Calculate end date and price based on billing cycle
      switch (billingCycle) {
        case 'monthly':
          endDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
          price = planConfig.pricing.monthly;
          break;
        case 'yearly':
          endDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
          price = planConfig.pricing.yearly;
          break;
        case 'lifetime':
          endDate = new Date(now.getTime() + (100 * 365 * 24 * 60 * 60 * 1000)); // 100 years
          price = planConfig.pricing.lifetime || 0;
          break;
        default:
          throw new Error('Invalid billing cycle');
      }

      // Check if user has trial available
      const isTrialEligible = await this.isTrialEligible(userId, plan);
      const isStartingTrial = isTrialEligible && planConfig.trialDays && plan !== 'free';

      let trialEndDate: Timestamp | undefined;
      if (isStartingTrial) {
        trialEndDate = Timestamp.fromDate(
          new Date(now.getTime() + (planConfig.trialDays! * 24 * 60 * 60 * 1000))
        );
      }

      const subscription: UserSubscription = {
        id: userId,
        userId,
        plan,
        status: isStartingTrial ? 'trial' : 'active',
        billingCycle,
        startDate: Timestamp.fromDate(now),
        endDate: Timestamp.fromDate(endDate),
        renewalDate: billingCycle !== 'lifetime' ? Timestamp.fromDate(endDate) : undefined,
        trialEndDate,
        features: planConfig.features,
        priceUsd: isStartingTrial ? 0 : price,
        currency: 'USD',
        paymentMethodId,
        autoRenew: billingCycle !== 'lifetime',
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      };

      // TODO: Process payment if not trial
      if (!isStartingTrial && price > 0) {
        // Integrate with payment processor (Stripe, Apple Pay, Google Pay)
        // const paymentResult = await this.processPayment(price, paymentMethodId);
        // subscription.transactionId = paymentResult.transactionId;
      }

      await setDoc(doc(db, 'userSubscriptions', userId), subscription);
      
      logger.debug(`✅ User ${userId} subscribed to ${plan} (${billingCycle})`);
      this.currentSubscription = subscription;
      
      return subscription;

    } catch (error: any) {
      FirebaseErrorHandler.logError('subscribeToPlan', error);
      throw new Error(`Failed to subscribe: ${error.message}`);
    }
  }

  /**
   * Check if user is eligible for trial
   */
  private async isTrialEligible(userId: string, plan: SubscriptionPlan): Promise<boolean> {
    try {
      // Check if user has ever had this plan before
      const historyQuery = query(
        collection(db, 'subscriptionHistory'),
        where('userId', '==', userId),
        where('plan', '==', plan),
        limit(1)
      );

      const historyDocs = await getDocs(historyQuery);
      return historyDocs.empty; // Eligible if no history found

    } catch (error: any) {
      logger.error('Error checking trial eligibility:', error);
      return false;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId?: string): Promise<void> {
    try {
      const targetUserId = userId || auth.currentUser?.uid;
      if (!targetUserId) {
        throw new Error('User not authenticated');
      }

      await updateDoc(doc(db, 'userSubscriptions', targetUserId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        autoRenew: false,
        updatedAt: serverTimestamp()
      });

      logger.debug(`✅ Cancelled subscription for user: ${targetUserId}`);

    } catch (error: any) {
      FirebaseErrorHandler.logError('cancelSubscription', error);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Expire subscription (internal use)
   */
  private async expireSubscription(userId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'userSubscriptions', userId), {
        status: 'expired',
        updatedAt: serverTimestamp()
      });

      // Move to inactive plan
      await this.createFreeSubscription(userId);

    } catch (error: any) {
      FirebaseErrorHandler.logError('expireSubscription', error);
    }
  }

  /**
   * Get subscription plan configuration
   */
  getPlanConfig(plan: SubscriptionPlan): SubscriptionPlanConfig {
    return SUBSCRIPTION_PLANS[plan];
  }

  /**
   * Get all available plans
   */
  getAllPlans(): SubscriptionPlanConfig[] {
    return Object.values(SUBSCRIPTION_PLANS);
  }

  /**
   * Check if user has specific feature
   */
  async hasFeature(feature: keyof SubscriptionFeatures, userId?: string): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription || subscription.status !== 'active') {
        return SUBSCRIPTION_PLANS.free.features[feature] as boolean;
      }

      return subscription.features[feature] as boolean;

    } catch (error: any) {
      logger.error('Error checking feature access:', error);
      return false;
    }
  }

  /**
   * Get daily gems for user
   */
  async getDailyGems(userId?: string): Promise<number> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription || subscription.status !== 'active') {
        return SUBSCRIPTION_PLANS.free.features.dailyGems;
      }

      return subscription.features.dailyGems;

    } catch (error: any) {
      logger.error('Error getting daily gems:', error);
      return SUBSCRIPTION_PLANS.free.features.dailyGems;
    }
  }

  /**
   * Get days until renewal/expiration
   */
  getDaysUntilRenewal(subscription: UserSubscription): number {
    // For inactive/free plans, return 0 since renewal doesn't apply
    if (subscription.plan === 'free' || subscription.status !== 'active') {
      return 0;
    }

    const now = new Date();

    // Handle both endDate and currentPeriodEnd field names for compatibility
    let renewalDate: Date;
    if (subscription.renewalDate) {
      renewalDate = subscription.renewalDate.toDate();
    } else if ((subscription as any).currentPeriodEnd) {
      // Handle currentPeriodEnd from database
      renewalDate = (subscription as any).currentPeriodEnd.toDate();
    } else if (subscription.endDate) {
      renewalDate = subscription.endDate.toDate();
    } else {
      // Fallback to 30 days from now
      renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const diffTime = renewalDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Listen to subscription changes
   */
  onSubscriptionChange(userId: string, callback: (subscription: UserSubscription | null) => void): () => void {
    logger.debug(`🔄 Setting up subscription listener for user: ${userId}`);

    const unsubscribe = onSnapshot(
      doc(db, 'userSubscriptions', userId),
      async (doc) => {
        if (doc.exists()) {
          const subscription = {
            id: doc.id,
            ...doc.data()
          } as UserSubscription;
          logger.debug(`✅ Subscription loaded for user: ${userId}`, subscription);
          callback(subscription);
        } else {
          // Document doesn't exist, create a default subscription
          logger.debug(`🔄 Creating default subscription for user: ${userId}`);
          try {
            await this.createDefaultSubscription(userId);
            // The listener will be triggered again with the new document
          } catch (error) {
            logger.error('Failed to create default subscription:', error);
            // Return a default subscription instead of null
            const defaultSubscription: UserSubscription = {
              id: userId,
              userId,
              plan: 'free',
              status: 'active',
              features: SUBSCRIPTION_PLANS.free.features,
              createdAt: new Date(),
              updatedAt: new Date(),
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              billingCycle: 'monthly'
            };
            logger.debug(`🔄 Using fallback default subscription for user: ${userId}`);
            callback(defaultSubscription);
          }
        }
      },
      (error) => {
        logger.error('Error listening to subscription changes:', error);
        // Instead of returning null, provide a default subscription
        const defaultSubscription: UserSubscription = {
          id: userId,
          userId,
          plan: 'free',
          status: 'active',
          features: SUBSCRIPTION_PLANS.free.features,
          createdAt: new Date(),
          updatedAt: new Date(),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          billingCycle: 'monthly'
        };
        logger.debug(`🔄 Using error fallback default subscription for user: ${userId}`);
        callback(defaultSubscription);

        // Try to create the subscription document in the background
        setTimeout(async () => {
          try {
            logger.debug(`🔄 Attempting to create subscription document in background for user: ${userId}`);
            await this.createDefaultSubscription(userId);
            logger.debug(`✅ Successfully created subscription document in background for user: ${userId}`);
          } catch (bgError) {
            logger.error('Background subscription creation failed:', bgError);
          }
        }, 2000);
      }
    );

    this.subscriptionListeners.set(userId, unsubscribe);
    return unsubscribe;
  }

  /**
   * Create a default subscription for a user
   */
  private async createDefaultSubscription(userId: string): Promise<void> {
    const defaultSubscription: Omit<UserSubscription, 'id'> = {
      userId,
      plan: 'free',
      status: 'active',
      features: SUBSCRIPTION_PLANS.free.features,
      createdAt: new Date(),
      updatedAt: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      billingCycle: 'monthly'
    };

    await setDoc(doc(db, 'userSubscriptions', userId), defaultSubscription);
    logger.debug(`✅ Created default subscription for user: ${userId}`);
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    this.subscriptionListeners.forEach((unsubscribe) => unsubscribe());
    this.subscriptionListeners.clear();
    this.currentSubscription = null;
  }
}

export default new SubscriptionService();
