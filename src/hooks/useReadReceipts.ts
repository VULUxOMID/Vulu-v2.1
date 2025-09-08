/**
 * useReadReceipts Hook
 * Handles read receipt functionality
 */

import { useCallback, useEffect, useRef } from 'react';
import { messagingService } from '../services/messagingService';
import { useAuth } from '../context/AuthContext';
import { DirectMessage } from '../services/types';

export interface UseReadReceiptsOptions {
  conversationId: string;
  messages: DirectMessage[];
  onStatusUpdate?: () => void;
}

export const useReadReceipts = (options: UseReadReceiptsOptions) => {
  const { conversationId, messages, onStatusUpdate } = options;
  const { user } = useAuth();
  const processedMessagesRef = useRef<Set<string>>(new Set());

  /**
   * Mark messages as delivered when they come into view
   */
  const markAsDelivered = useCallback(async (messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;

    try {
      // Mark each message as delivered
      const promises = messageIds.map(messageId =>
        messagingService.markMessageAsDelivered(conversationId, messageId, user.uid)
      );

      await Promise.all(promises);
      onStatusUpdate?.();
    } catch (error) {
      console.error('Error marking messages as delivered:', error);
    }
  }, [conversationId, user, onStatusUpdate]);

  /**
   * Mark messages as read when user views them
   */
  const markAsRead = useCallback(async (messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;

    try {
      // Use existing markMessagesAsRead method
      await messagingService.markMessagesAsRead(conversationId, messageIds, user.uid);
      onStatusUpdate?.();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [conversationId, user, onStatusUpdate]);

  /**
   * Get undelivered messages that need to be marked as delivered
   */
  const getUndeliveredMessages = useCallback((): string[] => {
    if (!user) return [];

    return messages
      .filter(message => {
        // Only mark messages from other users as delivered
        if (message.senderId === user.uid) return false;
        
        // Check if already delivered to this user
        const deliveredTo = message.deliveredTo || [];
        return !deliveredTo.includes(user.uid);
      })
      .map(message => message.id)
      .filter(Boolean);
  }, [messages, user]);

  /**
   * Get unread messages that need to be marked as read
   */
  const getUnreadMessages = useCallback((): string[] => {
    if (!user) return [];

    return messages
      .filter(message => {
        // Only mark messages from other users as read
        if (message.senderId === user.uid) return false;
        
        // Check if already read by this user
        const readBy = message.readBy || [];
        return !readBy.includes(user.uid);
      })
      .map(message => message.id)
      .filter(Boolean);
  }, [messages, user]);

  /**
   * Auto-mark messages as delivered when they load
   */
  useEffect(() => {
    if (!user || messages.length === 0) return;
    
    const undeliveredMessages = messages
      .filter(message => {
        // Only mark messages from other users as delivered
        if (message.senderId === user.uid) return false;
        
        // Check if already delivered to this user
        const deliveredTo = message.deliveredTo || [];
        const isAlreadyDelivered = deliveredTo.includes(user.uid);
        
        // Check if we've already processed this message
        const isAlreadyProcessed = processedMessagesRef.current.has(message.id);
        
        return !isAlreadyDelivered && !isAlreadyProcessed;
      })
      .map(message => message.id)
      .filter(Boolean);
    
    if (undeliveredMessages.length > 0) {
      // Mark these messages as processed to prevent duplicate processing
      undeliveredMessages.forEach(messageId => {
        processedMessagesRef.current.add(messageId);
      });
      
      // Use a timeout to prevent rapid successive calls
      const timeoutId = setTimeout(() => {
        markAsDelivered(undeliveredMessages);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [messages, user?.uid, markAsDelivered]);

  /**
   * Clear processed messages when conversation changes
   */
  useEffect(() => {
    processedMessagesRef.current.clear();
  }, [conversationId]);

  /**
   * Get message status info for display
   */
  const getMessageStatus = useCallback((message: DirectMessage) => {
    if (!user) return { status: 'sent', icon: '', color: '' };
    
    return messagingService.getMessageStatusForDisplay(message, user.uid);
  }, [user]);

  /**
   * Check if message is read by recipient
   */
  const isMessageRead = useCallback((message: DirectMessage): boolean => {
    if (!user || message.senderId !== user.uid) return false;
    
    const readBy = message.readBy || [];
    // For direct messages, check if anyone other than sender has read it
    return readBy.some(userId => userId !== user.uid);
  }, [user]);

  /**
   * Check if message is delivered to recipient
   */
  const isMessageDelivered = useCallback((message: DirectMessage): boolean => {
    if (!user || message.senderId !== user.uid) return false;
    
    const deliveredTo = message.deliveredTo || [];
    // For direct messages, check if anyone other than sender has received it
    return deliveredTo.some(userId => userId !== user.uid);
  }, [user]);

  /**
   * Get read receipt info for a message
   */
  const getReadReceiptInfo = useCallback((message: DirectMessage) => {
    const readBy = message.readBy || [];
    const deliveredTo = message.deliveredTo || [];
    const readAt = message.readAt || {};
    const deliveredAt = message.deliveredAt || {};

    return {
      isRead: readBy.length > 0,
      isDelivered: deliveredTo.length > 0,
      readBy,
      deliveredTo,
      readAt,
      deliveredAt,
    };
  }, []);

  return {
    // Actions
    markAsDelivered,
    markAsRead,
    getUndeliveredMessages,
    getUnreadMessages,
    
    // Status utilities
    getMessageStatus,
    isMessageRead,
    isMessageDelivered,
    getReadReceiptInfo,
  };
};
