import { firestoreService } from './firestoreService';
import { LiveStream, StreamHost, StreamViewer } from '../context/LiveStreamContext';
import { agoraService, AgoraEventCallbacks } from './agoraService';
import { isAgoraConfigured } from '../config/agoraConfig';
import { ActiveStreamTracker } from './activeStreamTracker';
import { StreamCleanupService } from './streamCleanupService';
import UserDataSanitizer from '../utils/userDataSanitizer';
import { auth } from './firebase';
import { throttledLog } from '../utils/loggingThrottle';

export interface StreamParticipant {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  joinedAt: number;
}

export interface StreamSession {
  id: string;
  title: string;
  hostId: string;
  participants: StreamParticipant[];
  startedAt: number;
  isActive: boolean;
  viewerCount: number;
}

class StreamingService {
  private activeStreams = new Map<string, StreamSession>();
  private streamListeners = new Map<string, () => void>();
  private currentStreamId: string | null = null;
  private uiUpdateCallback: ((streams: LiveStream[]) => void) | null = null;
  private cleanupServiceStarted = false;

  constructor() {
    // Start cleanup service when streaming service is initialized
    this.initializeCleanupService();
  }

  private initializeCleanupService(): void {
    if (!this.cleanupServiceStarted) {
      StreamCleanupService.startCleanupService();
      this.cleanupServiceStarted = true;
      logger.debug('✅ Stream cleanup service initialized');
    }
  }

  // Initialize a new stream with Agora integration
  async createStream(
    title: string,
    hostId: string,
    hostName: string,
    hostAvatar: string
  ): Promise<string> {
    // Check authentication first
    if (!auth?.currentUser) {
      throw new Error('Authentication required to create a stream');
    }

    if (auth.currentUser.uid !== hostId) {
      throw new Error('User can only create streams for themselves');
    }

    // Declare streamId outside try block so it's available in catch block
    let streamId: string | null = null;

    try {
      // Check if user is already in another stream
      const isInAnotherStream = await ActiveStreamTracker.isUserInAnotherStream(hostId, '');
      if (isInAnotherStream) {
        // Clean up any stale active stream records before throwing error
        logger.debug(`🧹 User ${hostId} appears to be in another stream, attempting cleanup...`);
        await ActiveStreamTracker.cleanupOrphanedStreams(hostId);

        // Check again after cleanup
        const stillInAnotherStream = await ActiveStreamTracker.isUserInAnotherStream(hostId, '');
        if (stillInAnotherStream) {
          throw new Error('User is already participating in another active stream');
        }
        logger.debug(`✅ Cleanup successful, proceeding with stream creation`);
      }

      streamId = `stream_${Date.now()}_${hostId}`;

      // Ensure title is never empty - use fallback if needed
      const finalTitle = (title && title.trim()) ? title.trim() : 'Live Stream';

      // Sanitize data to prevent undefined values in Firestore
      const streamData = {
        title: finalTitle,
        hostId,
        participants: [{
          id: hostId,
          name: hostName,
          avatar: hostAvatar || null, // Ensure no undefined values
          isHost: true,
          role: 'host',
          isSpeaking: false,
          isMuted: false,
          joinedAt: Date.now()
        }],
        startedAt: Date.now(),
        isActive: true,
        viewerCount: 0
      };

      // Sanitize stream data to remove any undefined values before storing
      const sanitizedStreamData = UserDataSanitizer.removeUndefinedValues(streamData);

      logger.debug('🔧 Sanitized stream data:', sanitizedStreamData);

      // Store in Firebase
      await firestoreService.createStream(streamId, sanitizedStreamData);
      logger.debug(`✅ Stream ${streamId} created in Firebase with isActive: true`);

      // Set user's active stream
      await ActiveStreamTracker.setActiveStream(hostId, streamId);

      // Small delay to ensure Firebase write propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Initialize Agora if configured
      if (isAgoraConfigured()) {
        logger.debug('🔄 Initializing Agora for new stream...');
        const initialized = await agoraService.initialize();
        if (initialized) {
          // Join as host
          await agoraService.joinChannel(streamId, hostId, true);
          logger.debug('✅ Host joined Agora channel successfully');
        } else {
          logger.warn('⚠️ Agora initialization failed, continuing with Firebase-only mode');
        }
      } else {
        logger.debug('ℹ️ Agora not configured, using Firebase-only mode');
      }

      const session: StreamSession = {
        id: streamId,
        ...streamData
      };

      this.activeStreams.set(streamId, session);
      this.currentStreamId = streamId;
      return streamId;
    } catch (error) {
      logger.error('Error creating stream:', error);

      // Cleanup partial failure - only if streamId was generated
      if (streamId) {
        try {
          await ActiveStreamTracker.cleanupPartialFailure(hostId, streamId, 'create');
        } catch (cleanupError) {
          logger.error('Error in create stream cleanup:', cleanupError);
        }
      }

      throw error;
    }
  }

