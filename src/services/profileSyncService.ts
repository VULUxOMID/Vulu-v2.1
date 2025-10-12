import {
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  collection,
  writeBatch,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { firestoreService } from './firestoreService';
import { AppUser } from './types';
import { logger } from '../utils/logger';

export interface ProfileUpdateData {
  displayName?: string;
  photoURL?: string;
  username?: string;
  bio?: string;
  customStatus?: string;
}

export interface RegistrationData {
  displayName?: string;
  username?: string;
  contactMethod?: 'email' | 'phone';
  contactValue?: string;
  dateOfBirth?: Date;
  phoneVerified?: boolean;
}

/**
 * Service to synchronize user profile changes across all conversations
 * where the user is a participant
 */
class ProfileSyncService {
  private profileListeners: Map<string, Unsubscribe> = new Map();
  private profileRetryCounts: Map<string, number> = new Map();
  private profileRetryTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastSyncTime: Map<string, number> = new Map();
  private conversationCache: Map<string, boolean> = new Map(); // Cache whether user has conversations

  // Exponential backoff configuration
  private readonly maxRetries = 5;
  private readonly baseDelay = 1000; // 1 second
  private readonly maxDelay = 30000; // 30 seconds
  private readonly minSyncInterval = 60000; // Minimum 60 seconds between syncs

  /**
   * Check if user is a guest user (not authenticated with Firebase)
   */
  private isGuestUser(userId: string): boolean {
    // Guest users have IDs that start with 'guest_'
    return userId.startsWith('guest_') || !auth.currentUser;
  }

  /**
   * Start monitoring a user's profile for changes and sync to conversations
   */
  startProfileSync(userId: string): Unsubscribe {
    // Handle guest users - they don't have Firebase profiles to sync
    if (this.isGuestUser(userId)) {
      logger.info(`🎭 Guest user ${userId} - skipping profile sync (expected behavior)`);
      // Return a no-op unsubscribe function
      return () => {};
    }

    // Clean up existing listener if any
    this.stopProfileSync(userId);

    const userRef = doc(db, 'users', userId);
    
    const unsubscribe = onSnapshot(userRef, async (userDoc) => {
      if (!userDoc.exists()) {
        logger.warn('User document does not exist for profile sync');
        return;
      }

      const userData = userDoc.data() as AppUser;

      // Reset retry count and clear timer on successful listener start
      this.cleanupUserRetryData(userId);

      try {
        // Sync profile changes to all conversations where this user is a participant
        await this.syncProfileToConversations(userId, {
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          username: userData.username,
          bio: userData.bio,
          customStatus: userData.customStatus
        });
        // Success logged only when actual updates occur
      } catch (syncError) {
        logger.error('❌ Profile sync failed:', syncError);
        // Don't throw - profile sync failure should not break the app
      }
    }, (error) => {
      logger.error(`❌ Error monitoring profile changes for user ${userId}:`, error);

      // Handle permission errors specifically
      if (error.code === 'permission-denied') {
        logger.warn('🔒 Profile sync permission denied - this may affect menu functionality');
      }

      // Clean up the failed listener
      this.profileListeners.delete(userId);

      // Handle retry with exponential backoff
      this.handleRetry(userId);
    });

    this.profileListeners.set(userId, unsubscribe);
    return unsubscribe;
  }

  /**
   * Handle retry logic with exponential backoff
   */
  private handleRetry(userId: string): void {
    const currentRetryCount = this.profileRetryCounts.get(userId) || 0;
    
    if (currentRetryCount >= this.maxRetries) {
      logger.error(`Max retries (${this.maxRetries}) exceeded for user ${userId}. Aborting profile sync.`);
      this.cleanupUserRetryData(userId);
      return;
    }
    
    // Calculate delay with exponential backoff
    const delay = Math.min(this.baseDelay * Math.pow(2, currentRetryCount), this.maxDelay);
    
    // Add random jitter (+/- 25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1); // -25% to +25%
    const finalDelay = Math.max(0, delay + jitter);
    
    logger.info(`Retrying profile sync for user ${userId} in ${Math.round(finalDelay)}ms (attempt ${currentRetryCount + 1}/${this.maxRetries})`);
    
    // Increment retry count
    this.profileRetryCounts.set(userId, currentRetryCount + 1);
    
    // Schedule retry
    const timeoutHandle = setTimeout(() => {
      this.profileRetryTimers.delete(userId);
      this.startProfileSync(userId);
    }, finalDelay);
    
    this.profileRetryTimers.set(userId, timeoutHandle);
  }

  /**
   * Clean up retry data for a specific user
   */
  private cleanupUserRetryData(userId: string): void {
    this.profileRetryCounts.delete(userId);
    const timer = this.profileRetryTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.profileRetryTimers.delete(userId);
    }
  }

  /**
   * Stop monitoring profile changes for a user
   */
  stopProfileSync(userId: string): void {
    const unsubscribe = this.profileListeners.get(userId);
    if (unsubscribe) {
      unsubscribe();
      this.profileListeners.delete(userId);
    }
    
    // Clear any pending retry timer and reset retry tracking
    this.cleanupUserRetryData(userId);
  }

  /**
   * Manually sync a user's profile to all their conversations
   */
  async syncProfileToConversations(userId: string, profileData: ProfileUpdateData): Promise<void> {
    // Handle guest users - they don't have conversations to sync
    if (this.isGuestUser(userId)) {
      return; // Silent return for guest users
    }

    // Check if user has conversations (cached)
    const hasConversations = this.conversationCache.get(userId);
    if (hasConversations === false) {
      // User has no conversations, skip sync silently
      return;
    }

    // Throttle syncs - don't sync more than once per minute
    const lastSync = this.lastSyncTime.get(userId) || 0;
    const now = Date.now();
    if (now - lastSync < this.minSyncInterval) {
      // Too soon since last sync, skip
      return;
    }

    try {
      // Find all conversations where this user is a participant
      const conversationsQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId)
      );

      const conversationsSnapshot = await getDocs(conversationsQuery);

      if (conversationsSnapshot.empty) {
        // Cache that user has no conversations to avoid repeated queries
        this.conversationCache.set(userId, false);
        return; // Silent return
      }

      // User has conversations, cache this
      this.conversationCache.set(userId, true);
      this.lastSyncTime.set(userId, now);

      logger.debug(`Found ${conversationsSnapshot.docs.length} conversations for user ${userId}`);

      // Use batch writes for better performance
      const batch = writeBatch(db);
      let updateCount = 0;
      const failedUpdates: string[] = [];

      conversationsSnapshot.docs.forEach((conversationDoc) => {
        try {
          const conversationData = conversationDoc.data();
          const conversationRef = doc(db, 'conversations', conversationDoc.id);

          // Verify user is actually in participants array
          if (!conversationData.participants || !conversationData.participants.includes(userId)) {
            logger.warn(`⚠️ User ${userId} not found in participants for conversation ${conversationDoc.id}`);
            failedUpdates.push(conversationDoc.id);
            return;
          }

          let hasUpdates = false;

          // Update participant names if displayName changed
          if (profileData.displayName && conversationData.participantNames) {
            const updatedParticipantNames = {
              ...conversationData.participantNames,
              [userId]: profileData.displayName
            };

            batch.update(conversationRef, {
              participantNames: updatedParticipantNames
            });
            hasUpdates = true;
          }

          // Update participant avatars if photoURL changed
          if (profileData.photoURL !== undefined && conversationData.participantAvatars) {
            const updatedParticipantAvatars = {
              ...conversationData.participantAvatars,
              [userId]: profileData.photoURL || ''
            };

            batch.update(conversationRef, {
              participantAvatars: updatedParticipantAvatars
            });
            hasUpdates = true;
          }

          if (hasUpdates) {
            updateCount++;
          }

        } catch (docError) {
          logger.error(`Error processing conversation ${conversationDoc.id}:`, docError);
          failedUpdates.push(conversationDoc.id);
        }
      });

      if (updateCount > 0) {
        try {
          await batch.commit();
          logger.debug(`✅ Updated ${updateCount} conversation records for user ${userId}`);

          if (failedUpdates.length > 0) {
            logger.warn(`⚠️ Failed to update ${failedUpdates.length} conversations: ${failedUpdates.join(', ')}`);
          }
        } catch (batchError) {
          logger.error(`❌ Batch commit failed for user ${userId}:`, batchError);

          // If batch fails, try individual updates for critical data
          if (profileData.displayName) {
            logger.debug(`🔄 Attempting individual updates for user ${userId}...`);
            await this.fallbackIndividualUpdates(userId, profileData, conversationsSnapshot.docs);
          }
        }
      } else {
        logger.debug(`No conversation updates needed for user ${userId}`);
      }

    } catch (error) {
      logger.error(`Failed to sync profile for user ${userId}:`, error);

      // Don't throw the error - profile sync failure should not crash the app
      // The error is already logged and the user can continue using the app
      logger.warn(`⚠️ Profile sync failed for user ${userId}, continuing without sync`);
    }
  }

  /**
   * Fallback method to update conversations individually when batch fails
   */
  private async fallbackIndividualUpdates(
    userId: string,
    profileData: ProfileUpdateData,
    conversationDocs: any[]
  ): Promise<void> {
    let successCount = 0;
    let failCount = 0;

    for (const conversationDoc of conversationDocs) {
      try {
        const conversationData = conversationDoc.data();
        const conversationRef = doc(db, 'conversations', conversationDoc.id);

        // Verify user is in participants
        if (!conversationData.participants || !conversationData.participants.includes(userId)) {
          continue;
        }

        const updates: any = {};

        // Update participant names if displayName changed
        if (profileData.displayName && conversationData.participantNames) {
          updates.participantNames = {
            ...conversationData.participantNames,
            [userId]: profileData.displayName
          };
        }

        // Update participant avatars if photoURL changed
        if (profileData.photoURL !== undefined && conversationData.participantAvatars) {
          updates.participantAvatars = {
            ...conversationData.participantAvatars,
            [userId]: profileData.photoURL || ''
          };
        }

        if (Object.keys(updates).length > 0) {
          await updateDoc(conversationRef, updates);
          successCount++;
        }

      } catch (error) {
        logger.error(`Individual update failed for conversation ${conversationDoc.id}:`, error);
        failCount++;
      }
    }

    logger.debug(`🔄 Individual updates completed: ${successCount} success, ${failCount} failed`);
  }

  /**
   * Force refresh all conversation participant data for a user
   * Useful when there are inconsistencies
   */
  async forceRefreshUserInConversations(userId: string): Promise<void> {
    try {
      // Get the latest user profile
      const userProfile = await firestoreService.getUser(userId);
      if (!userProfile) {
        logger.warn(`User profile not found for ${userId}`);
        return;
      }

      await this.syncProfileToConversations(userId, {
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL,
        username: userProfile.username,
        bio: userProfile.bio,
        customStatus: userProfile.customStatus
      });

    } catch (error) {
      logger.error(`Failed to force refresh user ${userId} in conversations:`, error);
      throw error;
    }
  }

  /**
   * Batch update multiple users' profiles in conversations
   * Useful for maintenance operations
   */
  async batchSyncProfiles(userIds: string[]): Promise<void> {
    logger.debug(`🔄 Batch syncing profiles for ${userIds.length} users...`);

    const promises = userIds.map(userId => this.forceRefreshUserInConversations(userId));
    
    try {
      await Promise.allSettled(promises);
      logger.debug(`✅ Batch profile sync completed for ${userIds.length} users`);
    } catch (error) {
      logger.error('Batch profile sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync registration data to user profile
   */
  async syncRegistrationToProfile(userId: string, registrationData: RegistrationData): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      const updateData: any = {};

      if (registrationData.displayName) {
        updateData.displayName = registrationData.displayName;
        updateData.displayNameLower = registrationData.displayName.toLowerCase();
      }

      if (registrationData.username) {
        updateData.username = registrationData.username;
        updateData.usernameLower = registrationData.username.toLowerCase();
      }

      if (registrationData.dateOfBirth) {
        updateData.dateOfBirth = registrationData.dateOfBirth;
      }

      if (registrationData.phoneVerified !== undefined) {
        updateData.phoneVerified = registrationData.phoneVerified;
      }

      if (registrationData.contactMethod && registrationData.contactValue) {
        if (registrationData.contactMethod === 'email') {
          updateData.email = registrationData.contactValue;
          updateData.emailLower = registrationData.contactValue.toLowerCase();
        } else if (registrationData.contactMethod === 'phone') {
          updateData.phoneNumber = registrationData.contactValue;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await updateDoc(userRef, updateData);
        logger.debug('✅ Registration data synced to user profile:', updateData);
      }
    } catch (error: any) {
      logger.error('Failed to sync registration data to profile:', error);
      throw new Error(`Failed to sync registration data: ${error.message}`);
    }
  }

  /**
   * Clear conversation cache for a user (call when user creates/joins a conversation)
   */
  clearConversationCache(userId: string): void {
    this.conversationCache.delete(userId);
    this.lastSyncTime.delete(userId);
  }

  /**
   * Clean up all profile listeners
   */
  cleanup(): void {
    this.profileListeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.profileListeners.clear();
    
    // Clear all retry timers and reset retry tracking maps
    this.profileRetryTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.profileRetryTimers.clear();
    this.profileRetryCounts.clear();
    
    // Clear sync throttling caches
    this.lastSyncTime.clear();
    this.conversationCache.clear();
    
    logger.debug('🧹 Profile sync service cleaned up');
  }

  /**
   * Get the number of active profile listeners
   */
  getActiveListenerCount(): number {
    return this.profileListeners.size;
  }
}

// Export singleton instance
export const profileSyncService = new ProfileSyncService();
