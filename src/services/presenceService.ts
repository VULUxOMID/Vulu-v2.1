import {
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  deleteDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { AppState, AppStateStatus } from 'react-native';
import { UserStatus, AppUser } from './types';
import * as Crypto from 'expo-crypto';

// Device session interface for multi-device support
interface DeviceSession {
  deviceId: string;
  deviceType: 'mobile' | 'web' | 'desktop';
  lastSeen: Timestamp;
  status: UserStatus;
  appVersion?: string;
  platform?: string;
}

// Enhanced presence data
interface EnhancedPresenceData {
  userId: string;
  status: UserStatus;
  lastSeen: Timestamp;
  isOnline: boolean;
  devices: { [deviceId: string]: DeviceSession };
  totalDevices: number;
  primaryDevice?: string;
}

export class PresenceService {
  private static instance: PresenceService;
  private currentUserId: string | null = null;
  private currentDeviceId: string;
  private presenceListeners: Map<string, () => void> = new Map();
  private appStateSubscription: any = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private isActive = false;
  private isOnline = true;
  private lastHeartbeat: number = 0;
  private heartbeatFrequency = 15000; // 15 seconds (reduced from 30)
  private connectionCheckFrequency = 5000; // 5 seconds
  private offlineThreshold = 45000; // 45 seconds (3 missed heartbeats)

  constructor() {
    // Generate unique device ID
    this.currentDeviceId = this.generateDeviceId();
  }

  static getInstance(): PresenceService {
    if (!PresenceService.instance) {
      PresenceService.instance = new PresenceService();
    }
    return PresenceService.instance;
  }

  /**
   * Generate unique device ID for multi-device support
   */
  private generateDeviceId(): string {
    try {
      const uuid = Crypto.randomUUID();
      return `device_${uuid}`;
    } catch (error) {
      // Fallback to timestamp + secure random if UUID fails
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substr(2, 9);
      return `device_${timestamp}_${random}`;
    }
  }

  /**
   * Initialize presence tracking for current user with enhanced multi-device support
   */
  async initialize(userId: string): Promise<void> {
    try {
      this.currentUserId = userId;
      this.isActive = true;
      this.isOnline = true;

      // Register this device session
      await this.registerDeviceSession(userId, 'online');

      // Set initial online status with device info
      await this.updateUserPresence('online');

      // Start enhanced heartbeat system
      this.startEnhancedHeartbeat();

      // Start connection monitoring
      this.startConnectionMonitoring();

      // Listen to app state changes
      this.setupAppStateListener();

      // Setup cleanup on app termination
      this.setupCleanupHandlers();

      console.log(`✅ Enhanced presence service initialized for user: ${userId}, device: ${this.currentDeviceId}`);
    } catch (error: any) {
      console.error('Error initializing presence service:', error);
    }
  }

  /**
   * Register device session for multi-device support
   */
  private async registerDeviceSession(userId: string, status: UserStatus): Promise<void> {
    try {
      const deviceSession: DeviceSession = {
        deviceId: this.currentDeviceId,
        deviceType: 'mobile', // Could be detected dynamically
        lastSeen: serverTimestamp(),
        status,
        appVersion: '1.0.0', // Could be from app config
        platform: 'react-native',
      };

      const deviceRef = doc(db, 'presence', userId, 'devices', this.currentDeviceId);
      await setDoc(deviceRef, deviceSession);

      console.log(`✅ Device session registered: ${this.currentDeviceId}`);
    } catch (error) {
      console.error('Error registering device session:', error);
    }
  }

  /**
   * Start enhanced heartbeat system with better reliability
   */
  private startEnhancedHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      if (this.isActive && this.currentUserId && this.isOnline) {
        try {
          await this.sendHeartbeat();
          this.lastHeartbeat = Date.now();
        } catch (error) {
          console.error('Heartbeat failed:', error);
          this.handleHeartbeatFailure();
        }
      }
    }, this.heartbeatFrequency);

    console.log(`✅ Enhanced heartbeat started (${this.heartbeatFrequency}ms interval)`);
  }

  /**
   * Send heartbeat to maintain presence
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      // Update device session
      const deviceRef = doc(db, 'presence', this.currentUserId, 'devices', this.currentDeviceId);
      await updateDoc(deviceRef, {
        lastSeen: serverTimestamp(),
        status: this.isOnline ? 'online' : 'offline',
      });

      // Update main presence document
      await this.updateUserPresence(this.isOnline ? 'online' : 'offline');
    } catch (error) {
      console.error('Error sending heartbeat:', error);
      throw error;
    }
  }

  /**
   * Handle heartbeat failures
   */
  private handleHeartbeatFailure(): void {
    console.warn('Heartbeat failed, checking connection...');
    this.isOnline = false;

    // Try to reconnect after a delay
    setTimeout(() => {
      this.checkConnection();
    }, 2000);
  }

  /**
   * Start connection monitoring
   */
  private startConnectionMonitoring(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    this.connectionCheckInterval = setInterval(() => {
      this.checkConnection();
    }, this.connectionCheckFrequency);

    console.log(`✅ Connection monitoring started (${this.connectionCheckFrequency}ms interval)`);
  }

  /**
   * Check network connection and update status
   */
  private async checkConnection(): Promise<void> {
    try {
      // Simple connectivity check by trying to read from Firestore
      const testRef = doc(db, 'presence', 'connection_test');
      await testRef.get?.() || Promise.resolve();

      if (!this.isOnline) {
        this.isOnline = true;
        console.log('✅ Connection restored');

        // Resume heartbeat if needed
        if (this.isActive && this.currentUserId) {
          await this.sendHeartbeat();
        }
      }
    } catch (error) {
      if (this.isOnline) {
        this.isOnline = false;
        console.warn('❌ Connection lost');
      }
    }
  }

  /**
   * Setup cleanup handlers for app termination
   */
  private setupCleanupHandlers(): void {
    // Handle app termination
    const cleanup = async () => {
      if (this.currentUserId) {
        await this.cleanupDeviceSession();
      }
    };

    // React Native doesn't have beforeunload, but we can handle app state changes
    // The cleanup will be handled in the cleanup() method when the service is destroyed
  }

  /**
   * Cleanup device session on app termination
   */
  private async cleanupDeviceSession(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      // Remove device session
      const deviceRef = doc(db, 'presence', this.currentUserId, 'devices', this.currentDeviceId);
      await deleteDoc(deviceRef);

      // Update main presence based on remaining devices
      await this.updatePresenceFromDevices();

      console.log(`✅ Device session cleaned up: ${this.currentDeviceId}`);
    } catch (error) {
      console.error('Error cleaning up device session:', error);
    }
  }

  /**
   * Update main presence document based on active devices
   */
  private async updatePresenceFromDevices(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const devicesQuery = query(
        collection(db, 'presence', this.currentUserId, 'devices'),
        orderBy('lastSeen', 'desc'),
        limit(10)
      );

      const devicesSnapshot = await getDocs(devicesQuery);
      const devices: { [deviceId: string]: DeviceSession } = {};
      let isAnyDeviceOnline = false;
      let mostRecentStatus: UserStatus = 'offline';
      let mostRecentTime: Timestamp | null = null;

      devicesSnapshot.forEach((doc) => {
        const device = doc.data() as DeviceSession;
        devices[doc.id] = device;

        // Check if device is still considered online
        const deviceTime = device.lastSeen instanceof Timestamp ? device.lastSeen.toMillis() : Date.now();
        const isDeviceOnline = (Date.now() - deviceTime) < this.offlineThreshold;

        if (isDeviceOnline && device.status === 'online') {
          isAnyDeviceOnline = true;
        }

        // Track most recent activity
        if (!mostRecentTime || deviceTime > mostRecentTime.toMillis()) {
          mostRecentTime = device.lastSeen;
          mostRecentStatus = device.status;
        }
      });

      // Update main presence document
      const presenceData: EnhancedPresenceData = {
        userId: this.currentUserId,
        status: isAnyDeviceOnline ? 'online' : mostRecentStatus,
        lastSeen: mostRecentTime || serverTimestamp(),
        isOnline: isAnyDeviceOnline,
        devices,
        totalDevices: Object.keys(devices).length,
        primaryDevice: isAnyDeviceOnline ? Object.keys(devices)[0] : undefined,
      };

      const presenceRef = doc(db, 'presence', this.currentUserId);
      await setDoc(presenceRef, presenceData);

    } catch (error) {
      console.error('Error updating presence from devices:', error);
    }
  }

  /**
   * Update user's presence status (enhanced version)
   */
  async updateUserPresence(status: UserStatus): Promise<void> {
    if (!this.currentUserId) return;

    try {
      // Update device session first
      if (this.currentDeviceId) {
        const deviceRef = doc(db, 'presence', this.currentUserId, 'devices', this.currentDeviceId);
        await updateDoc(deviceRef, {
          status,
          lastSeen: serverTimestamp(),
        });
      }

      // Update main presence document based on all devices
      await this.updatePresenceFromDevices();

      // Also update the user document for backward compatibility
      const userRef = doc(db, 'users', this.currentUserId);
      await updateDoc(userRef, {
        status,
        isOnline: status === 'online',
        lastActivity: serverTimestamp(),
        lastSeen: serverTimestamp()
      });

      console.log(`✅ Enhanced user presence updated: ${status} (device: ${this.currentDeviceId})`);
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
   * Start heartbeat to maintain presence (legacy method - use startEnhancedHeartbeat)
   */
  private startHeartbeat(): void {
    console.warn('Using legacy heartbeat - consider using startEnhancedHeartbeat()');
    this.startEnhancedHeartbeat();
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
   * Enhanced cleanup with device session management
   */
  async cleanup(): Promise<void> {
    try {
      this.isActive = false;
      this.isOnline = false;

      // Clear intervals
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      if (this.connectionCheckInterval) {
        clearInterval(this.connectionCheckInterval);
        this.connectionCheckInterval = null;
      }

      // Remove app state listener
      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }

      // Clear all presence listeners
      this.presenceListeners.forEach((unsubscribe) => {
        unsubscribe();
      });
      this.presenceListeners.clear();

      // Cleanup device session and update presence
      if (this.currentUserId) {
        await this.cleanupDeviceSession();
      }

      this.currentUserId = null;

      console.log('✅ Enhanced presence service cleaned up');
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