  // Join a stream as viewer
  async joinStream(
    streamId: string,
    userId: string,
    userName: string,
    userAvatar: string
  ): Promise<void> {
    try {
      // Check if user is already in another stream
      const isInAnotherStream = await ActiveStreamTracker.isUserInAnotherStream(userId, streamId);
      if (isInAnotherStream) {
        throw new Error('User is already participating in another active stream');
      }

      // First try to get from local cache
      let session = this.activeStreams.get(streamId);

      // If not in cache, fetch from Firebase
      if (!session) {
        logger.debug(`🔄 Stream ${streamId} not in cache, fetching from Firebase...`);
        const streamData = await firestoreService.getStreamById(streamId);

        if (!streamData) {
          throw new Error(`Stream ${streamId} not found in Firebase`);
        }

        if (!streamData.isActive) {
          throw new Error(`Stream ${streamId} is no longer active`);
        }

        // Create session from Firebase data
        session = {
          id: streamId,
          ...streamData
        };

        // Add to local cache
        this.activeStreams.set(streamId, session);
        logger.debug(`✅ Loaded stream ${streamId} from Firebase into cache`);
      }

      // Check if user is already a participant
      const existingParticipant = session.participants.find(p => p.id === userId);
      if (existingParticipant) {
        logger.debug(`ℹ️ User ${userId} already in stream ${streamId}`);
        // Still set active stream in case it wasn't tracked
        await ActiveStreamTracker.setActiveStream(userId, streamId);
        return; // Already joined
      }

      const newParticipant: StreamParticipant = {
        id: userId,
        name: userName,
        avatar: userAvatar,
        isHost: false,
        isSpeaking: false,
        isMuted: false,
        joinedAt: Date.now()
      };

      // Update session
      session.participants.push(newParticipant);
      session.viewerCount = session.participants.filter(p => !p.isHost).length;

      // Update Firebase
      await firestoreService.updateStreamParticipants(streamId, session.participants);
      await firestoreService.updateStreamViewerCount(streamId, session.viewerCount);

      // Set user's active stream
      await ActiveStreamTracker.setActiveStream(userId, streamId);

      logger.debug(`✅ User ${userName} joined stream ${streamId} (${session.participants.length} total participants)`);

      // Join Agora channel if configured
      if (isAgoraConfigured()) {
        logger.debug(`🔄 Joining Agora channel: ${streamId} as viewer`);

        // Set up Agora event callbacks for this stream
        this.setupAgoraCallbacks(streamId);

        // Join as audience member
        const joined = await agoraService.joinChannel(streamId, userId, false);
        if (joined) {
          logger.debug('✅ Successfully joined Agora channel as viewer');
          this.currentStreamId = streamId;
        } else {
          logger.warn('⚠️ Failed to join Agora channel, continuing with Firebase-only mode');
        }
      }

    } catch (error) {
      logger.error('Error joining stream:', error);

      // Cleanup partial failure
      try {
        await ActiveStreamTracker.cleanupPartialFailure(userId, streamId, 'join');
      } catch (cleanupError) {
        logger.error('Error in join stream cleanup:', cleanupError);
      }

      throw error;
    }
  }

