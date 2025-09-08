/**
 * Hook for message caching functionality
 */

import { useState, useCallback, useEffect } from 'react';
import { messageCacheService, CacheOptions, CacheMetadata, SyncStatus } from '../services/messageCacheService';
import { DirectMessage, Conversation } from '../services/types';

export interface UseMessageCacheReturn {
  // Cache operations
  cacheMessages: (conversationId: string, messages: DirectMessage[], options?: Partial<CacheOptions>) => Promise<void>;
  getCachedMessages: (conversationId: string, options?: Partial<CacheOptions>) => Promise<DirectMessage[] | null>;
  cacheConversation: (conversation: Conversation, userId: string, options?: Partial<CacheOptions>) => Promise<void>;
  getCachedConversation: (conversationId: string, options?: Partial<CacheOptions>) => Promise<Conversation | null>;
  
  // Cache management
  invalidateCache: (conversationId: string) => Promise<void>;
  invalidateConversationCache: (conversationId: string) => Promise<void>;
  clearAllCache: () => Promise<void>;
  performMaintenance: () => Promise<void>;
  
  // Sync management
  markForSync: (conversationId: string) => Promise<void>;
  markSyncCompleted: (conversationId: string) => Promise<void>;
  markSyncFailed: (conversationId: string) => Promise<void>;
  updateSyncStatus: (status: Partial<SyncStatus>) => Promise<void>;
  
  // State
  cacheStats: CacheMetadata;
  syncStatus: SyncStatus;
  isLoading: boolean;
  error: string | null;
}

