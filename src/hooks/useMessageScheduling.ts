/**
 * Hook for message scheduling functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { messageSchedulingService, ScheduledMessage } from '../services/messageSchedulingService';

export interface UseMessageSchedulingReturn {
  scheduledMessages: ScheduledMessage[];
  isLoading: boolean;
  error: string | null;
  scheduleMessage: (
    conversationId: string,
    senderId: string,
    senderName: string,
    text: string,
    scheduledFor: Date,
    options?: {
      attachments?: any[];
      replyTo?: ScheduledMessage['replyTo'];
      maxRetries?: number;
    }
  ) => Promise<string>;
  cancelScheduledMessage: (messageId: string, userId: string) => Promise<void>;
  refreshScheduledMessages: () => Promise<void>;
  getSchedulingStats: () => Promise<{
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
  }>;
}

export const useMessageScheduling = (userId: string): UseMessageSchedulingReturn => {
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load scheduled messages for the user
   */
  const loadScheduledMessages = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      setError(null);

      const messages = await messageSchedulingService.getUserScheduledMessages(userId);
      setScheduledMessages(messages);
    } catch (err: any) {
      console.error('Error loading scheduled messages:', err);
      setError(err.message || 'Failed to load scheduled messages');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /**
   * Schedule a new message
   */
  const scheduleMessage = useCallback(async (
    conversationId: string,
    senderId: string,
    senderName: string,
    text: string,
    scheduledFor: Date,
    options: {
      attachments?: any[];
      replyTo?: ScheduledMessage['replyTo'];
      maxRetries?: number;
    } = {}
  ): Promise<string> => {
    try {
      setError(null);

      const messageId = await messageSchedulingService.scheduleMessage(
        conversationId,
        senderId,
        senderName,
        text,
        scheduledFor,
        options
      );

      // Refresh the list
      await loadScheduledMessages();

      return messageId;
    } catch (err: any) {
      console.error('Error scheduling message:', err);
      setError(err.message || 'Failed to schedule message');
      throw err;
    }
  }, [loadScheduledMessages]);

  /**
   * Cancel a scheduled message
   */
  const cancelScheduledMessage = useCallback(async (messageId: string, userId: string): Promise<void> => {
    try {
      setError(null);

      await messageSchedulingService.cancelScheduledMessage(messageId, userId);

      // Refresh the list
      await loadScheduledMessages();
    } catch (err: any) {
      console.error('Error cancelling scheduled message:', err);
      setError(err.message || 'Failed to cancel scheduled message');
      throw err;
    }
  }, [loadScheduledMessages]);

  /**
   * Refresh scheduled messages
   */
  const refreshScheduledMessages = useCallback(async (): Promise<void> => {
    await loadScheduledMessages();
  }, [loadScheduledMessages]);

  /**
   * Get scheduling statistics
   */
  const getSchedulingStats = useCallback(async () => {
    try {
      return await messageSchedulingService.getSchedulingStats(userId);
    } catch (err: any) {
      console.error('Error getting scheduling stats:', err);
      return { pending: 0, sent: 0, failed: 0, cancelled: 0 };
    }
  }, [userId]);

  // Load scheduled messages on mount and when userId changes
  useEffect(() => {
    loadScheduledMessages();
  }, [loadScheduledMessages]);

  return {
    scheduledMessages,
    isLoading,
    error,
    scheduleMessage,
    cancelScheduledMessage,
    refreshScheduledMessages,
    getSchedulingStats,
  };
};

/**
 * Hook for conversation-specific scheduled messages
 */
export const useConversationScheduling = (conversationId: string) => {
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load scheduled messages for the conversation
   */
  const loadConversationScheduledMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      setIsLoading(true);
      setError(null);

      const messages = await messageSchedulingService.getConversationScheduledMessages(conversationId);
      setScheduledMessages(messages);
    } catch (err: any) {
      console.error('Error loading conversation scheduled messages:', err);
      setError(err.message || 'Failed to load scheduled messages');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  /**
   * Refresh conversation scheduled messages
   */
  const refreshConversationScheduledMessages = useCallback(async (): Promise<void> => {
    await loadConversationScheduledMessages();
  }, [loadConversationScheduledMessages]);

  // Load scheduled messages on mount and when conversationId changes
  useEffect(() => {
    loadConversationScheduledMessages();
  }, [loadConversationScheduledMessages]);

  return {
    scheduledMessages,
    isLoading,
    error,
    refreshConversationScheduledMessages,
  };
};

/**
 * Hook for quick scheduling presets
 */
export const useSchedulingPresets = () => {
  const getSchedulingPresets = useCallback(() => {
    const now = new Date();
    
    return [
      {
        label: 'In 5 minutes',
        value: new Date(now.getTime() + 5 * 60 * 1000),
        id: '5min',
      },
      {
        label: 'In 30 minutes',
        value: new Date(now.getTime() + 30 * 60 * 1000),
        id: '30min',
      },
      {
        label: 'In 1 hour',
        value: new Date(now.getTime() + 60 * 60 * 1000),
        id: '1hour',
      },
      {
        label: 'In 2 hours',
        value: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        id: '2hours',
      },
      {
        label: 'Tomorrow 9 AM',
        value: (() => {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);
          return tomorrow;
        })(),
        id: 'tomorrow9am',
      },
      {
        label: 'Next Monday 9 AM',
        value: (() => {
          const nextMonday = new Date(now);
          const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
          nextMonday.setDate(now.getDate() + daysUntilMonday);
          nextMonday.setHours(9, 0, 0, 0);
          return nextMonday;
        })(),
        id: 'nextmonday9am',
      },
    ];
  }, []);

  return {
    getSchedulingPresets,
  };
};
