/**
 * Hook for offline message handling
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineMessageService, OfflineMessage, SyncStats } from '../services/offlineMessageService';

export interface UseOfflineMessagesReturn {
  pendingMessages: OfflineMessage[];
  syncStats: SyncStats;
  isLoading: boolean;
  error: string | null;
  queueMessage: (
    conversationId: string,
    senderId: string,
    senderName: string,
    text: string,
    options?: {
      attachments?: any[];
      replyTo?: OfflineMessage['replyTo'];
      optimisticId?: string;
    }
  ) => Promise<string>;
  removeMessage: (messageId: string) => Promise<void>;
  clearAllMessages: () => Promise<void>;
  forceSync: () => Promise<void>;
  refreshPendingMessages: () => Promise<void>;
}

export const useOfflineMessages = (): UseOfflineMessagesReturn => {
  const [pendingMessages, setPendingMessages] = useState<OfflineMessage[]>([]);
  const [syncStats, setSyncStats] = useState<SyncStats>({
    totalPending: 0,
    totalSent: 0,
    totalFailed: 0,
    lastSyncTime: 0,
    isOnline: true,
    isSyncing: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load pending messages
   */
  const loadPendingMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const messages = await offlineMessageService.getPendingMessages();
      setPendingMessages(messages);
    } catch (err: any) {
      console.error('Error loading pending messages:', err);
      setError(err.message || 'Failed to load pending messages');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load sync statistics
   */
  const loadSyncStats = useCallback(async () => {
    try {
      const stats = await offlineMessageService.getSyncStats();
      setSyncStats(stats);
    } catch (err: any) {
      console.error('Error loading sync stats:', err);
    }
  }, []);

  /**
   * Queue a message for offline sending
   */
  const queueMessage = useCallback(async (
    conversationId: string,
    senderId: string,
    senderName: string,
    text: string,
    options: {
      attachments?: any[];
      replyTo?: OfflineMessage['replyTo'];
      optimisticId?: string;
    } = {}
  ): Promise<string> => {
    try {
      setError(null);

      const messageId = await offlineMessageService.queueMessage(
        conversationId,
        senderId,
        senderName,
        text,
        options
      );

      // Refresh the pending messages list
      await loadPendingMessages();

      return messageId;
    } catch (err: any) {
      console.error('Error queuing message:', err);
      setError(err.message || 'Failed to queue message');
      throw err;
    }
  }, [loadPendingMessages]);

  /**
   * Remove a message from the offline queue
   */
  const removeMessage = useCallback(async (messageId: string): Promise<void> => {
    try {
      setError(null);

      await offlineMessageService.removeOfflineMessage(messageId);

      // Refresh the pending messages list
      await loadPendingMessages();
    } catch (err: any) {
      console.error('Error removing message:', err);
      setError(err.message || 'Failed to remove message');
      throw err;
    }
  }, [loadPendingMessages]);

  /**
   * Clear all offline messages
   */
  const clearAllMessages = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      await offlineMessageService.clearAllOfflineMessages();

      // Refresh the pending messages list
      await loadPendingMessages();
    } catch (err: any) {
      console.error('Error clearing messages:', err);
      setError(err.message || 'Failed to clear messages');
      throw err;
    }
  }, [loadPendingMessages]);

  /**
   * Force sync pending messages
   */
  const forceSync = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      await offlineMessageService.forcSync();

      // Refresh the pending messages list
      await loadPendingMessages();
    } catch (err: any) {
      console.error('Error forcing sync:', err);
      setError(err.message || 'Failed to sync messages');
      throw err;
    }
  }, [loadPendingMessages]);

  /**
   * Refresh pending messages
   */
  const refreshPendingMessages = useCallback(async (): Promise<void> => {
    await loadPendingMessages();
    await loadSyncStats();
  }, [loadPendingMessages, loadSyncStats]);

  // Load data on mount
  useEffect(() => {
    loadPendingMessages();
    loadSyncStats();
  }, [loadPendingMessages, loadSyncStats]);

  // Listen to sync status changes
  useEffect(() => {
    const unsubscribe = offlineMessageService.addSyncListener((stats) => {
      setSyncStats(stats);
      // Also refresh pending messages when sync status changes
      loadPendingMessages();
    });

    return unsubscribe;
  }, [loadPendingMessages]);

  return {
    pendingMessages,
    syncStats,
    isLoading,
    error,
    queueMessage,
    removeMessage,
    clearAllMessages,
    forceSync,
    refreshPendingMessages,
  };
};

/**
 * Hook for conversation-specific offline messages
 */
export const useConversationOfflineMessages = (conversationId: string) => {
  const [offlineMessages, setOfflineMessages] = useState<OfflineMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load offline messages for the conversation
   */
  const loadConversationOfflineMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      setIsLoading(true);
      setError(null);

      const messages = await offlineMessageService.getConversationOfflineMessages(conversationId);
      setOfflineMessages(messages);
    } catch (err: any) {
      console.error('Error loading conversation offline messages:', err);
      setError(err.message || 'Failed to load offline messages');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  /**
   * Refresh conversation offline messages
   */
  const refreshConversationOfflineMessages = useCallback(async (): Promise<void> => {
    await loadConversationOfflineMessages();
  }, [loadConversationOfflineMessages]);

  // Load offline messages on mount and when conversationId changes
  useEffect(() => {
    loadConversationOfflineMessages();
  }, [loadConversationOfflineMessages]);

  // Listen to sync status changes to refresh conversation messages
  useEffect(() => {
    const unsubscribe = offlineMessageService.addSyncListener(() => {
      loadConversationOfflineMessages();
    });

    return unsubscribe;
  }, [loadConversationOfflineMessages]);

  return {
    offlineMessages,
    isLoading,
    error,
    refreshConversationOfflineMessages,
  };
};

/**
 * Hook for optimistic UI updates
 */
export const useOptimisticMessages = () => {
  const [optimisticMessages, setOptimisticMessages] = useState<Map<string, any>>(new Map());

  /**
   * Add optimistic message
   */
  const addOptimisticMessage = useCallback((optimisticId: string, message: any) => {
    setOptimisticMessages(prev => new Map(prev).set(optimisticId, message));
  }, []);

  /**
   * Remove optimistic message
   */
  const removeOptimisticMessage = useCallback((optimisticId: string) => {
    setOptimisticMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(optimisticId);
      return newMap;
    });
  }, []);

  /**
   * Update optimistic message
   */
  const updateOptimisticMessage = useCallback((optimisticId: string, updates: Partial<any>) => {
    setOptimisticMessages(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(optimisticId);
      if (existing) {
        newMap.set(optimisticId, { ...existing, ...updates });
      }
      return newMap;
    });
  }, []);

  /**
   * Clear all optimistic messages
   */
  const clearOptimisticMessages = useCallback(() => {
    setOptimisticMessages(new Map());
  }, []);

  return {
    optimisticMessages,
    addOptimisticMessage,
    removeOptimisticMessage,
    updateOptimisticMessage,
    clearOptimisticMessages,
  };
};