export const useMessageCache = (): UseMessageCacheReturn => {
  const [cacheStats, setCacheStats] = useState<CacheMetadata>({
    totalSize: 0,
    entryCount: 0,
    lastCleanup: 0,
    version: '1.0.0',
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    lastSync: 0,
    pendingSync: [],
    failedSync: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load initial data
   */
  useEffect(() => {
    loadCacheStats();
    loadSyncStatus();
  }, []);

  /**
   * Load cache statistics
   */
  const loadCacheStats = useCallback(async () => {
    try {
      const stats = await messageCacheService.getCacheStats();
      setCacheStats(stats);
    } catch (err: any) {
      console.error('Error loading cache stats:', err);
      setError(err.message || 'Failed to load cache stats');
    }
  }, []);

  /**
   * Load sync status
   */
  const loadSyncStatus = useCallback(() => {
    try {
      const status = messageCacheService.getSyncStatus();
      setSyncStatus(status);
    } catch (err: any) {
      console.error('Error loading sync status:', err);
      setError(err.message || 'Failed to load sync status');
    }
  }, []);

  /**
   * Cache messages
   */
  const cacheMessages = useCallback(async (
    conversationId: string,
    messages: DirectMessage[],
    options?: Partial<CacheOptions>
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      await messageCacheService.cacheMessages(conversationId, messages, options);
      await loadCacheStats();
    } catch (err: any) {
      console.error('Error caching messages:', err);
      setError(err.message || 'Failed to cache messages');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadCacheStats]);

  /**
   * Get cached messages
   */
  const getCachedMessages = useCallback(async (
    conversationId: string,
    options?: Partial<CacheOptions>
  ): Promise<DirectMessage[] | null> => {
    try {
      setError(null);
      return await messageCacheService.getCachedMessages(conversationId, options);
    } catch (err: any) {
      console.error('Error getting cached messages:', err);
      setError(err.message || 'Failed to get cached messages');
      return null;
    }
  }, []);

  /**
   * Cache conversation
   */
  const cacheConversation = useCallback(async (
    conversation: Conversation,
    userId: string,
    options?: Partial<CacheOptions>
  ): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      await messageCacheService.cacheConversation(conversation, userId, options);
      await loadCacheStats();
    } catch (err: any) {
      console.error('Error caching conversation:', err);
      setError(err.message || 'Failed to cache conversation');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadCacheStats]);

  /**
   * Get cached conversation
   */
  const getCachedConversation = useCallback(async (
    conversationId: string,
    options?: Partial<CacheOptions>
  ): Promise<Conversation | null> => {
    try {
      setError(null);
      return await messageCacheService.getCachedConversation(conversationId, options);
    } catch (err: any) {
      console.error('Error getting cached conversation:', err);
      setError(err.message || 'Failed to get cached conversation');
      return null;
    }
  }, []);

  /**
   * Invalidate cache
   */
  const invalidateCache = useCallback(async (conversationId: string): Promise<void> => {
    try {
      setError(null);
      await messageCacheService.invalidateCache(conversationId);
      await loadCacheStats();
    } catch (err: any) {
      console.error('Error invalidating cache:', err);
      setError(err.message || 'Failed to invalidate cache');
      throw err;
    }
  }, [loadCacheStats]);

  /**
   * Invalidate conversation cache
   */
  const invalidateConversationCache = useCallback(async (conversationId: string): Promise<void> => {
    try {
      setError(null);
      await messageCacheService.invalidateConversationCache(conversationId);
      await loadCacheStats();
    } catch (err: any) {
      console.error('Error invalidating conversation cache:', err);
      setError(err.message || 'Failed to invalidate conversation cache');
      throw err;
    }
  }, [loadCacheStats]);

  /**
   * Clear all cache
   */
  const clearAllCache = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      await messageCacheService.clearAllCache();
      await loadCacheStats();
    } catch (err: any) {
      console.error('Error clearing cache:', err);
      setError(err.message || 'Failed to clear cache');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadCacheStats]);

  /**
   * Perform maintenance
   */
  const performMaintenance = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      await messageCacheService.performMaintenance();
      await loadCacheStats();
    } catch (err: any) {
      console.error('Error performing maintenance:', err);
      setError(err.message || 'Failed to perform maintenance');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadCacheStats]);

  /**
   * Mark for sync
   */
  const markForSync = useCallback(async (conversationId: string): Promise<void> => {
    try {
      setError(null);
      await messageCacheService.markForSync(conversationId);
      loadSyncStatus();
    } catch (err: any) {
      console.error('Error marking for sync:', err);
      setError(err.message || 'Failed to mark for sync');
      throw err;
    }
  }, [loadSyncStatus]);

  /**
   * Mark sync completed
   */
  const markSyncCompleted = useCallback(async (conversationId: string): Promise<void> => {
    try {
      setError(null);
      await messageCacheService.markSyncCompleted(conversationId);
      loadSyncStatus();
    } catch (err: any) {
      console.error('Error marking sync completed:', err);
      setError(err.message || 'Failed to mark sync completed');
      throw err;
    }
  }, [loadSyncStatus]);

  /**
   * Mark sync failed
   */
  const markSyncFailed = useCallback(async (conversationId: string): Promise<void> => {
    try {
      setError(null);
      await messageCacheService.markSyncFailed(conversationId);
      loadSyncStatus();
    } catch (err: any) {
      console.error('Error marking sync failed:', err);
      setError(err.message || 'Failed to mark sync failed');
      throw err;
    }
  }, [loadSyncStatus]);

  /**
   * Update sync status
   */
  const updateSyncStatus = useCallback(async (status: Partial<SyncStatus>): Promise<void> => {
    try {
      setError(null);
      await messageCacheService.updateSyncStatus(status);
      loadSyncStatus();
    } catch (err: any) {
      console.error('Error updating sync status:', err);
      setError(err.message || 'Failed to update sync status');
      throw err;
    }
  }, [loadSyncStatus]);

  return {
    cacheMessages,
    getCachedMessages,
    cacheConversation,
    getCachedConversation,
    invalidateCache,
    invalidateConversationCache,
    clearAllCache,
    performMaintenance,
    markForSync,
    markSyncCompleted,
    markSyncFailed,
    updateSyncStatus,
    cacheStats,
    syncStatus,
    isLoading,
    error,
  };
};

/**
 * Hook for cache-aware message loading
 */
export const useCachedMessages = (conversationId: string) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);
  const [cacheHit, setCacheHit] = useState(false);
  
  const { getCachedMessages, cacheMessages } = useMessageCache();

  /**
   * Load messages with cache fallback
   */
  const loadMessages = useCallback(async (
    fetchFromServer: () => Promise<DirectMessage[]>,
    options?: Partial<CacheOptions>
  ): Promise<DirectMessage[]> => {
    try {
      setIsLoadingFromCache(true);
      
      // Try to get from cache first
      const cachedMessages = await getCachedMessages(conversationId, options);
      
      if (cachedMessages && cachedMessages.length > 0) {
        setMessages(cachedMessages);
        setCacheHit(true);
        console.log(`📦 Loaded ${cachedMessages.length} messages from cache`);
        return cachedMessages;
      }

      // Fallback to server
      setCacheHit(false);
      const serverMessages = await fetchFromServer();
      setMessages(serverMessages);
      
      // Cache the server messages
      if (serverMessages.length > 0) {
        await cacheMessages(conversationId, serverMessages, options);
      }
      
      return serverMessages;
    } catch (error) {
      console.error('Error loading messages with cache:', error);
      throw error;
    } finally {
      setIsLoadingFromCache(false);
    }
  }, [conversationId, getCachedMessages, cacheMessages]);

  return {
    messages,
    loadMessages,
    isLoadingFromCache,
    cacheHit,
  };
};
