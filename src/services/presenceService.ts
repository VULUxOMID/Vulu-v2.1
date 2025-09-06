import {
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { AppState, AppStateStatus } from 'react-native';
import { UserStatus, AppUser } from './types';

export class PresenceService {
  private static instance: PresenceService;
  private currentUserId: string | null = null;
  private presenceListeners: Map<string, () => void> = new Map();
  private appStateSubscription: any = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isActive = false;

  static getInstance(): PresenceService {
    if (!PresenceService.instance) {
      PresenceService.instance = new PresenceService();
    }
    return PresenceService.instance;
  }

  /**
   * Initialize presence tracking for current user
   */
  async initialize(userId: string): Promise<void> {
    try {
      this.currentUserId = userId;
      this.isActive = true;

      // Set initial online status
      await this.updateUserPresence('online');

      // Start heartbeat to maintain presence
      this.startHeartbeat();

      // Listen to app state changes
      this.setupAppStateListener();

      console.log(`✅ Presence service initialized for user: ${userId}`);
    } catch (error: any) {
      console.error('Error initializing presence service:', error);
    }
  }

  /**
   * Update user's presence status
   */
  async updateUserPresence(status: UserStatus): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const userRef = doc(db, 'users', this.currentUserId);
      await updateDoc(userRef, {
        status,
        isOnline: status === 'online',
        lastActivity: serverTimestamp(),
        lastSeen: serverTimestamp()
      });

      console.log(`📡 Updated presence status to: ${status}`);
    } catch (error: any) {
      console.error('Error updating user presence:', error);
    }
  }

  /**
   * Set user as away after inactivity
   */
  async setUserAway(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const userRef = doc(db, 'users', this.currentUserId);
      await updateDoc(userRef, {
        status: 'away',
        isOnline: true, // Still online but away
        lastActivity: serverTimestamp()
      });

      console.log('📡 User set to away status');
    } catch (error: any) {
      console.error('Error setting user away:', error);
    }
  }

  /**
   * Set user as offline
   */
  async setUserOffline(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const userRef = doc(db, 'users', this.currentUserId);
      await updateDoc(userRef, {
        status: 'offline',
        isOnline: false,
        lastSeen: serverTimestamp()
      });

      console.log('📡 User set to offline');
    } catch (error: any) {
      console.error('Error setting user offline:', error);
    }
  }

  /**
   * Listen to a user's presence status
   */
  onUserPresence(userId: string, callback: (user: Partial<AppUser>) => void): () => void {
    const userRef = doc(db, 'users', userId);
    
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        callback({
          uid: userId,
          status: userData.status || 'offline',
          isOnline: userData.isOnline || false,
          lastActivity: userData.lastActivity,
          lastSeen: userData.lastSeen
        });
      } else {
        callback({
          uid: userId,
          status: 'offline',
          isOnline: false
        });
      }
    }, (error) => {
      console.error(`Error listening to user ${userId} presence:`, error);
      callback({
        uid: userId,
        status: 'offline',
        isOnline: false
      });
    });

    this.presenceListeners.set(userId, unsubscribe);
    return unsubscribe;
  }

  /**
   * Listen to multiple users' presence status
   */
  onMultipleUsersPresence(userIds: string[], callback: (users: Map<string, Partial<AppUser>>) => void): () => void {
    const unsubscribes: (() => void)[] = [];
    const userPresenceMap = new Map<string, Partial<AppUser>>();

    const updateCallback = () => {
      callback(new Map(userPresenceMap));
    };

    userIds.forEach(userId => {
      const unsubscribe = this.onUserPresence(userId, (userData) => {
        userPresenceMap.set(userId, userData);
        updateCallback();
      });
      unsubscribes.push(unsubscribe);
    });

    // Return combined unsubscribe function
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }

  /**
   * Get online friends for a user
   */
  async getOnlineFriends(userId: string): Promise<AppUser[]> {
    try {
      // First get user's friends
      const userDoc = await getDocs(query(
        collection(db, 'users'),
        where('uid', '==', userId)
      ));

      if (userDoc.empty) return [];

      const userData = userDoc.docs[0].data() as AppUser;
      const friendIds = userData.friends || [];

      if (friendIds.length === 0) return [];

      // Get online friends
      const onlineFriendsQuery = query(
        collection(db, 'users'),
        where('uid', 'in', friendIds),
        where('isOnline', '==', true)
      );

      const onlineFriendsSnapshot = await getDocs(onlineFriendsQuery);
      return onlineFriendsSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as AppUser[];
    } catch (error: any) {
      console.error('Error getting online friends:', error);
      return [];
    }
  }

  /**
   * Start heartbeat to maintain presence
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      if (this.isActive && this.currentUserId) {
        try {
          const userRef = doc(db, 'users', this.currentUserId);
          await updateDoc(userRef, {
            lastActivity: serverTimestamp()
          });
        } catch (error) {
          console.warn('Heartbeat update failed:', error);
        }
      }
    }, 30000); // Update every 30 seconds
  }

  /**
   * Setup app state listener for presence management
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        this.isActive = true;
        this.updateUserPresence('online');
      } else if (nextAppState === 'background') {
        this.isActive = false;
        this.setUserAway();
      } else if (nextAppState === 'inactive') {
        this.isActive = false;
        this.setUserOffline();
      }
    });
  }

  /**
   * Cleanup presence service
   */
  async cleanup(): Promise<void> {
    try {
      // Set user offline
      if (this.currentUserId) {
        await this.setUserOffline();
      }

      // Clear intervals and listeners
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }

      // Stop all presence listeners
      this.presenceListeners.forEach(unsubscribe => unsubscribe());
      this.presenceListeners.clear();

      this.currentUserId = null;
      this.isActive = false;

      console.log('✅ Presence service cleaned up');
    } catch (error: any) {
      console.error('Error cleaning up presence service:', error);
    }
  }

  /**
   * Get formatted last seen text
   */
  static getLastSeenText(lastSeen: Timestamp | null, isOnline: boolean): string {
    if (isOnline) return 'Online';
    if (!lastSeen) return 'Last seen unknown';

    const now = new Date();
    const lastSeenDate = lastSeen.toDate();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Last seen just now';
    if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;
    if (diffDays < 7) return `Last seen ${diffDays}d ago`;
    
    return `Last seen ${lastSeenDate.toLocaleDateString()}`;
  }
}

export const presenceService = PresenceService.getInstance();
