/**
 * Offline Message Service
 * Handles message queuing for offline scenarios and sync when online
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { DirectMessage } from './types';
import { messagingService } from './messagingService';
import { Timestamp } from 'firebase/firestore';

// Offline message interface
export interface OfflineMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  retryCount: number;
  maxRetries: number;
  attachments?: any[];
  replyTo?: {
    messageId: string;
    senderId: string;
    senderName: string;
    text: string;
  };
  optimisticId: string; // Temporary ID for optimistic updates
  failureReason?: string;
  createdAt: number;
}

// Sync statistics
export interface SyncStats {
  totalPending: number;
  totalSent: number;
  totalFailed: number;
  lastSyncTime: number;
  isOnline: boolean;
  isSyncing: boolean;
}

class OfflineMessageService {
  private static instance: OfflineMessageService;
  private isOnline = true;
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(stats: SyncStats) => void> = new Set();
  private readonly STORAGE_KEY = 'offline_messages';
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private readonly MAX_RETRIES = 5;

  static getInstance(): OfflineMessageService {
    if (!OfflineMessageService.instance) {
      OfflineMessageService.instance = new OfflineMessageService();
    }
    return OfflineMessageService.instance;
  }

  /**
   * Initialize the offline message service
   */
  async initialize(): Promise<void> {
    try {
      // Listen to network state changes
      NetInfo.addEventListener(state => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected ?? false;

        if (!wasOnline && this.isOnline) {
          console.log('📶 Network restored - starting sync');
          this.startSync();
        } else if (wasOnline && !this.isOnline) {
          console.log('📵 Network lost - entering offline mode');
        }

        this.notifyListeners();
      });

      // Start periodic sync if online
      if (this.isOnline) {
        this.startPeriodicSync();
      }

      // Sync any pending messages from previous sessions
      await this.syncPendingMessages();

      console.log('✅ Offline message service initialized');
    } catch (error) {
      console.error('Error initializing offline message service:', error);
    }
  }

  /**
   * Queue a message for offline sending
   */
  async queueMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    text: string,
    options: {
      attachments?: any[];
      replyTo?: OfflineMessage['replyTo'];
      optimisticId?: string;
    } = {}
  ): Promise<string> {
    try {
      const messageId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const optimisticId = options.optimisticId || `optimistic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const offlineMessage: OfflineMessage = {
        id: messageId,
        conversationId,
        senderId,
        senderName,
        text,
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
        maxRetries: this.MAX_RETRIES,
        attachments: options.attachments,
        replyTo: options.replyTo,
        optimisticId,
        createdAt: Date.now(),
      };

      // Store in local storage
      await this.storeOfflineMessage(offlineMessage);

      // If online, try to send immediately
      if (this.isOnline) {
        this.sendOfflineMessage(offlineMessage);
      }

      this.notifyListeners();
      return messageId;
    } catch (error: any) {
      console.error('Error queuing offline message:', error);
      throw new Error(`Failed to queue message: ${error.message}`);
    }
  }

  /**
   * Get all pending offline messages
   */
  async getPendingMessages(): Promise<OfflineMessage[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const messages: OfflineMessage[] = JSON.parse(stored);
      return messages.filter(msg => msg.status === 'pending' || msg.status === 'failed');
    } catch (error) {
      console.error('Error getting pending messages:', error);
      return [];
    }
  }

  /**
   * Get offline messages for a specific conversation
   */
  async getConversationOfflineMessages(conversationId: string): Promise<OfflineMessage[]> {
    try {
      const allMessages = await this.getAllOfflineMessages();
      return allMessages.filter(msg => msg.conversationId === conversationId);
    } catch (error) {
      console.error('Error getting conversation offline messages:', error);
      return [];
    }
  }

  /**
   * Remove a message from offline queue
   */
  async removeOfflineMessage(messageId: string): Promise<void> {
    try {
      const messages = await this.getAllOfflineMessages();
      const filteredMessages = messages.filter(msg => msg.id !== messageId);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredMessages));
      this.notifyListeners();
    } catch (error) {
      console.error('Error removing offline message:', error);
    }
  }

  /**
   * Clear all offline messages
   */
  async clearAllOfflineMessages(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      this.notifyListeners();
      console.log('✅ All offline messages cleared');
    } catch (error) {
      console.error('Error clearing offline messages:', error);
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    try {
      const messages = await this.getAllOfflineMessages();
      const pending = messages.filter(msg => msg.status === 'pending' || msg.status === 'sending').length;
      const sent = messages.filter(msg => msg.status === 'sent').length;
      const failed = messages.filter(msg => msg.status === 'failed').length;

      return {
        totalPending: pending,
        totalSent: sent,
        totalFailed: failed,
        lastSyncTime: Date.now(),
        isOnline: this.isOnline,
        isSyncing: this.isSyncing,
      };
    } catch (error) {
      console.error('Error getting sync stats:', error);
      return {
        totalPending: 0,
        totalSent: 0,
        totalFailed: 0,
        lastSyncTime: 0,
        isOnline: this.isOnline,
        isSyncing: this.isSyncing,
      };
    }
  }

  /**
   * Add listener for sync status changes
   */
  addSyncListener(listener: (stats: SyncStats) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Force sync pending messages
   */
  async forcSync(): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    await this.syncPendingMessages();
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        await this.syncPendingMessages();
      }
    }, this.SYNC_INTERVAL);

    console.log(`✅ Periodic sync started (${this.SYNC_INTERVAL}ms interval)`);
  }

  /**
   * Start immediate sync
   */
  private async startSync(): Promise<void> {
    if (!this.isOnline || this.isSyncing) return;
    await this.syncPendingMessages();
  }

  /**
   * Sync all pending messages
   */
  private async syncPendingMessages(): Promise<void> {
    if (this.isSyncing || !this.isOnline) return;

    try {
      this.isSyncing = true;
      this.notifyListeners();

      const pendingMessages = await this.getPendingMessages();
      
      if (pendingMessages.length === 0) {
        return;
      }

      console.log(`🔄 Syncing ${pendingMessages.length} pending messages`);

      // Process messages in batches to avoid overwhelming the server
      const batchSize = 5;
      for (let i = 0; i < pendingMessages.length; i += batchSize) {
        const batch = pendingMessages.slice(i, i + batchSize);
        const promises = batch.map(message => this.sendOfflineMessage(message));
        await Promise.allSettled(promises);
      }

      console.log('✅ Message sync completed');
    } catch (error) {
      console.error('Error syncing pending messages:', error);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Send an offline message
   */
  private async sendOfflineMessage(message: OfflineMessage): Promise<void> {
    try {
      // Update status to sending
      await this.updateMessageStatus(message.id, 'sending');

      // Send the message using the messaging service
      const sentMessageId = await messagingService.sendMessage(
        message.conversationId,
        message.senderId,
        message.senderName,
        message.text,
        message.replyTo
      );

      // Update status to sent
      await this.updateMessageStatus(message.id, 'sent');

      // Remove from offline queue after successful send
      setTimeout(() => {
        this.removeOfflineMessage(message.id);
      }, 5000); // Keep for 5 seconds for UI feedback

      console.log(`✅ Offline message sent: ${message.id} -> ${sentMessageId}`);
    } catch (error: any) {
      console.error(`Error sending offline message ${message.id}:`, error);
      await this.handleSendFailure(message, error.message);
    }
  }

  /**
   * Handle send failure
   */
  private async handleSendFailure(message: OfflineMessage, errorMessage: string): Promise<void> {
    try {
      const retryCount = message.retryCount + 1;

      if (retryCount >= message.maxRetries) {
        // Mark as permanently failed
        await this.updateMessageStatus(message.id, 'failed', errorMessage);
        console.error(`❌ Message ${message.id} failed permanently after ${retryCount} attempts`);
      } else {
        // Update retry count and set back to pending
        const messages = await this.getAllOfflineMessages();
        const updatedMessages = messages.map(msg => 
          msg.id === message.id 
            ? { ...msg, retryCount, status: 'pending' as const, failureReason: errorMessage }
            : msg
        );
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedMessages));
        
        console.warn(`⚠️ Message ${message.id} failed, will retry (attempt ${retryCount}/${message.maxRetries})`);
      }

      this.notifyListeners();
    } catch (error) {
      console.error('Error handling send failure:', error);
    }
  }

  /**
   * Store offline message
   */
  private async storeOfflineMessage(message: OfflineMessage): Promise<void> {
    try {
      const messages = await this.getAllOfflineMessages();
      messages.push(message);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Error storing offline message:', error);
      throw error;
    }
  }

  /**
   * Get all offline messages
   */
  private async getAllOfflineMessages(): Promise<OfflineMessage[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting all offline messages:', error);
      return [];
    }
  }

  /**
   * Update message status
   */
  private async updateMessageStatus(
    messageId: string, 
    status: OfflineMessage['status'], 
    failureReason?: string
  ): Promise<void> {
    try {
      const messages = await this.getAllOfflineMessages();
      const updatedMessages = messages.map(msg => 
        msg.id === messageId 
          ? { ...msg, status, failureReason }
          : msg
      );
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedMessages));
      this.notifyListeners();
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }

  /**
   * Notify all listeners of sync status changes
   */
  private async notifyListeners(): Promise<void> {
    try {
      const stats = await this.getSyncStats();
      this.listeners.forEach(listener => {
        try {
          listener(stats);
        } catch (error) {
          console.error('Error in sync listener:', error);
        }
      });
    } catch (error) {
      console.error('Error notifying listeners:', error);
    }
  }

  /**
   * Cleanup the service
   */
  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.listeners.clear();
    this.isSyncing = false;
    console.log('✅ Offline message service cleaned up');
  }
}

export const offlineMessageService = OfflineMessageService.getInstance();
