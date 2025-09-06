/**
 * useMessagePinning Hook
 * Handles message pinning functionality
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { messagingService } from '../services/messagingService';
import { DirectMessage } from '../services/types';
import { useAuth } from '../context/AuthContext';

export interface UseMessagePinningOptions {
  conversationId: string;
  onPinStatusChange?: (messageId: string, isPinned: boolean) => void;
}

export const useMessagePinning = (options: UseMessagePinningOptions) => {
  const { conversationId, onPinStatusChange } = options;
  const { user } = useAuth();
  
  const [isProcessing, setIsProcessing] = useState<{ [messageId: string]: boolean }>({});

  /**
   * Pin a message
   */
  const pinMessage = useCallback(async (message: DirectMessage) => {
    if (!user || !conversationId) return false;

    if (message.isPinned) {
      Alert.alert('Info', 'This message is already pinned');
      return false;
    }

    try {
      setIsProcessing(prev => ({ ...prev, [message.id]: true }));
      
      await messagingService.pinMessage(
        conversationId,
        message.id,
        user.uid,
        user.displayName || user.email || 'Unknown User'
      );

      onPinStatusChange?.(message.id, true);
      return true;
    } catch (error: any) {
      console.error('Error pinning message:', error);
      Alert.alert('Error', error.message || 'Failed to pin message');
      return false;
    } finally {
      setIsProcessing(prev => ({ ...prev, [message.id]: false }));
    }
  }, [user, conversationId, onPinStatusChange]);

  /**
   * Unpin a message
   */
  const unpinMessage = useCallback(async (message: DirectMessage) => {
    if (!user || !conversationId) return false;

    if (!message.isPinned) {
      Alert.alert('Info', 'This message is not pinned');
      return false;
    }

    try {
      setIsProcessing(prev => ({ ...prev, [message.id]: true }));
      
      await messagingService.unpinMessage(conversationId, message.id, user.uid);

      onPinStatusChange?.(message.id, false);
      return true;
    } catch (error: any) {
      console.error('Error unpinning message:', error);
      Alert.alert('Error', error.message || 'Failed to unpin message');
      return false;
    } finally {
      setIsProcessing(prev => ({ ...prev, [message.id]: false }));
    }
  }, [user, conversationId, onPinStatusChange]);

  /**
   * Toggle pin status of a message
   */
  const togglePin = useCallback(async (message: DirectMessage) => {
    if (message.isPinned) {
      return await unpinMessage(message);
    } else {
      return await pinMessage(message);
    }
  }, [pinMessage, unpinMessage]);

  /**
   * Pin message with confirmation
   */
  const pinMessageWithConfirmation = useCallback((message: DirectMessage) => {
    Alert.alert(
      'Pin Message',
      'Pin this message so everyone in the conversation can see it?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pin',
          onPress: () => pinMessage(message),
        },
      ]
    );
  }, [pinMessage]);

  /**
   * Unpin message with confirmation
   */
  const unpinMessageWithConfirmation = useCallback((message: DirectMessage) => {
    Alert.alert(
      'Unpin Message',
      'Are you sure you want to unpin this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpin',
          style: 'destructive',
          onPress: () => unpinMessage(message),
        },
      ]
    );
  }, [unpinMessage]);

  /**
   * Check if user can pin messages
   */
  const canPinMessages = useCallback(async (): Promise<boolean> => {
    if (!user || !conversationId) return false;

    try {
      return await messagingService.canPinMessages(conversationId, user.uid);
    } catch (error) {
      console.error('Error checking pin permissions:', error);
      return false;
    }
  }, [user, conversationId]);

  /**
   * Check if user can unpin a specific message
   */
  const canUnpinMessage = useCallback((message: DirectMessage): boolean => {
    if (!user || !message.isPinned) return false;

    // User can unpin if they pinned it originally
    if (message.pinnedBy === user.uid) return true;

    // TODO: Add group admin check for group conversations
    // For now, only the original pinner can unpin
    return false;
  }, [user]);

  /**
   * Get pinned messages
   */
  const getPinnedMessages = useCallback(async (): Promise<DirectMessage[]> => {
    if (!conversationId) return [];

    try {
      return await messagingService.getPinnedMessages(conversationId);
    } catch (error) {
      console.error('Error getting pinned messages:', error);
      return [];
    }
  }, [conversationId]);

  /**
   * Check if message is being processed
   */
  const isMessageProcessing = useCallback((messageId: string): boolean => {
    return isProcessing[messageId] || false;
  }, [isProcessing]);

  return {
    // Actions
    pinMessage,
    unpinMessage,
    togglePin,
    pinMessageWithConfirmation,
    unpinMessageWithConfirmation,
    
    // Utilities
    canPinMessages,
    canUnpinMessage,
    getPinnedMessages,
    isMessageProcessing,
  };
};
