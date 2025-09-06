/**
 * useMessageForwarding Hook
 * Handles message forwarding functionality
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { messagingService } from '../services/messagingService';
import { DirectMessage, Conversation } from '../services/types';
import { useAuth } from '../context/AuthContext';

export interface UseMessageForwardingOptions {
  currentConversationId?: string;
  onForwardComplete?: (targetConversations: Conversation[]) => void;
}

export const useMessageForwarding = (options: UseMessageForwardingOptions = {}) => {
  const { currentConversationId, onForwardComplete } = options;
  const { user } = useAuth();
  
  const [isForwarding, setIsForwarding] = useState(false);
  const [availableConversations, setAvailableConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  /**
   * Load available conversations for forwarding
   */
  const loadForwardingTargets = useCallback(async () => {
    if (!user) return [];

    try {
      setIsLoadingConversations(true);
      const conversations = await messagingService.getForwardingTargets(
        user.uid,
        currentConversationId
      );
      setAvailableConversations(conversations);
      return conversations;
    } catch (error) {
      console.error('Error loading forwarding targets:', error);
      Alert.alert('Error', 'Failed to load conversations');
      return [];
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user, currentConversationId]);

  /**
   * Forward a single message to multiple conversations
   */
  const forwardMessage = useCallback(async (
    message: DirectMessage,
    targetConversationIds: string[],
    additionalText?: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      setIsForwarding(true);
      const targetConversations: Conversation[] = [];

      for (const conversationId of targetConversationIds) {
        const conversation = availableConversations.find(c => c.id === conversationId);
        if (!conversation) continue;

        // Check permissions
        const canForward = await messagingService.canForwardToConversation(user.uid, conversationId);
        if (!canForward) {
          Alert.alert('Error', `You don't have permission to send messages to ${conversation.name || 'this conversation'}`);
          continue;
        }

        // Forward the message
        await messagingService.forwardMessage(
          message,
          conversationId,
          user.uid,
          user.displayName || user.email || 'Unknown User',
          additionalText
        );

        targetConversations.push(conversation);
      }

      if (targetConversations.length > 0) {
        Alert.alert(
          'Success',
          `Message forwarded to ${targetConversations.length} conversation${targetConversations.length > 1 ? 's' : ''}`
        );
        onForwardComplete?.(targetConversations);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Error forwarding message:', error);
      Alert.alert('Error', error.message || 'Failed to forward message');
      return false;
    } finally {
      setIsForwarding(false);
    }
  }, [user, availableConversations, onForwardComplete]);

  /**
   * Forward multiple messages to multiple conversations
   */
  const forwardMessages = useCallback(async (
    messages: DirectMessage[],
    targetConversationIds: string[],
    additionalText?: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      setIsForwarding(true);
      const targetConversations: Conversation[] = [];

      for (const conversationId of targetConversationIds) {
        const conversation = availableConversations.find(c => c.id === conversationId);
        if (!conversation) continue;

        // Check permissions
        const canForward = await messagingService.canForwardToConversation(user.uid, conversationId);
        if (!canForward) {
          Alert.alert('Error', `You don't have permission to send messages to ${conversation.name || 'this conversation'}`);
          continue;
        }

        // Forward the messages
        await messagingService.forwardMessages(
          messages,
          conversationId,
          user.uid,
          user.displayName || user.email || 'Unknown User',
          additionalText
        );

        targetConversations.push(conversation);
      }

      if (targetConversations.length > 0) {
        Alert.alert(
          'Success',
          `${messages.length} messages forwarded to ${targetConversations.length} conversation${targetConversations.length > 1 ? 's' : ''}`
        );
        onForwardComplete?.(targetConversations);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Error forwarding messages:', error);
      Alert.alert('Error', error.message || 'Failed to forward messages');
      return false;
    } finally {
      setIsForwarding(false);
    }
  }, [user, availableConversations, onForwardComplete]);

  /**
   * Check if user can forward to a specific conversation
   */
  const canForwardToConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      return await messagingService.canForwardToConversation(user.uid, conversationId);
    } catch (error) {
      console.error('Error checking forward permissions:', error);
      return false;
    }
  }, [user]);

  /**
   * Get conversation display name for UI
   */
  const getConversationDisplayName = useCallback((conversation: Conversation): string => {
    if (conversation.type === 'group') {
      return conversation.name || 'Group Chat';
    }
    
    // For direct messages, show the other participant's name
    const otherParticipant = conversation.participants.find(p => p !== user?.uid);
    return conversation.name || otherParticipant || 'Unknown User';
  }, [user]);

  /**
   * Get conversation avatar for UI
   */
  const getConversationAvatar = useCallback((conversation: Conversation): string => {
    if (conversation.avatar) {
      return conversation.avatar;
    }
    
    // Default avatar based on conversation type
    if (conversation.type === 'group') {
      return 'https://randomuser.me/api/portraits/lego/1.jpg';
    }
    
    return 'https://randomuser.me/api/portraits/lego/2.jpg';
  }, []);

  /**
   * Show forwarding confirmation dialog
   */
  const showForwardConfirmation = useCallback((
    messageCount: number,
    targetCount: number,
    onConfirm: () => void
  ) => {
    const messageText = messageCount === 1 ? 'message' : `${messageCount} messages`;
    const targetText = targetCount === 1 ? 'conversation' : `${targetCount} conversations`;
    
    Alert.alert(
      'Forward Messages',
      `Forward ${messageText} to ${targetText}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Forward', onPress: onConfirm },
      ]
    );
  }, []);

  /**
   * Quick forward to a specific conversation
   */
  const quickForward = useCallback(async (
    messages: DirectMessage[],
    targetConversationId: string,
    additionalText?: string
  ): Promise<boolean> => {
    if (messages.length === 1) {
      return await forwardMessage(messages[0], [targetConversationId], additionalText);
    } else {
      return await forwardMessages(messages, [targetConversationId], additionalText);
    }
  }, [forwardMessage, forwardMessages]);

  return {
    // State
    isForwarding,
    availableConversations,
    isLoadingConversations,
    
    // Actions
    loadForwardingTargets,
    forwardMessage,
    forwardMessages,
    quickForward,
    
    // Utilities
    canForwardToConversation,
    getConversationDisplayName,
    getConversationAvatar,
    showForwardConfirmation,
  };
};
