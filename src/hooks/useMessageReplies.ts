/**
 * useMessageReplies Hook
 * Handles message reply functionality
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { messagingService } from '../services/messagingService';
import { useAuth } from '../context/AuthContext';
import { DirectMessage } from '../services/types';

export interface ReplyData {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
}

export interface UseMessageRepliesOptions {
  conversationId: string;
  onReplyUpdate?: () => void;
}

export const useMessageReplies = (options: UseMessageRepliesOptions) => {
  const { conversationId, onReplyUpdate } = options;
  const { user } = useAuth();
  
  const [replyingTo, setReplyingTo] = useState<ReplyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Start replying to a message
   */
  const startReply = useCallback((message: DirectMessage) => {
    if (!message.id) return;
    
    setReplyingTo({
      messageId: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      text: message.text,
    });
  }, []);

  /**
   * Cancel current reply
   */
  const cancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  /**
   * Send a reply message
   */
  const sendReply = useCallback(async (messageText: string) => {
    if (!user || !replyingTo || isLoading || !messageText.trim()) {
      return false;
    }

    try {
      setIsLoading(true);
      
      await messagingService.sendReplyMessage(
        conversationId,
        replyingTo.messageId,
        messageText.trim(),
        user.uid,
        user.displayName || user.email || 'Unknown User'
      );
      
      // Clear reply state after successful send
      setReplyingTo(null);
      onReplyUpdate?.();
      
      console.log(`✅ Reply sent to message ${replyingTo.messageId}`);
      return true;
    } catch (error: any) {
      console.error('Error sending reply:', error);
      Alert.alert(
        'Error',
        'Failed to send reply. Please try again.',
        [{ text: 'OK' }]
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, user, replyingTo, isLoading, onReplyUpdate]);

  /**
   * Get the original message being replied to
   */
  const getOriginalMessage = useCallback(async (messageId: string): Promise<DirectMessage | null> => {
    try {
      return await messagingService.getOriginalMessage(conversationId, messageId);
    } catch (error) {
      console.error('Error getting original message:', error);
      return null;
    }
  }, [conversationId]);

  /**
   * Get all replies to a message
   */
  const getMessageReplies = useCallback(async (messageId: string): Promise<DirectMessage[]> => {
    try {
      return await messagingService.getMessageReplies(conversationId, messageId);
    } catch (error) {
      console.error('Error getting message replies:', error);
      return [];
    }
  }, [conversationId]);

  /**
   * Navigate to original message (scroll to it)
   */
  const navigateToOriginalMessage = useCallback((messageId: string) => {
    // This would be implemented by the parent component
    // to scroll to the original message in the chat
    console.log('Navigate to original message:', messageId);
  }, []);

  /**
   * Check if a message is a reply
   */
  const isReplyMessage = useCallback((message: DirectMessage): boolean => {
    return !!message.replyTo;
  }, []);

  /**
   * Get reply preview text
   */
  const getReplyPreview = useCallback((text: string, maxLength: number = 100): string => {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }, []);

  return {
    // State
    replyingTo,
    isLoading,
    
    // Actions
    startReply,
    cancelReply,
    sendReply,
    getOriginalMessage,
    getMessageReplies,
    navigateToOriginalMessage,
    
    // Utilities
    isReplyMessage,
    getReplyPreview,
  };
};
