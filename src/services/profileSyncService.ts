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
import { db } from './firebase';
import { firestoreService } from './firestoreService';
import { AppUser } from './types';

export interface ProfileUpdateData {
  displayName?: string;
  photoURL?: string;
  username?: string;
  bio?: string;
  customStatus?: string;
}

/**
 * Service to synchronize user profile changes across all conversations
 * where the user is a participant
 */
class ProfileSyncService {
  private profileListeners: Map<string, Unsubscribe> = new Map();
  private profileRetryCounts: Map<string, number> = new Map();
  private profileRetryTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Exponential backoff configuration
  private readonly maxRetries = 5;
  private readonly baseDelay = 1000; // 1 second
  private readonly maxDelay = 30000; // 30 seconds

  /**
   * Start monitoring a user's profile for changes and sync to conversations
   */
  startProfileSync(userId: string): Unsubscribe {
    // Clean up existing listener if any
    this.stopProfileSync(userId);

    const userRef = doc(db, 'users', userId);
    
    const unsubscribe = onSnapshot(userRef, async (userDoc) => {
      if (!userDoc.exists()) return;

      const userData = userDoc.data() as AppUser;
      
      // Reset retry count and clear timer on successful listener start
      this.cleanupUserRetryData(userId);
      
      // Sync profile changes to all conversations where this user is a participant
      await this.syncProfileToConversations(userId, {
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        username: userData.username,
        bio: userData.bio,
        customStatus: userData.customStatus
      });
    }, (error) => {
      console.error(`Error monitoring profile changes for user ${userId}:`, error);
      
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
      console.error(`Max retries (${this.maxRetries}) exceeded for user ${userId}. Aborting profile sync.`);
      this.cleanupUserRetryData(userId);
      return;
    }
    
    // Calculate delay with exponential backoff
    const delay = Math.min(this.baseDelay * Math.pow(2, currentRetryCount), this.maxDelay);
    
    // Add random jitter (+/- 25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1); // -25% to +25%
    const finalDelay = Math.max(0, delay + jitter);
    
    console.log(`Retrying profile sync for user ${userId} in ${Math.round(finalDelay)}ms (attempt ${currentRetryCount + 1}/${this.maxRetries})`);
    
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
    try {
      console.log(`🔄 Syncing profile for user ${userId} to conversations...`);

      // Find all conversations where this user is a participant
      const conversationsQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId)
      );

      const conversationsSnapshot = await getDocs(conversationsQuery);
      
      if (conversationsSnapshot.empty) {
        console.log(`No conversations found for user ${userId}`);
        return;
      }

      // Use batch writes for better performance
      const batch = writeBatch(db);
      let updateCount = 0;

      conversationsSnapshot.docs.forEach((conversationDoc) => {
        const conversationData = conversationDoc.data();
        const conversationRef = doc(db, 'conversations', conversationDoc.id);

        // Update participant names if displayName changed
        if (profileData.displayName && conversationData.participantNames) {
          const updatedParticipantNames = {
            ...conversationData.participantNames,
            [userId]: profileData.displayName
          };

          batch.update(conversationRef, {
            participantNames: updatedParticipantNames
          });
          updateCount++;
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
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`✅ Updated ${updateCount} conversation records for user ${userId}`);
      } else {
        console.log(`No conversation updates needed for user ${userId}`);
      }

    } catch (error) {
      console.error(`Failed to sync profile for user ${userId}:`, error);
      throw error;
    }
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
        console.warn(`User profile not found for ${userId}`);
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
      console.error(`Failed to force refresh user ${userId} in conversations:`, error);
      throw error;
    }
  }

  /**
   * Batch update multiple users' profiles in conversations
   * Useful for maintenance operations
   */
  async batchSyncProfiles(userIds: string[]): Promise<void> {
    console.log(`🔄 Batch syncing profiles for ${userIds.length} users...`);

    const promises = userIds.map(userId => this.forceRefreshUserInConversations(userId));
    
    try {
      await Promise.allSettled(promises);
      console.log(`✅ Batch profile sync completed for ${userIds.length} users`);
    } catch (error) {
      console.error('Batch profile sync failed:', error);
      throw error;
    }
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
    
    console.log('🧹 Profile sync service cleaned up');
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
