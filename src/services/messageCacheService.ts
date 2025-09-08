/**
 * Message Cache Service
 * Handles local message caching with AsyncStorage, cache invalidation, and sync logic
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DirectMessage, Conversation } from './types';
import { Timestamp } from 'firebase/firestore';

// Cache interfaces
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  expiresAt?: number;
}

export interface MessageCacheEntry extends CacheEntry<DirectMessage[]> {
  conversationId: string;
  lastMessageId?: string;
  totalCount: number;
}

export interface ConversationCacheEntry extends CacheEntry<Conversation> {
  userId: string;
}

export interface CacheMetadata {
  totalSize: number;
  entryCount: number;
  lastCleanup: number;
  version: string;
}

export interface CacheOptions {
  maxAge: number; // in milliseconds
  maxSize: number; // in bytes
  maxEntries: number;
  compressionEnabled: boolean;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSync: number;
  pendingSync: string[];
  failedSync: string[];
}

class MessageCacheService {
  private static instance: MessageCacheService;
  private readonly CACHE_PREFIX = 'msg_cache_';
  private readonly CONVERSATION_CACHE_PREFIX = 'conv_cache_';
  private readonly METADATA_KEY = 'cache_metadata';
  private readonly SYNC_STATUS_KEY = 'sync_status';
  private readonly CACHE_VERSION = '1.0.0';

  private defaultOptions: CacheOptions = {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxSize: 50 * 1024 * 1024, // 50MB
    maxEntries: 1000,
    compressionEnabled: true,
  };

  private syncStatus: SyncStatus = {
    isOnline: true,
    lastSync: 0,
    pendingSync: [],
    failedSync: [],
  };

  static getInstance(): MessageCacheService {
    if (!MessageCacheService.instance) {
      MessageCacheService.instance = new MessageCacheService();
    }
    return MessageCacheService.instance;
  }

  /**
   * Initialize cache service
   */
  async initialize(): Promise<void> {
    try {
      // Load sync status
      await this.loadSyncStatus();
      
      // Perform cleanup if needed
      await this.performMaintenanceIfNeeded();

      console.log('✅ Message cache service initialized');
    } catch (error) {
      console.error('Error initializing message cache service:', error);
    }
  }

  /**
   * Cache messages for a conversation
   */
  async cacheMessages(
    conversationId: string,
    messages: DirectMessage[],
    options?: Partial<CacheOptions>
  ): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${conversationId}`;
      const mergedOptions = { ...this.defaultOptions, ...options };

      // Serialize messages for caching
      const serializedMessages = messages.map(msg => this.serializeMessage(msg));

      const cacheEntry: MessageCacheEntry = {
        data: serializedMessages,
        timestamp: Date.now(),
        version: this.CACHE_VERSION,
        expiresAt: Date.now() + mergedOptions.maxAge,
        conversationId,
        lastMessageId: messages[0]?.id,
        totalCount: messages.length,
      };

      // Compress if enabled
      let cacheData = JSON.stringify(cacheEntry);
      if (mergedOptions.compressionEnabled) {
        cacheData = this.compressData(cacheData);
      }

      await AsyncStorage.setItem(cacheKey, cacheData);
      
      // Update metadata
      await this.updateCacheMetadata();

      console.log(`📦 Cached ${messages.length} messages for conversation ${conversationId}`);
    } catch (error) {
      console.error('Error caching messages:', error);
    }
  }

  /**
   * Get cached messages for a conversation
   */
  async getCachedMessages(
    conversationId: string,
    options?: Partial<CacheOptions>
  ): Promise<DirectMessage[] | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${conversationId}`;
      const mergedOptions = { ...this.defaultOptions, ...options };

      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (!cachedData) {
        return null;
      }

      // Decompress if needed
      let decompressedData = cachedData;
      if (mergedOptions.compressionEnabled) {
        decompressedData = this.decompressData(cachedData);
      }

      const cacheEntry: MessageCacheEntry = JSON.parse(decompressedData);

      // Check if cache is expired
      if (cacheEntry.expiresAt && Date.now() > cacheEntry.expiresAt) {
        await this.invalidateCache(conversationId);
        return null;
      }

      // Check version compatibility
      if (cacheEntry.version !== this.CACHE_VERSION) {
        await this.invalidateCache(conversationId);
        return null;
      }

      // Deserialize messages
      const messages = cacheEntry.data.map(msg => this.deserializeMessage(msg));

      console.log(`📦 Retrieved ${messages.length} cached messages for conversation ${conversationId}`);
      return messages;
    } catch (error) {
      console.error('Error getting cached messages:', error);
      return null;
    }
  }

  /**
   * Cache a conversation
   */
  async cacheConversation(
    conversation: Conversation,
    userId: string,
    options?: Partial<CacheOptions>
  ): Promise<void> {
    try {
      const cacheKey = `${this.CONVERSATION_CACHE_PREFIX}${conversation.id}`;
      const mergedOptions = { ...this.defaultOptions, ...options };

      const cacheEntry: ConversationCacheEntry = {
        data: this.serializeConversation(conversation),
        timestamp: Date.now(),
        version: this.CACHE_VERSION,
        expiresAt: Date.now() + mergedOptions.maxAge,
        userId,
      };

      let cacheData = JSON.stringify(cacheEntry);
      if (mergedOptions.compressionEnabled) {
        cacheData = this.compressData(cacheData);
      }

      await AsyncStorage.setItem(cacheKey, cacheData);
      await this.updateCacheMetadata();

      console.log(`📦 Cached conversation ${conversation.id}`);
    } catch (error) {
      console.error('Error caching conversation:', error);
    }
  }

  /**
   * Get cached conversation
   */
  async getCachedConversation(
    conversationId: string,
    options?: Partial<CacheOptions>
  ): Promise<Conversation | null> {
    try {
      const cacheKey = `${this.CONVERSATION_CACHE_PREFIX}${conversationId}`;
      const mergedOptions = { ...this.defaultOptions, ...options };

      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (!cachedData) {
        return null;
      }

      let decompressedData = cachedData;
      if (mergedOptions.compressionEnabled) {
        decompressedData = this.decompressData(cachedData);
      }

      const cacheEntry: ConversationCacheEntry = JSON.parse(decompressedData);

      // Check expiration and version
      if (
        (cacheEntry.expiresAt && Date.now() > cacheEntry.expiresAt) ||
        cacheEntry.version !== this.CACHE_VERSION
      ) {
        await this.invalidateConversationCache(conversationId);
        return null;
      }

      const conversation = this.deserializeConversation(cacheEntry.data);
      console.log(`📦 Retrieved cached conversation ${conversationId}`);
      return conversation;
    } catch (error) {
      console.error('Error getting cached conversation:', error);
      return null;
    }
  }

  /**
   * Invalidate cache for a conversation
   */
  async invalidateCache(conversationId: string): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${conversationId}`;
      await AsyncStorage.removeItem(cacheKey);
      await this.updateCacheMetadata();
      console.log(`🗑️ Invalidated cache for conversation ${conversationId}`);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  /**
   * Invalidate conversation cache
   */
  async invalidateConversationCache(conversationId: string): Promise<void> {
    try {
      const cacheKey = `${this.CONVERSATION_CACHE_PREFIX}${conversationId}`;
      await AsyncStorage.removeItem(cacheKey);
      await this.updateCacheMetadata();
      console.log(`🗑️ Invalidated conversation cache for ${conversationId}`);
    } catch (error) {
      console.error('Error invalidating conversation cache:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(
        key => key.startsWith(this.CACHE_PREFIX) || key.startsWith(this.CONVERSATION_CACHE_PREFIX)
      );

      await AsyncStorage.multiRemove(cacheKeys);
      await this.resetCacheMetadata();

      console.log(`🗑️ Cleared all cache (${cacheKeys.length} entries)`);
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheMetadata> {
    try {
      const metadata = await this.getCacheMetadata();
      return metadata;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalSize: 0,
        entryCount: 0,
        lastCleanup: 0,
        version: this.CACHE_VERSION,
      };
    }
  }

  /**
   * Perform cache maintenance
   */
  async performMaintenance(): Promise<void> {
    try {
      console.log('🧹 Starting cache maintenance...');

      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(
        key => key.startsWith(this.CACHE_PREFIX) || key.startsWith(this.CONVERSATION_CACHE_PREFIX)
      );

      let removedCount = 0;
      const now = Date.now();

      // Check each cache entry
      for (const key of cacheKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (!data) continue;

          const entry = JSON.parse(data);
          
          // Remove expired entries
          if (entry.expiresAt && now > entry.expiresAt) {
            await AsyncStorage.removeItem(key);
            removedCount++;
            continue;
          }

          // Remove entries with incompatible versions
          if (entry.version !== this.CACHE_VERSION) {
            await AsyncStorage.removeItem(key);
            removedCount++;
            continue;
          }
        } catch (error) {
          // Remove corrupted entries
          await AsyncStorage.removeItem(key);
          removedCount++;
        }
      }

      // Update metadata
      await this.updateCacheMetadata();
      
      console.log(`🧹 Cache maintenance completed. Removed ${removedCount} entries.`);
    } catch (error) {
      console.error('Error performing cache maintenance:', error);
    }
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(status: Partial<SyncStatus>): Promise<void> {
    try {
      this.syncStatus = { ...this.syncStatus, ...status };
      await AsyncStorage.setItem(this.SYNC_STATUS_KEY, JSON.stringify(this.syncStatus));
    } catch (error) {
      console.error('Error updating sync status:', error);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Mark conversation for sync
   */
  async markForSync(conversationId: string): Promise<void> {
    try {
      if (!this.syncStatus.pendingSync.includes(conversationId)) {
        this.syncStatus.pendingSync.push(conversationId);
        await this.updateSyncStatus({ pendingSync: this.syncStatus.pendingSync });
      }
    } catch (error) {
      console.error('Error marking for sync:', error);
    }
  }

  /**
   * Mark sync as completed
   */
  async markSyncCompleted(conversationId: string): Promise<void> {
    try {
      this.syncStatus.pendingSync = this.syncStatus.pendingSync.filter(id => id !== conversationId);
      this.syncStatus.failedSync = this.syncStatus.failedSync.filter(id => id !== conversationId);
      this.syncStatus.lastSync = Date.now();
      
      await this.updateSyncStatus({
        pendingSync: this.syncStatus.pendingSync,
        failedSync: this.syncStatus.failedSync,
        lastSync: this.syncStatus.lastSync,
      });
    } catch (error) {
      console.error('Error marking sync completed:', error);
    }
  }

  /**
   * Mark sync as failed
   */
  async markSyncFailed(conversationId: string): Promise<void> {
    try {
      this.syncStatus.pendingSync = this.syncStatus.pendingSync.filter(id => id !== conversationId);
      
      if (!this.syncStatus.failedSync.includes(conversationId)) {
        this.syncStatus.failedSync.push(conversationId);
      }
      
      await this.updateSyncStatus({
        pendingSync: this.syncStatus.pendingSync,
        failedSync: this.syncStatus.failedSync,
      });
    } catch (error) {
      console.error('Error marking sync failed:', error);
    }
  }

  /**
   * Serialize message for caching
   */
  private serializeMessage(message: DirectMessage): any {
    return {
      ...message,
      timestamp: message.timestamp.toMillis(),
      editedAt: message.editedAt?.toMillis(),
    };
  }

  /**
   * Deserialize message from cache
   */
  private deserializeMessage(data: any): DirectMessage {
    return {
      ...data,
      timestamp: Timestamp.fromMillis(data.timestamp),
      editedAt: data.editedAt ? Timestamp.fromMillis(data.editedAt) : undefined,
    };
  }

  /**
   * Serialize conversation for caching
   */
  private serializeConversation(conversation: Conversation): any {
    return {
      ...conversation,
      createdAt: conversation.createdAt?.toMillis(),
      lastMessageTime: conversation.lastMessageTime?.toMillis(),
      lastMessage: conversation.lastMessage ? {
        ...conversation.lastMessage,
        timestamp: conversation.lastMessage.timestamp.toMillis(),
      } : undefined,
    };
  }

  /**
   * Deserialize conversation from cache
   */
  private deserializeConversation(data: any): Conversation {
    return {
      ...data,
      createdAt: data.createdAt ? Timestamp.fromMillis(data.createdAt) : undefined,
      lastMessageTime: data.lastMessageTime ? Timestamp.fromMillis(data.lastMessageTime) : undefined,
      lastMessage: data.lastMessage ? {
        ...data.lastMessage,
        timestamp: Timestamp.fromMillis(data.lastMessage.timestamp),
      } : undefined,
    };
  }

  /**
   * Simple compression (base64 encoding for now)
   */
  private compressData(data: string): string {
    // In a real implementation, you might use a compression library
    try {
      return btoa(data);
    } catch {
      // Fallback for React Native
      return data;
    }
  }

  /**
   * Simple decompression
   */
  private decompressData(data: string): string {
    try {
      return atob(data);
    } catch {
      // Fallback for React Native
      return data;
    }
  }

  /**
   * Load sync status from storage
   */
  private async loadSyncStatus(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.SYNC_STATUS_KEY);
      if (stored) {
        this.syncStatus = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  }

  /**
   * Get cache metadata
   */
  private async getCacheMetadata(): Promise<CacheMetadata> {
    try {
      const stored = await AsyncStorage.getItem(this.METADATA_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error getting cache metadata:', error);
    }

    return {
      totalSize: 0,
      entryCount: 0,
      lastCleanup: 0,
      version: this.CACHE_VERSION,
    };
  }

  /**
   * Update cache metadata
   */
  private async updateCacheMetadata(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(
        key => key.startsWith(this.CACHE_PREFIX) || key.startsWith(this.CONVERSATION_CACHE_PREFIX)
      );

      let totalSize = 0;
      for (const key of cacheKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += Buffer.byteLength(data, 'utf8');
        }
      }

      const metadata: CacheMetadata = {
        totalSize,
        entryCount: cacheKeys.length,
        lastCleanup: Date.now(),
        version: this.CACHE_VERSION,
      };

      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error updating cache metadata:', error);
    }
  }

  /**
   * Reset cache metadata
   */
  private async resetCacheMetadata(): Promise<void> {
    const metadata: CacheMetadata = {
      totalSize: 0,
      entryCount: 0,
      lastCleanup: Date.now(),
      version: this.CACHE_VERSION,
    };

    await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
  }

  /**
   * Perform maintenance if needed
   */
  private async performMaintenanceIfNeeded(): Promise<void> {
    try {
      const metadata = await this.getCacheMetadata();
      const now = Date.now();
      const maintenanceInterval = 24 * 60 * 60 * 1000; // 24 hours

      if (now - metadata.lastCleanup > maintenanceInterval) {
        await this.performMaintenance();
      }
    } catch (error) {
      console.error('Error checking maintenance:', error);
    }
  }
}

export const messageCacheService = MessageCacheService.getInstance();
