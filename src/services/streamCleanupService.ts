import { collection, query, where, getDocs, doc, getDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { logger } from '../utils/logger';
import { db } from './firebase';
import { logger } from '../utils/logger';
import { ActiveStreamTracker } from './activeStreamTracker';
import { logger } from '../utils/logger';
import { ICleanupService, CleanupServiceRegistry } from '../interfaces/ICleanupService';
import { logger } from '../utils/logger';

/**
 * Background service for cleaning up stale stream data and orphaned records
 * Runs periodically to maintain data integrity
 */
export class StreamCleanupService implements ICleanupService {
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static errorCount = 0;
  private static lastErrorTime = 0;
  private static isInErrorState = false;

  // Cleanup intervals (in milliseconds)
  private static readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static readonly STREAM_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private static readonly ACTIVE_STREAM_TIMEOUT = 60 * 60 * 1000; // 1 hour
  private static readonly MAX_ERRORS_BEFORE_SHUTDOWN = 3;
  private static readonly ERROR_RESET_TIME = 30 * 60 * 1000; // 30 minutes
  
  /**
   * Start the background cleanup service
   */
  static startCleanupService(): void {
    if (this.isRunning) {
      logger.debug('🧹 Cleanup service already running');
      return;
    }

    logger.debug('🧹 Starting stream cleanup service');
    this.isRunning = true;

    // Register this service instance
    CleanupServiceRegistry.getInstance().register({
      startCleanupService: () => StreamCleanupService.startCleanupService(),
      stopCleanupService: () => StreamCleanupService.stopCleanupService(),
      isRunning: () => StreamCleanupService.isRunning()
    });
    
    // Run initial cleanup
    this.runCleanupCycle().catch(error => {
      logger.error('❌ Error in initial cleanup cycle:', error);
    });
    
    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanupCycle().catch(error => {
        logger.error('❌ Error in cleanup cycle:', error);
      });
    }, this.CLEANUP_INTERVAL);
  }
  
  /**
   * Stop the background cleanup service
   */
  static stopCleanupService(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    logger.debug('🧹 Stopped stream cleanup service');
  }

  /**
   * Check if the cleanup service is currently running
   */
  static isRunning(): boolean {
    return this.isRunning;
  }
  
  /**
   * Run a complete cleanup cycle with Firestore error recovery
   */
  private static async runCleanupCycle(): Promise<void> {
    try {
      logger.debug('🧹 Starting cleanup cycle...');

      const startTime = Date.now();

      // Check for Firestore internal errors and skip cleanup if detected
      if (this.isFirestoreInErrorState()) {
        logger.warn('🚨 Firestore appears to be in error state, skipping cleanup cycle');
        return;
      }

      // Cleanup stale streams
      const staleStreamsCount = await this.cleanupStaleStreams();

      // Cleanup orphaned active stream records
      const orphanedRecordsCount = await this.cleanupOrphanedActiveStreamRecords();

      // Cleanup inactive streams
      const inactiveStreamsCount = await this.cleanupInactiveStreams();

      const duration = Date.now() - startTime;

      logger.debug(`✅ Cleanup cycle completed in ${duration}ms:`);
      logger.debug(`  - Stale streams cleaned: ${staleStreamsCount}`);
      logger.debug(`  - Orphaned records cleaned: ${orphanedRecordsCount}`);
      logger.debug(`  - Inactive streams cleaned: ${inactiveStreamsCount}`);

    } catch (error: any) {
      logger.error('❌ Error in cleanup cycle:', error);

      // Track errors
      this.errorCount++;
      this.lastErrorTime = Date.now();

      // Check if this is a Firestore internal error
      if (this.isFirestoreInternalError(error)) {
        logger.error('🚨 Firestore internal error detected in cleanup cycle');

        // Trigger aggressive recovery
        await this.handleFirestoreInternalError(error);
      } else {
        // Handle other errors
        logger.error('❌ Non-Firestore error in cleanup cycle:', error);
      }

      // Check if we should shut down due to too many errors
      if (this.errorCount >= this.MAX_ERRORS_BEFORE_SHUTDOWN) {
        logger.error(`🚨 Too many errors (${this.errorCount}), shutting down cleanup service`);
        this.isInErrorState = true;
        this.stopCleanupService();

        // Schedule recovery attempt
        setTimeout(() => {
          this.attemptRecovery();
        }, 60000); // Wait 1 minute before recovery attempt
      }
    }
  }

  /**
   * Check if error is a Firestore internal assertion failure
   */
  private static isFirestoreInternalError(error: any): boolean {
    const errorMessage = error?.message || '';
    return errorMessage.includes('INTERNAL ASSERTION FAILED') ||
           errorMessage.includes('Unexpected state') ||
           errorMessage.includes('ID: b815') ||
           errorMessage.includes('ID: ca9');
  }

  /**
   * Check if Firestore appears to be in an error state
   */
  private static isFirestoreInErrorState(): boolean {
    // Check if we're in error state or have recent errors
    if (this.isInErrorState) {
      return true;
    }

    // Check if we have recent errors
    const timeSinceLastError = Date.now() - this.lastErrorTime;
    return this.errorCount > 0 && timeSinceLastError < this.ERROR_RESET_TIME;
  }

  /**
   * Handle Firestore internal assertion failures
   */
  private static async handleFirestoreInternalError(error: any): Promise<void> {
    logger.error('🚨 Handling Firestore internal assertion failure');

    try {
      // Stop the cleanup service immediately
      this.stopCleanupService();

      // Wait for a bit to let things settle
      await new Promise(resolve => setTimeout(resolve, 5000));

      logger.debug('✅ Firestore error recovery completed');

    } catch (recoveryError) {
      logger.error('❌ Error during Firestore recovery:', recoveryError);
    }
  }

  /**
   * Attempt to recover from error state
   */
  private static async attemptRecovery(): Promise<void> {
    logger.debug('🔄 Attempting cleanup service recovery...');

    try {
      // Reset error state
      this.errorCount = 0;
      this.lastErrorTime = 0;
      this.isInErrorState = false;

      // Wait a bit more before restarting
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Restart the service
      this.startCleanupService();

      logger.debug('✅ Cleanup service recovery completed');

    } catch (error) {
      logger.error('❌ Error during cleanup service recovery:', error);

      // Schedule another recovery attempt
      setTimeout(() => {
        this.attemptRecovery();
      }, 120000); // Wait 2 minutes before next attempt
    }
  }
  
  /**
   * Clean up streams that have been running too long without activity
   */
  private static async cleanupStaleStreams(): Promise<number> {
    try {
      const cutoffTime = Date.now() - this.STREAM_TIMEOUT;

      // Try the composite index query first
      try {
        const streamsQuery = query(
          collection(db, 'streams'),
          where('isActive', '==', true),
          where('startedAt', '<', cutoffTime)
        );

        const querySnapshot = await getDocs(streamsQuery);
        return await this.processStaleStreamsResults(querySnapshot, cutoffTime);

      } catch (indexError: any) {
        // If composite index is not available, fall back to simpler query
        if (indexError?.code === 'failed-precondition' || indexError?.message?.includes('index')) {
          logger.warn('⚠️ Composite index not available for stale streams cleanup, using fallback query');

          const simpleQuery = query(
            collection(db, 'streams'),
            where('isActive', '==', true)
          );

          const querySnapshot = await getDocs(simpleQuery);
          return await this.processStaleStreamsResults(querySnapshot, cutoffTime);
        }

        throw indexError;
      }

    } catch (error: any) {
      logger.error('❌ Error cleaning stale streams:', error);

      // Handle Firestore internal errors
      if (this.isFirestoreInternalError(error)) {
        logger.error('🚨 Firestore internal error in stale streams cleanup');
        throw error; // Re-throw to trigger main error handling
      }

      // Handle permission errors gracefully
      if (error?.code === 'permission-denied') {
        logger.warn('⚠️ Permission denied for stale streams cleanup. Skipping.');
        return 0;
      }

      return 0;
    }
  }

  /**
   * Process stale streams query results
   */
  private static async processStaleStreamsResults(querySnapshot: any, cutoffTime: number): Promise<number> {
    let cleanedCount = 0;
    const batch = writeBatch(db);

    querySnapshot.forEach((doc: any) => {
      const streamData = doc.data();

      // Check if stream has recent activity (last participant join/leave)
      const lastActivity = streamData.lastActivity || streamData.startedAt;

      if (lastActivity < cutoffTime) {
        // Mark stream as inactive
        batch.update(doc.ref, {
          isActive: false,
          endedAt: Date.now(),
          endReason: 'timeout_cleanup'
        });

        cleanedCount++;
        logger.debug(`🧹 Marking stale stream ${doc.id} as inactive`);
      }
    });

    if (cleanedCount > 0) {
      await batch.commit();
    }

    return cleanedCount;
  }
  
  /**
   * Clean up orphaned active stream records
   */
  private static async cleanupOrphanedActiveStreamRecords(): Promise<number> {
    try {
      // This is a simplified version - in a real implementation,
      // you'd need to query all users' active stream records
      // For now, we'll implement user-specific cleanup that gets called
      // when users interact with the app
      
      logger.debug('🧹 Orphaned active stream records cleanup (user-triggered)');
      return 0;
      
    } catch (error) {
      logger.error('❌ Error cleaning orphaned active stream records:', error);
      return 0;
    }
  }
  
  /**
   * Clean up streams marked as inactive
   * TEMPORARILY DISABLED: Permission issues with unauthenticated background service
   */
  private static async cleanupInactiveStreams(): Promise<number> {
    try {
      // TEMPORARY: Disable inactive streams cleanup due to permission issues
      // This will be re-enabled once proper service account authentication is implemented
      logger.debug('🔧 Inactive streams cleanup temporarily disabled (permission issues)');
      return 0;

      /* DISABLED CODE:
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

      const inactiveStreamsQuery = query(
        collection(db, 'streams'),
        where('isActive', '==', false),
        where('endedAt', '<', cutoffTime)
      );

      const querySnapshot = await getDocs(inactiveStreamsQuery);
      let cleanedCount = 0;

      // In a real implementation, you might archive these streams
      // instead of deleting them completely
      const batch = writeBatch(db);

      querySnapshot.forEach((doc) => {
        // For now, just log - in production you might move to archive collection
        logger.debug(`🧹 Found old inactive stream ${doc.id} for potential archival`);
        cleanedCount++;
      });

      return cleanedCount;
      */

    } catch (error) {
      logger.error('❌ Error cleaning inactive streams:', error);
      return 0;
    }
  }

  /**
   * Clean up specific user's orphaned records (called when user becomes active)
   */
  static async cleanupUserOrphanedRecords(userId: string): Promise<void> {
    try {
      logger.debug(`🧹 Cleaning up orphaned records for user ${userId}`);
      
      // Run ghost state recovery
      const recovery = await ActiveStreamTracker.recoverGhostState(userId);
      
      if (recovery.recovered) {
        logger.debug(`✅ User ${userId} ghost state recovery: ${recovery.action}`);
      } else {
        logger.warn(`⚠️ Failed to recover ghost state for user ${userId}`);
      }
      
      // Additional user-specific cleanup
      await ActiveStreamTracker.cleanupOrphanedStreams(userId);
      
    } catch (error) {
      logger.error(`❌ Error cleaning up user ${userId} orphaned records:`, error);
    }
  }
  
  /**
   * Emergency cleanup for a specific stream
   */
  static async emergencyStreamCleanup(streamId: string): Promise<void> {
    try {
      logger.debug(`🚨 Emergency cleanup for stream ${streamId}`);
      
      const streamRef = doc(db, 'streams', streamId);
      const streamDoc = await getDoc(streamRef);
      
      if (!streamDoc.exists()) {
        logger.debug(`Stream ${streamId} doesn't exist, nothing to clean`);
        return;
      }
      
      const streamData = streamDoc.data();
      const participants = streamData?.participants || [];
      
      // Clear active stream records for all participants
      const batch = writeBatch(db);
      
      for (const participant of participants) {
        const activeStreamRef = doc(db, 'users', participant.id, 'activeStream', 'current');
        batch.delete(activeStreamRef);
        logger.debug(`🧹 Clearing active stream record for participant ${participant.id}`);
      }
      
      // Mark stream as inactive
      batch.update(streamRef, {
        isActive: false,
        endedAt: Date.now(),
        endReason: 'emergency_cleanup',
        participants: [] // Clear participants
      });
      
      await batch.commit();
      
      logger.debug(`✅ Emergency cleanup completed for stream ${streamId}`);
      
    } catch (error) {
      logger.error(`❌ Error in emergency cleanup for stream ${streamId}:`, error);
    }
  }

  private static shouldAutoEnd(streamData: any): boolean {
    // In development/Expo Go, do not auto-end streams that at least include the host
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const hasHosts = !!streamData?.participants?.some((p: any) => p?.isHost || p?.role === 'host');
      if (hasHosts) {
        return false;
      }
    }

    const hasParticipants = Array.isArray(streamData?.participants) && streamData.participants.length > 0;
    const hasHosts = !!streamData?.participants?.some((p: any) => p?.isHost);
    return !hasParticipants || !hasHosts;
  }
}

export default StreamCleanupService;
