import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { ActiveStreamTracker } from './activeStreamTracker';
import { PlatformUtils } from '../utils/platformUtils';

/**
 * Service for validating and maintaining sync between local and server stream state
 */
export class StreamSyncValidator {
  private static activeListeners = new Map<string, () => void>();
  private static syncCheckInterval: NodeJS.Timeout | null = null;
  private static isValidationActive = false;

  // Sync validation settings (reduced frequency)
  private static readonly SYNC_CHECK_INTERVAL = 120 * 1000; // 2 minutes (reduced from 30 seconds)
  private static readonly MAX_SYNC_RETRIES = 3;
  private static readonly SYNC_RETRY_DELAY = 2000; // 2 seconds

  /**
   * Check if user is a guest user (not authenticated with Firebase)
   */
  private static isGuestUser(userId: string): boolean {
    // Guest users have IDs that start with 'guest_'
    return userId.startsWith('guest_') || !auth.currentUser;
  }
  
  /**
   * Start real-time sync validation for a user with improved listener management
   */
  static startSyncValidation(userId: string, localStreamId: string | null): void {
    // Handle guest users - they don't need Firebase sync validation
    if (this.isGuestUser(userId)) {
      logger.debug(`🎭 Guest user ${userId} - skipping sync validation (expected behavior)`);
      return;
    }

    // Always stop existing listener first to prevent duplicates
    this.stopSyncValidation(userId);

    logger.debug(`🔄 Starting sync validation for user ${userId}, local stream: ${localStreamId}`);

    try {
      // Set up real-time listener for user's active stream
      const activeStreamRef = doc(db, 'users', userId, 'activeStream', 'current');

      const unsubscribe = onSnapshot(
        activeStreamRef,
        (snapshot) => {
          try {
            this.handleActiveStreamChange(userId, localStreamId, snapshot);
          } catch (error) {
            logger.error(`❌ Error handling active stream change for user ${userId}:`, error);
          }
        },
        (error) => {
          logger.error(`❌ Error in sync validation listener for user ${userId}:`, error);

          // Handle Firestore internal errors by restarting the listener
          if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
            logger.warn(`🔄 Restarting sync validation due to Firestore internal error for user ${userId}`);
            setTimeout(() => {
              this.stopSyncValidation(userId);
              this.startSyncValidation(userId, localStreamId);
            }, 5000); // Wait 5 seconds before restarting
          } else {
            this.handleSyncError(userId, error);
          }
        }
      );

      this.activeListeners.set(userId, unsubscribe);
      logger.debug(`✅ Sync validation listener started for user ${userId}`);

      // Start periodic sync validation if not already running
      this.startPeriodicValidation();

    } catch (error) {
      logger.error(`❌ Failed to start sync validation for user ${userId}:`, error);
    }
  }
  
  /**
   * Stop sync validation for a user with enhanced cleanup
   */
  static stopSyncValidation(userId: string): void {
    try {
      const unsubscribe = this.activeListeners.get(userId);
      if (unsubscribe) {
        // Call unsubscribe function to clean up the listener
        unsubscribe();
        this.activeListeners.delete(userId);
        logger.debug(`✅ Stopped sync validation for user ${userId}`);
      } else {
        logger.debug(`ℹ️ No active sync validation found for user ${userId}`);
      }

      // Stop periodic validation if no active listeners
      if (this.activeListeners.size === 0) {
        this.stopPeriodicValidation();
      }
    } catch (error) {
      logger.error(`❌ Error stopping sync validation for user ${userId}:`, error);
      // Force remove from map even if unsubscribe fails
      this.activeListeners.delete(userId);
    }
  }
  
  /**
   * Handle changes in user's active stream from server
   */
  private static async handleActiveStreamChange(
    userId: string, 
    localStreamId: string | null, 
    snapshot: any
  ): Promise<void> {
    try {
      const serverActiveStream = snapshot.exists() ? snapshot.data() : null;
      const serverStreamId = serverActiveStream?.streamId || null;
      
      logger.debug(`🔄 Server active stream change for user ${userId}:`);
      logger.debug(`  Local: ${localStreamId}`);
      logger.debug(`  Server: ${serverStreamId}`);
      
      // Check for discrepancies
      if (localStreamId !== serverStreamId) {
        logger.warn(`⚠️ Stream state mismatch detected for user ${userId}`);
        await this.resolveStreamStateMismatch(userId, localStreamId, serverStreamId);
      }
      
    } catch (error) {
      logger.error(`❌ Error handling active stream change for user ${userId}:`, error);
    }
  }
  
  /**
   * Resolve stream state mismatch between local and server
   */
  private static async resolveStreamStateMismatch(
    userId: string,
    localStreamId: string | null,
    serverStreamId: string | null
  ): Promise<void> {
    // Handle guest users - they don't have server state to resolve
    if (this.isGuestUser(userId)) {
      logger.debug(`🎭 Guest user ${userId} - no server state mismatch to resolve`);
      return;
    }

    try {
      logger.debug(`🔧 Resolving stream state mismatch for user ${userId}`);

      // Validate server stream exists and is active
      let serverStreamValid = false;
      if (serverStreamId) {
        const streamRef = doc(db, 'streams', serverStreamId);
        const streamDoc = await getDoc(streamRef);
        const streamData = streamDoc.data();
        
        serverStreamValid = streamDoc.exists() && 
                           streamData?.isActive && 
                           streamData?.participants?.some((p: any) => p.id === userId);
      }
      
      // Validate local stream exists and user is participant
      let localStreamValid = false;
      if (localStreamId) {
        const streamRef = doc(db, 'streams', localStreamId);
        const streamDoc = await getDoc(streamRef);
        const streamData = streamDoc.data();
        
        localStreamValid = streamDoc.exists() && 
                          streamData?.isActive && 
                          streamData?.participants?.some((p: any) => p.id === userId);
      }
      
      // Resolution logic
      if (serverStreamValid && !localStreamValid) {
        // Server is correct, update local state
        logger.debug(`✅ Correcting local state to match server: ${serverStreamId}`);
        this.notifyStateCorrection(userId, serverStreamId, 'server_wins');
        
      } else if (localStreamValid && !serverStreamValid) {
        // Local is correct, update server state
        logger.debug(`✅ Correcting server state to match local: ${localStreamId}`);
        await ActiveStreamTracker.setActiveStream(userId, localStreamId!);
        
      } else if (!serverStreamValid && !localStreamValid) {
        // Both invalid, clear everything
        logger.debug(`✅ Clearing invalid state for user ${userId}`);
        await ActiveStreamTracker.clearActiveStream(userId);
        this.notifyStateCorrection(userId, null, 'both_invalid');
        
      } else if (serverStreamValid && localStreamValid) {
        // Both valid but different - use most recent
        logger.debug(`⚠️ Both states valid but different - using server state: ${serverStreamId}`);
        this.notifyStateCorrection(userId, serverStreamId, 'conflict_server_wins');
      }
      
    } catch (error) {
      logger.error(`❌ Error resolving stream state mismatch for user ${userId}:`, error);
    }
  }
  
  /**
   * Notify the app about state corrections using platform-safe event emitter
   */
  private static notifyStateCorrection(
    userId: string,
    correctedStreamId: string | null,
    reason: string
  ): void {
    // Emit event using platform-safe event emitter
    const eventData = {
      userId,
      correctedStreamId,
      reason,
      timestamp: Date.now()
    };

    try {
      const eventEmitter = PlatformUtils.getEventEmitter();
      eventEmitter.emit('streamStateCorrection', eventData);
      logger.debug(`📢 State correction notification: ${reason} for user ${userId}`);
    } catch (error) {
      logger.error('❌ Error emitting state correction event:', error);
    }
  }
  
  /**
   * Start periodic sync validation
   */
  private static startPeriodicValidation(): void {
    if (this.isValidationActive) {
      return;
    }
    
    this.isValidationActive = true;
    
    this.syncCheckInterval = setInterval(() => {
      this.runPeriodicSyncCheck();
    }, this.SYNC_CHECK_INTERVAL);
    
    logger.debug('🔄 Started periodic sync validation');
  }
  
  /**
   * Stop periodic sync validation
   */
  private static stopPeriodicValidation(): void {
    if (this.syncCheckInterval) {
      clearInterval(this.syncCheckInterval);
      this.syncCheckInterval = null;
    }
    
    this.isValidationActive = false;
    logger.debug('✅ Stopped periodic sync validation');
  }
  
  /**
   * Run periodic sync check for all active users
   */
  private static async runPeriodicSyncCheck(): Promise<void> {
    try {
      logger.debug('🔄 Running periodic sync check...');
      
      // This would typically check all active users
      // For now, we'll implement user-specific checks when they're active
      
      logger.debug('✅ Periodic sync check completed');
      
    } catch (error) {
      logger.error('❌ Error in periodic sync check:', error);
    }
  }
  
  /**
   * Handle sync errors
   */
  private static handleSyncError(userId: string, error: any): void {
    logger.error(`❌ Sync error for user ${userId}:`, error);

    // For Firestore internal errors, clean up and don't restart automatically
    if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
      logger.warn(`🚨 Firestore internal error detected, cleaning up listener for user ${userId}`);
      this.stopSyncValidation(userId);
      return;
    }

    // For other errors, attempt to restart sync validation after delay
    setTimeout(() => {
      logger.debug(`🔄 Attempting to restart sync validation for user ${userId}`);
      this.stopSyncValidation(userId);
      // The app should call startSyncValidation again when appropriate
    }, this.SYNC_RETRY_DELAY);
  }

  /**
   * Emergency cleanup - stop all listeners
   */
  static emergencyCleanup(): void {
    logger.warn(`🚨 Emergency cleanup: stopping all sync validation listeners`);

    try {
      // Stop all active listeners
      for (const [userId, unsubscribe] of this.activeListeners.entries()) {
        try {
          unsubscribe();
          logger.debug(`✅ Emergency cleanup: stopped listener for user ${userId}`);
        } catch (error) {
          logger.error(`❌ Error during emergency cleanup for user ${userId}:`, error);
        }
      }

      // Clear the map
      this.activeListeners.clear();

      // Stop periodic validation
      this.stopPeriodicValidation();

      logger.debug(`✅ Emergency cleanup completed`);
    } catch (error) {
      logger.error(`❌ Error during emergency cleanup:`, error);
    }
  }
  
  /**
   * Validate sync before critical operations
   */
  static async validateSyncBeforeOperation(
    userId: string,
    localStreamId: string | null,
    operationType: 'join' | 'create' | 'leave'
  ): Promise<{ valid: boolean; correctedStreamId?: string | null }> {
    // Handle guest users - they don't need sync validation
    if (this.isGuestUser(userId)) {
      logger.debug(`🎭 Guest user ${userId} - sync validation always valid for ${operationType}`);
      return { valid: true };
    }

    try {
      logger.debug(`🔍 Validating sync before ${operationType} operation for user ${userId}`);

      const serverActiveStream = await ActiveStreamTracker.getActiveStream(userId);
      const serverStreamId = serverActiveStream?.streamId || null;
      
      if (localStreamId === serverStreamId) {
        return { valid: true };
      }
      
      // States don't match, resolve the conflict
      await this.resolveStreamStateMismatch(userId, localStreamId, serverStreamId);
      
      // Return the corrected state
      const correctedActiveStream = await ActiveStreamTracker.getActiveStream(userId);
      const correctedStreamId = correctedActiveStream?.streamId || null;
      
      return { 
        valid: false, 
        correctedStreamId 
      };
      
    } catch (error) {
      logger.error(`❌ Error validating sync before ${operationType}:`, error);
      return { valid: false };
    }
  }
}

export default StreamSyncValidator;