  // Leave a stream with Agora integration and automatic ending logic
  async leaveStream(streamId: string, userId: string): Promise<void> {
    try {
      logger.debug(`🔄 [STREAMING] User ${userId} leaving stream ${streamId}...`);

      // First try to get from local cache
      let session = this.activeStreams.get(streamId);

      // If not in cache, fetch from Firebase
      if (!session) {
        logger.debug(`🔄 [STREAMING] Stream ${streamId} not in cache, fetching from Firebase for leave operation...`);
        const streamData = await firestoreService.getStreamById(streamId);

        if (!streamData) {
          logger.debug(`ℹ️ [STREAMING] Stream ${streamId} not found in Firebase, assuming already ended`);
          return;
        }

        logger.debug(`📊 [STREAMING] Fetched stream ${streamId} from Firebase:`, {
          participants: streamData.participants?.length || 0,
          isActive: streamData.isActive
        });

        // Create session from Firebase data
        session = {
          id: streamId,
          ...streamData
        };

        // Add to local cache
        this.activeStreams.set(streamId, session);
      }

      // Leave Agora channel if this is the current stream
      if (isAgoraConfigured() && this.currentStreamId === streamId) {
        logger.debug('🔄 [STREAMING] Leaving Agora channel...');
        await agoraService.leaveChannel();
        this.currentStreamId = null;
      }

      // Log current participants before removal
      logger.debug(`📊 [STREAMING] Current participants before removal:`, session.participants.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })));

      // Remove participant
      const initialParticipantCount = session.participants.length;
      session.participants = session.participants.filter(p => p.id !== userId);
      session.viewerCount = session.participants.filter(p => !p.isHost).length;

      // Clear user's active stream
      await ActiveStreamTracker.clearActiveStream(userId);

      logger.debug(`📊 [STREAMING] Participant count: ${initialParticipantCount} → ${session.participants.length}`);
      logger.debug(`📊 [STREAMING] Remaining participants:`, session.participants.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })));

      // Check if stream should end automatically
      const shouldEndStream = this.shouldEndStreamAutomatically(session);

      logger.debug(`🔍 [STREAMING] Stream ${streamId} auto-end analysis:`);
      logger.debug(`  - Participants: ${session.participants.length}`);
      logger.debug(`  - Hosts: ${session.participants.filter(p => p.isHost).length}`);
      logger.debug(`  - Viewers: ${session.participants.filter(p => !p.isHost).length}`);
      logger.debug(`  - Should end: ${shouldEndStream}`);
      logger.debug(`  - Participant details:`, session.participants.map(p => ({ id: p.id, name: p.name, isHost: p.isHost })));

      // CRITICAL DEBUG: Log the exact logic check
      logger.debug(`🔍 [STREAMING] shouldEndStreamAutomatically() logic check:`);
      logger.debug(`  - session.participants.length === 0: ${session.participants.length === 0}`);
      logger.debug(`  - hasHosts: ${session.participants.some(p => p.isHost)}`);
      logger.debug(`  - Final result: ${shouldEndStream}`);

      if (shouldEndStream) {
        logger.debug(`🔄 [STREAMING] Auto-ending stream ${streamId} - no participants remaining`);

        // Use lifecycle manager for proper stream ending
        const StreamLifecycleManager = (await import('../utils/streamLifecycleManager')).default;
        const reason = session.participants.length === 0
          ? { type: 'no_participants' as const }
          : { type: 'host_left' as const };

        await StreamLifecycleManager.endStreamWithLifecycle(streamId, reason, userId);
        logger.debug(`✅ [STREAMING] Stream ${streamId} ended successfully with lifecycle management`);
      } else {
        // Update Firebase with new participant list
        throttledLog(`stream-update-${streamId}`, `🔄 [STREAMING] Updating Firebase with new participant list for stream ${streamId}`, 10000);
        await firestoreService.updateStreamParticipants(streamId, session.participants);
        await firestoreService.updateStreamViewerCount(streamId, session.viewerCount);
        throttledLog(`stream-update-complete-${streamId}`, `✅ [STREAMING] Updated stream ${streamId} - ${session.participants.length} participants remaining`, 10000);
      }

    } catch (error) {
      logger.error('❌ [STREAMING] Error leaving stream:', error);
      throw error;
    }
  }

  // Check if stream should end automatically based on participant count
  private shouldEndStreamAutomatically(session: StreamSession): boolean {
    // End stream if no participants at all
    if (session.participants.length === 0) {
      return true;
    }

    // End stream if no hosts remaining (all hosts left)
    const hasHosts = session.participants.some(p => p.isHost);
    if (!hasHosts) {
      return true;
    }

    return false;
  }

  // Check if a user is the host/creator of a stream
  async isUserStreamHost(streamId: string, userId: string): Promise<boolean> {
    // First try to get from local cache
    let session = this.activeStreams.get(streamId);

    // If not in cache, try to fetch from Firebase
    if (!session) {
      try {
        const streamData = await firestoreService.getStreamById(streamId);
        if (streamData) {
          session = {
            id: streamId,
            ...streamData
          };
          this.activeStreams.set(streamId, session);
        }
      } catch (error) {
        logger.error('Error fetching stream data:', error);
        return false;
      }
    }

    if (!session) return false;

    // Check if user is the original creator (hostId)
    if (session.hostId === userId) {
      return true;
    }

    // Also check if user is currently a host participant
    const participant = session.participants.find(p => p.id === userId);
    return participant?.isHost || false;
  }

  // Get stream session for external access
  getStreamSession(streamId: string): StreamSession | undefined {
    return this.activeStreams.get(streamId);
  }

  // Clean up ghost participants (participants who disconnected without properly leaving)
  async cleanupGhostParticipants(streamId: string): Promise<void> {
    try {
      const session = this.activeStreams.get(streamId);
      if (!session) return;

      // In a real implementation, you would check for participants who haven't been active
      // for a certain period. For now, we'll just ensure the stream data is consistent.

      // Update Firebase with current participant list to ensure consistency
      await firestoreService.updateStreamParticipants(streamId, session.participants);
      await firestoreService.updateStreamViewerCount(streamId, session.viewerCount);

      // Check if stream should end after cleanup
      const shouldEnd = this.shouldEndStreamAutomatically(session);
      if (shouldEnd) {
        logger.debug(`🧹 Ending stream ${streamId} after ghost participant cleanup`);
        await this.endStream(streamId);
      }
    } catch (error) {
      logger.error('Error cleaning up ghost participants:', error);
    }
  }

  // Handle app crash/force-close cleanup
  async handleAppCrashCleanup(userId: string): Promise<void> {
    try {
      // Find all streams where this user is a participant
      const userStreams = Array.from(this.activeStreams.values()).filter(session =>
        session.participants.some(p => p.id === userId)
      );

      for (const session of userStreams) {
        logger.debug(`🧹 Cleaning up user ${userId} from stream ${session.id} after app crash`);
        await this.leaveStream(session.id, userId);
      }
    } catch (error) {
      logger.error('Error handling app crash cleanup:', error);
    }
  }

  // End a stream
  async endStream(streamId: string): Promise<void> {
    try {
      logger.debug(`🔄 [STREAMING] Ending stream ${streamId}...`);

      // Check if stream is already ended to avoid duplicate operations
      const session = this.activeStreams.get(streamId);
      if (session && !session.isActive) {
        logger.debug(`ℹ️ [STREAMING] Stream ${streamId} already marked as inactive, skipping`);
        return;
      }

      if (session) {
        logger.debug(`📊 [STREAMING] Stream ${streamId} before ending:`, {
          participants: session.participants?.length || 0,
          isActive: session.isActive,
          viewerCount: session.viewerCount
        });
        session.isActive = false;
      } else {
        logger.debug(`⚠️ [STREAMING] Stream ${streamId} not found in local cache, proceeding with Firebase cleanup`);
      }

      // Prefer server-side end+cleanup to avoid client permission issues
      logger.debug(`🔄 [STREAMING] Requesting server to end stream ${streamId} and cleanup participants...`);
      try {
        const { functions } = await import('./firebase');
        const { httpsCallable } = await import('firebase/functions');
        const endStreamAndCleanup = httpsCallable(functions, 'endStreamAndCleanup');
        await endStreamAndCleanup({ streamId });
        logger.debug(`✅ [STREAMING] Server-side endStreamAndCleanup completed for ${streamId}`);
      } catch (fnErr) {
        logger.warn('⚠️ [STREAMING] Server-side cleanup failed or unavailable, falling back to client update:', fnErr);
        // Fallback: Update Firestore directly
        await firestoreService.endStream(streamId, 'system_cleanup');
        logger.debug(`✅ [STREAMING] Fallback: marked stream ${streamId} as ended in Firestore`);
      }

      // Leave Agora channel if this is the current stream
      if (isAgoraConfigured() && this.currentStreamId === streamId) {
        logger.debug('🔄 [STREAMING] Leaving Agora channel for ended stream...');
        await agoraService.leaveChannel();
        this.currentStreamId = null;
      }

      // Clean up local state
      logger.debug(`🧹 [STREAMING] Cleaning up local state for stream ${streamId}`);
      this.activeStreams.delete(streamId);

      // Clean up listeners
      const listener = this.streamListeners.get(streamId);
      if (listener) {
        logger.debug(`🧹 [STREAMING] Cleaning up listener for stream ${streamId}`);
        listener();
        this.streamListeners.delete(streamId);
      }

      // CRITICAL FIX: Immediate UI update for instant stream removal
      throttledLog(`ui-update-${streamId}`, `🔄 [STREAMING] Triggering immediate UI update for stream ${streamId}`, 5000);
      this.triggerManualUIUpdate();

      // Also trigger a delayed update to ensure Firebase changes are reflected
      setTimeout(() => {
        throttledLog(`ui-update-delayed-${streamId}`, `🔄 [STREAMING] Triggering delayed UI update for stream ${streamId}`, 5000);
        this.triggerManualUIUpdate();
      }, 1000);

      logger.debug(`✅ [STREAMING] Stream ${streamId} ended and cleaned up successfully`);

    } catch (error) {
      logger.error(`❌ [STREAMING] Error ending stream ${streamId}:`, error);
      // Still clean up local state even if Firebase update fails
      logger.debug(`🧹 [STREAMING] Cleaning up local state despite error for stream ${streamId}`);
      this.activeStreams.delete(streamId);
      const listener = this.streamListeners.get(streamId);
      if (listener) {
        listener();
        this.streamListeners.delete(streamId);
      }

      // Still trigger immediate UI update even on error
      throttledLog(`ui-update-error-${streamId}`, `🔄 [STREAMING] Triggering immediate UI update after error for stream ${streamId}`, 5000);
      this.triggerManualUIUpdate();
      throw error;
    }
  }

  // Debug function to manually test cleanup
  async debugCleanupTest(): Promise<void> {
    logger.debug('🔧 [DEBUG] Starting manual cleanup test...');

    try {
      // Get all streams and log detailed info
      const allStreams = await firestoreService.getActiveStreams();
      logger.debug(`🔧 [DEBUG] Found ${allStreams.length} active streams in Firebase`);

      for (const stream of allStreams) {
        logger.debug(`🔧 [DEBUG] Stream ${stream.id} detailed analysis:`, {
          id: stream.id,
          title: stream.title,
          isActive: stream.isActive,
          hostId: stream.hostId,
          participants: stream.participants,
          participantCount: stream.participants?.length || 0,
          hasHosts: stream.participants?.some((p: any) => p.isHost) || false,
          startedAt: StreamingService.safeConvertTimestamp(stream.startedAt),
          createdAt: StreamingService.safeConvertTimestamp(stream.createdAt)
        });

        // Test if this stream should be cleaned up
        const participants = stream.participants || [];
        const hasParticipants = participants.length > 0;
        const hasHosts = participants.some((p: any) => p.isHost);

        if (!hasParticipants || !hasHosts) {
          logger.debug(`🔧 [DEBUG] Stream ${stream.id} SHOULD BE CLEANED UP - attempting cleanup now...`);

          try {
            await this.endStream(stream.id);
            logger.debug(`🔧 [DEBUG] Successfully ended stream ${stream.id}`);

            // Verify it was actually ended
            const updatedStream = await firestoreService.getStreamById(stream.id);
            logger.debug(`🔧 [DEBUG] Stream ${stream.id} after cleanup:`, {
              exists: !!updatedStream,
              isActive: updatedStream?.isActive,
              endedAt: updatedStream?.endedAt
            });

          } catch (error) {
            logger.error(`🔧 [DEBUG] Failed to end stream ${stream.id}:`, error);
          }
        } else {
          logger.debug(`🔧 [DEBUG] Stream ${stream.id} is valid - keeping`);
        }
      }

    } catch (error) {
      logger.error('🔧 [DEBUG] Error during debug cleanup test:', error);
    }
  }

  // Force cleanup of all phantom/empty streams
  async forceCleanupPhantomStreams(): Promise<void> {
    try {
      logger.debug('🧹 [STREAMING] Starting force cleanup of phantom streams...');

      const allStreams = await firestoreService.getActiveStreams();
      logger.debug(`📊 [STREAMING] Found ${allStreams.length} streams in Firebase for cleanup check`);

      // Log detailed info about each stream
      for (const stream of allStreams) {
        logger.debug(`🔍 [STREAMING] Stream ${stream.id} analysis:`, {
          participants: stream.participants?.length || 0,
          hasHosts: stream.participants?.some((p: any) => p.isHost) || false,
          isActive: stream.isActive,
          title: stream.title
        });
      }

      const streamsToEnd = [];

      for (const streamData of allStreams) {
        const participants = streamData.participants || [];
        const hasParticipants = participants.length > 0;
        const hasHosts = participants.some((p: any) => p.isHost);

        logger.debug(`🔍 [STREAMING] Cleanup check for stream ${streamData.id}: ${participants.length} participants, hasHosts=${hasHosts}`);

        if (!hasParticipants || !hasHosts) {
          logger.debug(`🚨 [STREAMING] Marking phantom stream ${streamData.id} for immediate cleanup`);
          streamsToEnd.push(streamData.id);
        }
      }

      if (streamsToEnd.length > 0) {
        logger.debug(`🧹 [STREAMING] Force ending ${streamsToEnd.length} phantom streams: ${streamsToEnd.join(', ')}`);

        // End all phantom streams synchronously to ensure they're cleaned up
        for (const streamId of streamsToEnd) {
          try {
            logger.debug(`🧹 [STREAMING] Attempting to end phantom stream ${streamId}...`);
            await this.endStream(streamId);
            logger.debug(`✅ [STREAMING] Successfully ended phantom stream ${streamId}`);

            // Verify the stream was actually ended
            const verifyStream = await firestoreService.getStreamById(streamId);
            logger.debug(`🔍 [STREAMING] Verification for stream ${streamId}:`, {
              exists: !!verifyStream,
              isActive: verifyStream?.isActive,
              endedAt: verifyStream?.endedAt
            });

          } catch (error) {
            logger.error(`❌ [STREAMING] Failed to end phantom stream ${streamId}:`, error);
          }
        }
      } else {
        logger.debug('✅ [STREAMING] No phantom streams found during force cleanup');
      }

    } catch (error) {
      logger.error('❌ [STREAMING] Error during force cleanup:', error);
    }
  }

  // Get active streams
  async getActiveStreams(): Promise<LiveStream[]> {
    try {
      const streams = await firestoreService.getActiveStreams();
      logger.debug(`📊 [STREAMING] Fetched ${streams.length} streams from Firebase`);

      // Log raw Firebase data for debugging
      logger.debug(`🔍 [STREAMING] Raw Firebase stream data:`, streams.map(s => ({
        id: s.id,
        title: s.title,
        isActive: s.isActive,
        participants: s.participants,
        hostId: s.hostId,
        startedAt: StreamingService.safeConvertTimestamp(s.startedAt)
      })));

      // Filter and validate streams
      const validStreams = [];
      const streamsToEnd = [];

      for (const streamData of streams) {
        logger.debug(`🔍 [STREAMING] Analyzing stream ${streamData.id}:`, {
          title: streamData.title,
          hostId: streamData.hostId,
          isActive: streamData.isActive,
          participants: streamData.participants?.length || 0,
          participantDetails: streamData.participants?.map((p: any) => ({ id: p.id, name: p.name, isHost: p.isHost })) || []
        });

        // Ensure participants array exists
        if (!streamData.participants) {
          logger.debug(`⚠️ [STREAMING] Stream ${streamData.id} has no participants array, initializing empty array`);
          streamData.participants = [];
        }

        // Check if stream should be ended due to no participants
        const hasParticipants = streamData.participants.length > 0;
        const hasHosts = streamData.participants.some((p: any) => p.isHost);

        logger.debug(`🔍 [STREAMING] Stream ${streamData.id} validation: hasParticipants=${hasParticipants}, hasHosts=${hasHosts}`);

        if (!hasParticipants || !hasHosts) {
          logger.debug(`🚨 [STREAMING] Stream ${streamData.id} has no participants or hosts, marking for cleanup`);
          streamsToEnd.push(streamData.id);
        } else {
          logger.debug(`✅ [STREAMING] Stream ${streamData.id} is valid, keeping in list`);
          validStreams.push(streamData);
        }
      }

      // End streams that should be cleaned up (async, don't wait)
      streamsToEnd.forEach(streamId => {
        logger.debug(`🧹 Auto-ending empty stream ${streamId} during fetch`);
        this.endStream(streamId).catch(error => {
          logger.error(`Failed to end empty stream ${streamId}:`, error);
        });
      });

      // Update local cache with valid streams only
      validStreams.forEach(streamData => {
        const session: StreamSession = {
          id: streamData.id,
          ...streamData
        };
        this.activeStreams.set(streamData.id, session);
      });

      logger.debug(`✅ Loaded ${validStreams.length} valid streams, ended ${streamsToEnd.length} empty streams`);
      return validStreams.map(StreamingService.convertToLiveStream);
    } catch (error) {
      logger.error('Error getting active streams:', error);
      return [];
    }
  }

  // Listen to stream updates
  onStreamUpdate(streamId: string, callback: (session: StreamSession) => void): () => void {
    // Set up Firebase listener
    const unsubscribe = firestoreService.onStreamUpdate(streamId, (data) => {
      const session: StreamSession = {
        id: streamId,
        ...data
      };
      this.activeStreams.set(streamId, session);
      callback(session);
    });

    this.streamListeners.set(streamId, unsubscribe);
    return unsubscribe;
  }

  // Listen to all active streams (for global updates)
  onActiveStreamsUpdate(callback: (streams: LiveStream[]) => void): () => void {
    logger.debug(`🔄 [STREAMING] Setting up real-time listener for active streams`);

    // Store the callback for manual UI updates
    this.uiUpdateCallback = callback;

    // Set up Firebase listener for active streams collection
    const unsubscribe = firestoreService.onActiveStreamsUpdate((streamsData) => {
      logger.debug(`🔄 [STREAMING] Real-time update: ${streamsData.length} active streams received from Firebase`);

      // Log details of each stream received
      streamsData.forEach((stream, index) => {
        const participants = stream.participants || [];
        const hosts = participants.filter((p: any) => p.isHost);
        const viewers = participants.filter((p: any) => !p.isHost);
        logger.debug(`📊 [STREAMING] Stream ${index + 1}: ${stream.id} - ${participants.length} participants (${hosts.length} hosts, ${viewers.length} viewers)`);
      });

      // Filter and validate streams before processing
      const validStreams = [];
      const streamsToEnd = [];

      for (const streamData of streamsData) {
        // Ensure participants array exists
        if (!streamData.participants) {
          logger.debug(`⚠️ [STREAMING] Stream ${streamData.id} has no participants array, initializing empty array`);
          streamData.participants = [];
        }

        // Check if stream should be ended due to no participants
        const hasParticipants = streamData.participants.length > 0;
        const hasHosts = streamData.participants.some((p: any) => p.isHost);

        logger.debug(`🔍 [STREAMING] Stream ${streamData.id} validation: hasParticipants=${hasParticipants}, hasHosts=${hasHosts}`);

        if (!hasParticipants || !hasHosts) {
          logger.debug(`🚨 [STREAMING] Stream ${streamData.id} has no participants or hosts, marking for cleanup`);
          streamsToEnd.push(streamData.id);
        } else {
          logger.debug(`✅ [STREAMING] Stream ${streamData.id} is valid, keeping in list`);
          validStreams.push(streamData);
        }
      }

      // End streams that should be cleaned up (async, don't wait)
      if (streamsToEnd.length > 0) {
        logger.debug(`🧹 [STREAMING] Auto-ending ${streamsToEnd.length} empty streams: ${streamsToEnd.join(', ')}`);
        streamsToEnd.forEach(streamId => {
          this.endStream(streamId).catch(error => {
            logger.error(`❌ [STREAMING] Failed to end empty stream ${streamId}:`, error);
          });
        });
      }

      // Update local cache with valid streams only
      const currentStreamIds = new Set(this.activeStreams.keys());
      const newStreamIds = new Set(validStreams.map(s => s.id));

      // Remove streams that are no longer active
      currentStreamIds.forEach(streamId => {
        if (!newStreamIds.has(streamId)) {
          logger.debug(`🗑️ [STREAMING] Removing inactive stream ${streamId} from cache`);
          this.activeStreams.delete(streamId);

          // Clean up listener if exists
          const listener = this.streamListeners.get(streamId);
          if (listener) {
            listener();
            this.streamListeners.delete(streamId);
          }
        }
      });

      // Update/add valid active streams
      validStreams.forEach(streamData => {
        const session: StreamSession = {
          id: streamData.id,
          ...streamData
        };
        this.activeStreams.set(streamData.id, session);
      });

      logger.debug(`✅ [STREAMING] Processed ${validStreams.length} valid streams, ended ${streamsToEnd.length} empty streams`);
      logger.debug(`📤 [STREAMING] Sending ${validStreams.length} streams to UI callback`);

      const liveStreams = validStreams.map(StreamingService.convertToLiveStream);
      callback(liveStreams);
    });

    return unsubscribe;
  }

  // Manually trigger UI update (used when Firebase listener doesn't catch changes)
  private async triggerManualUIUpdate(): Promise<void> {
    try {
      logger.debug(`🔄 [STREAMING] Triggering manual UI update...`);

      if (!this.uiUpdateCallback) {
        logger.debug(`⚠️ [STREAMING] No UI callback available for manual update`);
        return;
      }

      // Fetch fresh data from Firebase and apply validation
      const freshStreams = await this.getActiveStreams();
      logger.debug(`📊 [STREAMING] Manual update: sending ${freshStreams.length} streams to UI`);

      // Call the UI callback with fresh data
      this.uiUpdateCallback(freshStreams);

      logger.debug(`✅ [STREAMING] Manual UI update completed`);
    } catch (error) {
      logger.error(`❌ [STREAMING] Error in manual UI update:`, error);
    }
  }

  // Safe timestamp conversion utility
  private static safeConvertTimestamp(timestamp: any): string {
    try {
      if (!timestamp) {
        return 'unknown';
      }

      // Handle Firestore Timestamp object
      if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toISOString();
      }

      // Handle JavaScript timestamp (number)
      if (typeof timestamp === 'number') {
        return new Date(timestamp).toISOString();
      }

      // Handle Date object
      if (timestamp instanceof Date) {
        return timestamp.toISOString();
      }

      // Handle string timestamp
      if (typeof timestamp === 'string') {
        const parsed = new Date(timestamp);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      }

      return 'invalid-timestamp';
    } catch (error) {
      logger.warn('⚠️ Error converting timestamp:', timestamp, error);
      return 'conversion-error';
    }
  }

  // Convert timestamp to number for LiveStream interface compatibility
  private static convertTimestampToNumber(timestamp: any): number {
    try {
      if (!timestamp) {
        return Date.now(); // Fallback to current time
      }

      // Handle Firestore Timestamp object
      if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        return timestamp.seconds * 1000;
      }

      // Handle JavaScript timestamp (number)
      if (typeof timestamp === 'number') {
        return timestamp;
      }

      // Handle Date object
      if (timestamp instanceof Date) {
        return timestamp.getTime();
      }

      // Handle string timestamp
      if (typeof timestamp === 'string') {
        const parsed = new Date(timestamp);
        if (!isNaN(parsed.getTime())) {
          return parsed.getTime();
        }
      }

      // Fallback to current time
      return Date.now();
    } catch (error) {
      logger.warn('⚠️ Error converting timestamp to number:', timestamp, error);
      return Date.now();
    }
  }

  // Convert StreamSession to LiveStream format for compatibility
  private static convertToLiveStream(session: StreamSession): LiveStream {
    // Ensure participants array exists and is valid
    const participants = session.participants || [];

    // Log conversion for debugging
    logger.debug(`🔄 Converting stream ${session.id}: ${participants.length} participants, isActive: ${session.isActive}`);

    const hosts: StreamHost[] = participants
      .filter(p => p.isHost)
      .map((p, index) => ({
        name: p.name,
        avatar: p.avatar,
        joinOrder: index + 1,
        isSpeaking: p.isSpeaking,
        isMuted: p.isMuted
      }));

    const viewers: StreamViewer[] = participants
      .filter(p => !p.isHost)
      .map(p => ({
        name: p.name,
        avatar: p.avatar,
        isMuted: p.isMuted,
        isBanned: false // TODO: Implement ban functionality
      }));

    // Calculate actual viewer count from participants
    const actualViewerCount = viewers.length;

    // Log if there's a discrepancy
    if (session.viewerCount !== actualViewerCount) {
      logger.warn(`⚠️ Viewer count mismatch for stream ${session.id}: stored=${session.viewerCount}, actual=${actualViewerCount}`);
    }

    return {
      id: session.id,
      title: session.title,
      hosts,
      viewers,
      views: actualViewerCount, // Use actual count from participants
      isActive: session.isActive,
      startedAt: StreamingService.convertTimestampToNumber(session.startedAt)
    };
  }

  // Update participant speaking status (for Agora integration)
  async updateParticipantSpeaking(streamId: string, userId: string, isSpeaking: boolean): Promise<void> {
    try {
      const session = this.activeStreams.get(streamId);
      if (!session) return;

      const participant = session.participants.find(p => p.id === userId);
      if (participant) {
        participant.isSpeaking = isSpeaking;
        await firestoreService.updateStreamParticipants(streamId, session.participants);
      }
    } catch (error) {
      logger.error('Error updating speaking status:', error);
    }
  }

  // Set up Agora event callbacks for real-time updates
  private setupAgoraCallbacks(streamId: string): void {
    const callbacks: AgoraEventCallbacks = {
      onUserJoined: (uid: number, elapsed: number) => {
        logger.debug(`👤 User ${uid} joined Agora channel`);
        // Note: User info will be updated via Firebase listeners
      },

      onUserOffline: (uid: number, reason: number) => {
        logger.debug(`👤 User ${uid} left Agora channel (reason: ${reason})`);
        // Note: User removal will be handled via Firebase listeners
      },

      onAudioVolumeIndication: (speakers) => {
        // Update speaking status for participants
        speakers.forEach(speaker => {
          if (speaker.volume > 10) { // Speaking threshold
            // Find user by UID and update speaking status
            // This would require mapping Agora UIDs to user IDs
            logger.debug(`🎤 User ${speaker.uid} is speaking (volume: ${speaker.volume})`);
          }
        });
      },

      onConnectionStateChanged: (state, reason) => {
        logger.debug(`🔗 Agora connection state: ${state} (reason: ${reason})`);
      },

      onError: (errorCode) => {
        logger.error(`❌ Agora error: ${errorCode}`);
      },

      onWarning: (warningCode) => {
        logger.warn(`⚠️ Agora warning: ${warningCode}`);
      }
    };

    agoraService.setEventCallbacks(callbacks);
  }

  // Mute/unmute local audio in current stream
  async muteLocalAudio(muted: boolean): Promise<void> {
    if (isAgoraConfigured() && this.currentStreamId) {
      await agoraService.muteLocalAudio(muted);

      // Update Firebase state
      const session = this.activeStreams.get(this.currentStreamId);
      if (session) {
        const localParticipant = session.participants.find(p => p.id === 'currentUser'); // You'll need to track current user ID
        if (localParticipant) {
          localParticipant.isMuted = muted;
          await firestoreService.updateStreamParticipants(this.currentStreamId, session.participants);
        }
      }
    }
  }

  // Enable/disable local video in current stream
  async enableLocalVideo(enabled: boolean): Promise<void> {
    if (isAgoraConfigured() && this.currentStreamId) {
      await agoraService.enableLocalVideo(enabled);
    }
  }

  // Get current Agora stream state
  getAgoraStreamState() {
    return agoraService.getStreamState();
  }

  // Mute/unmute participant
  async toggleParticipantMute(streamId: string, userId: string): Promise<void> {
    try {
      const session = this.activeStreams.get(streamId);
      if (!session) return;

      const participant = session.participants.find(p => p.id === userId);
      if (participant) {
        participant.isMuted = !participant.isMuted;
        await firestoreService.updateStreamParticipants(streamId, session.participants);
      }
    } catch (error) {
      logger.error('Error toggling mute:', error);
    }
  }

  // Kick a participant from the stream
  async kickParticipant(streamId: string, userId: string, kickedById: string): Promise<void> {
    try {
      const session = this.activeStreams.get(streamId);
      if (!session) return;

      // Check if the kicker is a host and has permission
      const kicker = session.participants.find(p => p.id === kickedById);
      const participantToKick = session.participants.find(p => p.id === userId);

      if (!kicker?.isHost) {
        throw new Error('Only hosts can kick participants');
      }

      if (!participantToKick) {
        throw new Error('Participant not found');
      }

      // Remove the participant
      session.participants = session.participants.filter(p => p.id !== userId);
      session.viewerCount = session.participants.filter(p => !p.isHost).length;

      // Update Firebase
      await firestoreService.updateStreamParticipants(streamId, session.participants);
      await firestoreService.updateStreamViewerCount(streamId, session.viewerCount);

    } catch (error) {
      logger.error('Error kicking participant:', error);
      throw error;
    }
  }

  // Ban a participant from the stream
  async banParticipant(streamId: string, userId: string, bannedById: string): Promise<void> {
    try {
      const session = this.activeStreams.get(streamId);
      if (!session) return;

      // Check if the banner is a host and has permission
      const banner = session.participants.find(p => p.id === bannedById);
      const participantToBan = session.participants.find(p => p.id === userId);

      if (!banner?.isHost) {
        throw new Error('Only hosts can ban participants');
      }

      if (!participantToBan) {
        throw new Error('Participant not found');
      }

      // For now, just kick them (implement proper ban logic later)
      // TODO: Add ban list to prevent rejoining
      session.participants = session.participants.filter(p => p.id !== userId);
      session.viewerCount = session.participants.filter(p => !p.isHost).length;

      // Update Firebase
      await firestoreService.updateStreamParticipants(streamId, session.participants);
      await firestoreService.updateStreamViewerCount(streamId, session.viewerCount);

    } catch (error) {
      logger.error('Error banning participant:', error);
      throw error;
    }
  }
}

export const streamingService = new StreamingService();

// Make debug functions globally accessible for testing (development only)
if (typeof window !== 'undefined' && __DEV__) {
  try {
    (window as any).debugStreamCleanup = () => streamingService.debugCleanupTest();
    (window as any).forceStreamCleanup = () => streamingService.forceCleanupPhantomStreams();
    logger.debug('🔧 [DEBUG] Global debug functions available:');
    logger.debug('  - debugStreamCleanup() - Run detailed cleanup test');
    logger.debug('  - forceStreamCleanup() - Force cleanup phantom streams');
  } catch (error) {
    logger.warn('⚠️ Failed to attach streaming debug functions:', error);
  }
}
